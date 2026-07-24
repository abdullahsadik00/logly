/**
 * GAP 3 — Stripe webhook route WIRING (not the HMAC math; that's unit-tested
 * in src/lib/__tests__/stripeSignature.test.ts).
 *
 * Verifies: the router is mounted with express.raw BEFORE the global
 * express.json (a valid signature actually verifies end-to-end, which only
 * works if the raw bytes survive), project resolution, idempotency on
 * event.id, refund/unhandled types acknowledged-not-stored, and unlinked refs
 * stored as null.
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
  ctx = await createTestProject('stripe-hook');
});
after(teardown);

// Helper: POST a raw body + matching signature the way Stripe would.
// async function postWebhook(rawBody: string, header = stripeSignatureHeader(rawBody)) {
//   return request(app)
//     .post(`/api/stripe/webhook/${ctx.trackingId}`)
//     .set('Stripe-Signature', header)
//     .set('Content-Type', 'application/json')
//     .send(Buffer.from(rawBody)); // send raw bytes, not a parsed object
// }

test('valid signature verifies end-to-end and records one Payment', SKIP, async () => {
  const body = checkoutCompletedEvent({ eventId: 'evt_wire_1', amountTotal: 4900 });
  // const res = await postWebhook(body);
  // assert.equal(res.status, 200);

  const payments = await prisma.payment.findMany({ where: { stripeEventId: 'evt_wire_1' } });
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amountCents, 4900);
  assert.equal(payments[0].currency, 'usd');
  // Proves raw-body-before-json wiring: if express.json re-serialized the body,
  // the signature would have failed and we'd never reach here.
});

test('a bad signature is rejected 400 and stores nothing', SKIP, async () => {
  const body = checkoutCompletedEvent({ eventId: 'evt_bad', amountTotal: 100 });
  const wrongHeader = stripeSignatureHeader(body, 'whsec_wrong_secret');
  // const res = await postWebhook(body, wrongHeader);
  // assert.equal(res.status, 400);
  assert.equal(await prisma.payment.count(), 0);
  assert.ok(wrongHeader);
});

test('idempotent on event.id — redelivery is a no-op (one row)', SKIP, async () => {
  const body = checkoutCompletedEvent({ eventId: 'evt_dup', amountTotal: 2000 });
  // await postWebhook(body);
  // await postWebhook(body); // Stripe redelivers on timeout
  assert.equal(await prisma.payment.count({ where: { stripeEventId: 'evt_dup' } }), 1);
});

test('checkout ref links to a known Attribution; unknown ref stores null', SKIP, async () => {
  const knownRef = crypto.randomUUID();
  await prisma.attribution.create({ data: { attributionRef: knownRef, projectId: ctx.projectId } });

  // const linked = checkoutCompletedEvent({ eventId: 'evt_linked', amountTotal: 1000, clientReferenceId: knownRef });
  // await postWebhook(linked);
  // const unknown = checkoutCompletedEvent({ eventId: 'evt_unlinked', amountTotal: 1000, clientReferenceId: crypto.randomUUID() });
  // await postWebhook(unknown);

  // TODO: assert linked payment.attributionRef === knownRef, unlinked payment.attributionRef === null.
});

test('charge.refunded and other types are acknowledged (200) but not stored', SKIP, async () => {
  const refund = JSON.stringify({
    id: 'evt_refund',
    type: 'charge.refunded',
    data: { object: { amount_refunded: 500 } },
  });
  // const res = await postWebhook(refund);
  // assert.equal(res.status, 200);
  assert.equal(await prisma.payment.count({ where: { stripeEventId: 'evt_refund' } }), 0);
  assert.ok(refund);
});

test('404s on an unknown tracking id even with a valid signature', SKIP, async () => {
  // TODO: post a well-signed body to /api/stripe/webhook/<random-uuid>; expect 404.
});
