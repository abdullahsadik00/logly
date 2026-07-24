/**
 * GAP 2 — attribution rate-limiter posture.
 *
 * The attribution endpoint has its OWN generous limiter (600/min) sized for
 * server-side signup POSTs from one IP — deliberately unlike /api/collect,
 * which carries NO limiter (SDK on third-party sites). This test pins that
 * contract so a future refactor can't silently throttle launch-day signups
 * or, conversely, add a limiter to collect.
 *
 * SKIPPED until the README prerequisites are met.
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
// import request from 'supertest';
// import { app } from '../../index';
import { createTestProject, resetDb, teardown, TestProject } from './helpers';

const SKIP = { skip: 'integration — needs test DB/Redis + supertest (see README)' };

let ctx: TestProject;
beforeEach(async () => {
  await resetDb();
  ctx = await createTestProject('attr-rl');
});
after(teardown);

test('attribution limiter is 600/min: 600 pass, 601st gets 429', SKIP, async () => {
  // NOTE: 600 real requests is slow and shares Redis/DB — consider asserting the
  // limiter CONFIG instead (import the router / limiter and check windowMs+max),
  // or drop max via an env override for the test. Pinning behaviour is the goal.
  //
  // TODO (behavioural):
  // let last = 0;
  // for (let i = 0; i < 601; i++) {
  //   last = (await request(app).post(`/api/attribution/${ctx.trackingId}`).send({ attributionRef: crypto.randomUUID() })).status;
  // }
  // assert.equal(last, 429);
  assert.ok(ctx);
});

test('rate-limit headers are standard (RateLimit-*), not legacy X-RateLimit-*', SKIP, async () => {
  // TODO:
  // const res = await request(app).post(`/api/attribution/${ctx.trackingId}`).send({ attributionRef: crypto.randomUUID() });
  // assert.ok(res.headers['ratelimit-limit']);
  // assert.equal(res.headers['x-ratelimit-limit'], undefined);
});

test('/api/collect has NO limiter — high volume never 429s', SKIP, async () => {
  // Guards the hot-path posture: collect must not inherit a limiter.
  // TODO: fire a burst well above 600 at /api/collect/:trackingId and assert
  // none return 429 (all 204 or validation errors, never 429).
});
