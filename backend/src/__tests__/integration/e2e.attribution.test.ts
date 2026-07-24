/**
 * GAP 5 — end-to-end join across the whole vertical slice, through the real
 * HTTP surface: a visit is collected → signup records the attribution → Stripe
 * pays → revenue-by-source attributes the money to the visit's source.
 *
 * This is the wedge number the product sells; this test proves the join holds
 * across all four seams (collect, attribution, webhook, read).
 *
 * The one subtlety: collect enqueues to Redis and the WORKER drains to Postgres
 * on a timer. The read model derives source from the Event row, so the Event
 * must be in Postgres before we assert. Options (pick one when wiring):
 *   (a) run one worker flush cycle explicitly (import the flush fn), or
 *   (b) insert the Event via prisma directly to stand in for a flushed collect.
 * (b) keeps the test fast and deterministic and is the recommended default;
 * add a separate, smaller test that exercises the collect→worker path once.
 *
 * SKIPPED until the README prerequisites are met.
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
// import request from 'supertest';
// import { app } from '../../index';
import { prisma } from '../../lib/prisma';
import {
  createTestProject,
  resetDb,
  teardown,
  stripeSignatureHeader,
  checkoutCompletedEvent,
  TestProject,
} from './helpers';

const SKIP = { skip: 'integration — needs test DB/Redis + STRIPE_WEBHOOK_SECRET + supertest (see README)' };

let ctx: TestProject;
beforeEach(async () => {
  await resetDb();
  ctx = await createTestProject('e2e');
});
after(teardown);

test('visit(twitter) → signup → payment → $ attributed to twitter', SKIP, async () => {
  const attributionRef = crypto.randomUUID();

  // 1. VISIT — the SDK tags an event with the opaque ref. Stand in for a
  //    flushed collect by inserting the Event directly (see header note (b)).
  await prisma.event.create({
    data: {
      projectId: ctx.projectId,
      type: 'pageview',
      page: 'https://acme.com/pricing?utm_source=twitter&utm_medium=social',
      referrer: 'https://t.co/',
      attributionRef,
    },
  });

  // 2. SIGNUP — customer's app POSTs the ref.
  // const signup = await request(app).post(`/api/attribution/${ctx.trackingId}`).send({ attributionRef });
  // assert.equal(signup.status, 204);

  // 3. PAYMENT — Stripe fires checkout.session.completed with client_reference_id = ref.
  const body = checkoutCompletedEvent({ eventId: 'evt_e2e', amountTotal: 9900, clientReferenceId: attributionRef });
  // const hook = await request(app)
  //   .post(`/api/stripe/webhook/${ctx.trackingId}`)
  //   .set('Stripe-Signature', stripeSignatureHeader(body))
  //   .set('Content-Type', 'application/json')
  //   .send(Buffer.from(body));
  // assert.equal(hook.status, 200);
  assert.ok(stripeSignatureHeader(body));

  // 4. READ — the $99 is attributed to 'twitter'.
  // const res = await request(app)
  //   .get(`/api/projects/${ctx.projectId}/metrics/revenue-by-source`)
  //   .set('Authorization', `Bearer ${ctx.authToken}`);
  // assert.equal(res.status, 200);
  // assert.deepEqual(res.body.data, [{ source: 'twitter', amountCents: 9900 }]);
  // assert.equal(res.body.meta.totalCents, 9900);
});

test('payment with a ref we never saw at signup still counts (as direct)', SKIP, async () => {
  // The webhook stores the ref as null when no Attribution row exists (never
  // drops revenue); with no Event to derive from, the read buckets it 'direct'.
  // TODO: skip step 2 (no signup), send a webhook with a random ref, assert the
  // money shows under 'direct' — revenue is never lost, only its source.
});
