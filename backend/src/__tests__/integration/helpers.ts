/**
 * Shared harness for the revenue-attribution integration tests.
 *
 * These helpers assume the prerequisites in ./README.md are met (test DB +
 * Redis + secrets + a `supertest` install). They are intentionally small
 * scaffolds — flesh out the TODOs as you wire each stub up.
 */
import crypto from 'crypto';
import { signToken } from '../../lib/jwt';

// prisma/redis are loaded LAZILY (inside the guarded helpers below) rather than
// at module top-level. The redis singleton connects eagerly on import
// (lazyConnect: false), which would keep the event loop alive and stop
// `node --test` from ever exiting when the suite is skipped. `typeof import()`
// keeps the shapes without triggering that connection.
type Prisma = typeof import('../../lib/prisma').prisma;
const getPrisma = async (): Promise<Prisma> => (await import('../../lib/prisma')).prisma;
const getRedis = async () => (await import('../../lib/redis')).redis;

// supertest is a devDependency you must add first (see README). The import is
// kept lazy-ish via require so the file at least type-checks the rest before
// the dep exists; swap to a top-level `import request from 'supertest'` once
// installed.
// import request from 'supertest';

export const TEST_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_integration_test';

/**
 * Master switch for the integration suite. These tests connect to Postgres +
 * Redis; the `node:test` `skip` option skips a test BODY but still runs its
 * `before`/`beforeEach` hooks — which would hang on a missing DB. So every
 * DB-touching helper is a no-op unless RUN_INTEGRATION=1 (set by the
 * `test:integration` script once the README prerequisites are in place).
 */
export const RUN_INTEGRATION = process.env.RUN_INTEGRATION === '1';

export interface TestProject {
  userId: string;
  projectId: string;
  trackingId: string;
  authToken: string; // Bearer token for the owning user (dashboard routes)
}

/**
 * Create a throwaway user + project and return the ids plus a signed JWT for
 * the owner. Uses a unique email/tracking id per call so tests don't collide.
 */
export async function createTestProject(label: string): Promise<TestProject> {
  // No-op stub when the suite is disabled — the skipped test bodies never read it.
  if (!RUN_INTEGRATION) {
    return { userId: '', projectId: '', trackingId: '', authToken: '' };
  }
  const prisma = await getPrisma();
  const user = await prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@test.local`,
      // TODO: match the auth route's hashing (bcryptjs) if a test ever logs in;
      // for these tests we mint the JWT directly and never hit /api/auth.
      passwordHash: 'x',
    },
  });
  const project = await prisma.project.create({
    data: { userId: user.id, name: label, domain: `${label}.test` },
  });
  return {
    userId: user.id,
    projectId: project.id,
    trackingId: project.trackingId,
    authToken: signToken(user.id),
  };
}

/**
 * Truncate the tables these tests write to and clear the project-resolution
 * cache. Call in a beforeEach. Order respects FK dependencies.
 */
export async function resetDb(): Promise<void> {
  if (!RUN_INTEGRATION) return;
  const prisma = await getPrisma();
  const redis = await getRedis();
  await prisma.payment.deleteMany();
  await prisma.attribution.deleteMany();
  await prisma.event.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  // Project-resolution cache (resolveProjectId) — stale entries would 404/hit
  // the wrong project across tests.
  const keys = await redis.keys('project_id:*');
  if (keys.length) await redis.del(...keys);
}

/** Close pooled connections so `node --test` exits cleanly. */
export async function teardown(): Promise<void> {
  if (!RUN_INTEGRATION) return;
  const prisma = await getPrisma();
  const redis = await getRedis();
  await prisma.$disconnect();
  await redis.quit();
}

/**
 * Build a valid `Stripe-Signature` header for a raw JSON body, signed with the
 * same scheme the webhook verifies (see lib/stripeSignature.ts). Pass a custom
 * `tsSeconds` to exercise the tolerance window.
 */
export function stripeSignatureHeader(
  rawBody: string,
  secret = TEST_WEBHOOK_SECRET,
  tsSeconds = Math.floor(Date.now() / 1000),
): string {
  const v1 = crypto
    .createHmac('sha256', secret)
    .update(`${tsSeconds}.${rawBody}`)
    .digest('hex');
  return `t=${tsSeconds},v1=${v1}`;
}

/** A minimal `checkout.session.completed` event body. */
export function checkoutCompletedEvent(opts: {
  eventId: string;
  amountTotal: number;
  currency?: string;
  clientReferenceId?: string | null;
}): string {
  return JSON.stringify({
    id: opts.eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        amount_total: opts.amountTotal,
        currency: opts.currency ?? 'usd',
        client_reference_id: opts.clientReferenceId ?? null,
      },
    },
  });
}
