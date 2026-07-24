/**
 * GAP 1 — POST /api/attribution/:trackingId upsert + idempotency.
 *
 * Verifies the public signup endpoint stores exactly one Attribution row per
 * opaque ref, is idempotent on repeats, validates the ref, and 404s on an
 * unknown tracking id.
 *
 * SKIPPED until the README prerequisites are met (test DB + Redis + supertest).
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
// import request from 'supertest';
// import { app } from '../../index';
import { prisma } from '../../lib/prisma';
import { createTestProject, resetDb, teardown, TestProject } from './helpers';

const SKIP = { skip: 'integration — needs test DB/Redis + supertest (see README)' };

let ctx: TestProject;

before(async () => {
  await resetDb();
});
beforeEach(async () => {
  await resetDb();
  ctx = await createTestProject('attr-endpoint');
});
after(teardown);

test('creates exactly one Attribution row for a valid ref', SKIP, async () => {
  const attributionRef = crypto.randomUUID();

  // TODO:
  // const res = await request(app)
  //   .post(`/api/attribution/${ctx.trackingId}`)
  //   .send({ attributionRef });
  // assert.equal(res.status, 204);

  const rows = await prisma.attribution.findMany({ where: { attributionRef } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].projectId, ctx.projectId);
});

test('is idempotent — repeated POSTs of the same ref never duplicate', SKIP, async () => {
  const attributionRef = crypto.randomUUID();

  // TODO: POST the same ref 3x; each should 204.
  // for (let i = 0; i < 3; i++) {
  //   const res = await request(app).post(`/api/attribution/${ctx.trackingId}`).send({ attributionRef });
  //   assert.equal(res.status, 204);
  // }

  const count = await prisma.attribution.count({ where: { attributionRef } });
  assert.equal(count, 1);
});

test('rejects a non-uuid ref with 400 (Zod)', SKIP, async () => {
  // TODO:
  // const res = await request(app).post(`/api/attribution/${ctx.trackingId}`).send({ attributionRef: 'not-a-uuid' });
  // assert.equal(res.status, 400);
  // const count = await prisma.attribution.count();
  // assert.equal(count, 0);
});

test('404s on an unknown tracking id', SKIP, async () => {
  // TODO:
  // const res = await request(app).post(`/api/attribution/${crypto.randomUUID()}`).send({ attributionRef: crypto.randomUUID() });
  // assert.equal(res.status, 404);
});

test('sets Access-Control-Allow-Origin: * (public cross-origin caller)', SKIP, async () => {
  // TODO: assert the CORS header on both the POST and the OPTIONS preflight.
});
