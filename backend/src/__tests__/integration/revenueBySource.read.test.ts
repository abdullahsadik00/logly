/**
 * GAP 4 — GET /api/projects/:id/metrics/revenue-by-source read model.
 *
 * Verifies the aggregation: refunds (negative amounts) subtract, rows group by
 * the SERVER-DERIVED source (never client-supplied), payments with no matching
 * event fall into the 'direct' bucket, rows sort by amount desc, meta.totalCents
 * and meta.currency are correct, the ?from/?to window filters, and ownership is
 * enforced (requireAuth + user owns the project).
 *
 * Seeds Payment/Attribution/Event rows directly (no webhook) so the read is
 * isolated from ingestion timing.
 *
 * SKIPPED until the README prerequisites are met.
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
// import request from 'supertest';
// import { app } from '../../index';
import { prisma } from '../../lib/prisma';
import { createTestProject, resetDb, teardown, TestProject } from './helpers';

const SKIP = { skip: 'integration — needs test DB/Redis + supertest (see README)' };

let ctx: TestProject;
beforeEach(async () => {
  await resetDb();
  ctx = await createTestProject('rev-read');
});
after(teardown);

// Seed a ref that will derive to `source` via its first observed Event, plus a
// payment against it. deriveSource(page, referrer): utm_source wins, else
// referrer host, else 'direct'.
async function seedSourcedPayment(opts: {
  eventId: string; // stripe event id (unique)
  amountCents: number;
  page: string;
  referrer: string | null;
  createdAt?: Date;
}) {
  const attributionRef = crypto.randomUUID();
  await prisma.attribution.create({ data: { attributionRef, projectId: ctx.projectId } });
  await prisma.event.create({
    data: {
      projectId: ctx.projectId,
      type: 'pageview',
      page: opts.page,
      referrer: opts.referrer,
      attributionRef,
    },
  });
  await prisma.payment.create({
    data: {
      projectId: ctx.projectId,
      attributionRef,
      stripeEventId: opts.eventId,
      amountCents: opts.amountCents,
      currency: 'usd',
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

test('groups revenue by derived source, sorted by amount desc', SKIP, async () => {
  await seedSourcedPayment({ eventId: 'p1', amountCents: 5000, page: 'https://a.com/?utm_source=twitter', referrer: null });
  await seedSourcedPayment({ eventId: 'p2', amountCents: 3000, page: 'https://a.com/', referrer: 'https://news.ycombinator.com/' });
  await seedSourcedPayment({ eventId: 'p3', amountCents: 2000, page: 'https://a.com/?utm_source=twitter', referrer: null });

  // const res = await request(app)
  //   .get(`/api/projects/${ctx.projectId}/metrics/revenue-by-source`)
  //   .set('Authorization', `Bearer ${ctx.authToken}`);
  // assert.equal(res.status, 200);
  // assert.deepEqual(res.body.data, [
  //   { source: 'twitter', amountCents: 7000 },
  //   { source: 'news.ycombinator.com', amountCents: 3000 },
  // ]);
  // assert.equal(res.body.meta.totalCents, 10000);
  // assert.equal(res.body.meta.currency, 'usd');
});

test("a payment whose ref has no matching Event falls into 'direct'", SKIP, async () => {
  const orphanRef = crypto.randomUUID();
  await prisma.attribution.create({ data: { attributionRef: orphanRef, projectId: ctx.projectId } });
  await prisma.payment.create({
    data: { projectId: ctx.projectId, attributionRef: orphanRef, stripeEventId: 'orphan', amountCents: 1500, currency: 'usd' },
  });
  // A payment with attributionRef === null also lands in 'direct'.
  await prisma.payment.create({
    data: { projectId: ctx.projectId, attributionRef: null, stripeEventId: 'nullref', amountCents: 500, currency: 'usd' },
  });

  // TODO: assert the response has a single { source: 'direct', amountCents: 2000 } row.
});

test('refunds (negative amounts) subtract from their source bucket', SKIP, async () => {
  await seedSourcedPayment({ eventId: 'sale', amountCents: 5000, page: 'https://a.com/?utm_source=twitter', referrer: null });
  await seedSourcedPayment({ eventId: 'refund', amountCents: -2000, page: 'https://a.com/?utm_source=twitter', referrer: null });
  // TODO: assert twitter bucket nets to 3000 and meta.totalCents === 3000.
});

test('?from/?to filters payments by createdAt window', SKIP, async () => {
  await seedSourcedPayment({ eventId: 'old', amountCents: 9999, page: 'https://a.com/?utm_source=twitter', referrer: null, createdAt: new Date('2020-01-01') });
  await seedSourcedPayment({ eventId: 'new', amountCents: 1000, page: 'https://a.com/?utm_source=twitter', referrer: null });
  // TODO: GET with ?from=2021-01-01 → only the 'new' payment counts (1000).
});

test('requireAuth: no token → 401; another user → 404', SKIP, async () => {
  // TODO:
  // const noAuth = await request(app).get(`/api/projects/${ctx.projectId}/metrics/revenue-by-source`);
  // assert.equal(noAuth.status, 401);
  // const other = await createTestProject('rev-read-other');
  // const wrong = await request(app).get(`/api/projects/${ctx.projectId}/metrics/revenue-by-source`).set('Authorization', `Bearer ${other.authToken}`);
  // assert.equal(wrong.status, 404); // verifyOwnership hides others' projects as 404
});
