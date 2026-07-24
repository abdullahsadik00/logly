import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { verifyStripeSignature, STRIPE_SIGNATURE_TOLERANCE_SECONDS } from '../stripeSignature';

const SECRET = 'whsec_test_secret';
const BODY = Buffer.from(JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' }));

// Build a valid `t=...,v1=...` header for a given body/secret at a given time.
function signHeader(body: Buffer, secret: string, tsSeconds: number, sig?: string): string {
  const v1 =
    sig ??
    crypto.createHmac('sha256', secret).update(`${tsSeconds}.${body.toString('utf8')}`).digest('hex');
  return `t=${tsSeconds},v1=${v1}`;
}

// Freeze Date.now() so timestamp-tolerance checks are deterministic (see salt.test.ts).
const RealDate = Date;
function setNow(iso: string): void {
  const fixedMs = new RealDate(iso).getTime();
  const Stub: any = function (...args: unknown[]) {
    return args.length ? new (RealDate as any)(...args) : new RealDate(fixedMs);
  };
  Stub.now = () => fixedMs;
  Stub.UTC = RealDate.UTC;
  Stub.parse = RealDate.parse;
  Stub.prototype = RealDate.prototype;
  (globalThis as any).Date = Stub;
}
function restoreNow(): void {
  (globalThis as any).Date = RealDate;
}

const NOW_ISO = '2026-07-24T12:00:00Z';
const NOW_SECONDS = Math.floor(new Date(NOW_ISO).getTime() / 1000);

function statusOf(fn: () => void): number | 'ok' {
  try {
    fn();
    return 'ok';
  } catch (err) {
    return (err as { statusCode?: number }).statusCode ?? -1;
  }
}

test('accepts a correctly signed, in-tolerance payload', () => {
  try {
    setNow(NOW_ISO);
    assert.doesNotThrow(() =>
      verifyStripeSignature(BODY, signHeader(BODY, SECRET, NOW_SECONDS), SECRET),
    );
  } finally {
    restoreNow();
  }
});

test('rejects a missing Stripe-Signature header (400)', () => {
  assert.equal(statusOf(() => verifyStripeSignature(BODY, undefined, SECRET)), 400);
});

test('rejects a header with no timestamp or no v1 (400)', () => {
  try {
    setNow(NOW_ISO);
    assert.equal(statusOf(() => verifyStripeSignature(BODY, 'v1=deadbeef', SECRET)), 400);
    assert.equal(statusOf(() => verifyStripeSignature(BODY, `t=${NOW_SECONDS}`, SECRET)), 400);
    assert.equal(statusOf(() => verifyStripeSignature(BODY, 'garbage', SECRET)), 400);
  } finally {
    restoreNow();
  }
});

test('rejects a tampered body (signature no longer matches)', () => {
  try {
    setNow(NOW_ISO);
    const header = signHeader(BODY, SECRET, NOW_SECONDS);
    const tampered = Buffer.from(BODY.toString('utf8') + ' ');
    assert.equal(statusOf(() => verifyStripeSignature(tampered, header, SECRET)), 400);
  } finally {
    restoreNow();
  }
});

test('rejects a signature made with the wrong secret', () => {
  try {
    setNow(NOW_ISO);
    const header = signHeader(BODY, 'whsec_wrong', NOW_SECONDS);
    assert.equal(statusOf(() => verifyStripeSignature(BODY, header, SECRET)), 400);
  } finally {
    restoreNow();
  }
});

test('rejects a timestamp outside the 5-minute tolerance (replay guard)', () => {
  try {
    setNow(NOW_ISO);
    const stale = NOW_SECONDS - STRIPE_SIGNATURE_TOLERANCE_SECONDS - 1;
    // Sign correctly *for the stale timestamp* — only the age check should reject it.
    assert.equal(statusOf(() => verifyStripeSignature(BODY, signHeader(BODY, SECRET, stale), SECRET)), 400);

    const future = NOW_SECONDS + STRIPE_SIGNATURE_TOLERANCE_SECONDS + 1;
    assert.equal(statusOf(() => verifyStripeSignature(BODY, signHeader(BODY, SECRET, future), SECRET)), 400);
  } finally {
    restoreNow();
  }
});

test('accepts a timestamp exactly at the tolerance edge', () => {
  try {
    setNow(NOW_ISO);
    const edge = NOW_SECONDS - STRIPE_SIGNATURE_TOLERANCE_SECONDS;
    assert.doesNotThrow(() => verifyStripeSignature(BODY, signHeader(BODY, SECRET, edge), SECRET));
  } finally {
    restoreNow();
  }
});

test('accepts when one of several v1 signatures is valid (key rotation)', () => {
  try {
    setNow(NOW_ISO);
    const good = crypto
      .createHmac('sha256', SECRET)
      .update(`${NOW_SECONDS}.${BODY.toString('utf8')}`)
      .digest('hex');
    const header = `t=${NOW_SECONDS},v1=${'0'.repeat(64)},v1=${good}`;
    assert.doesNotThrow(() => verifyStripeSignature(BODY, header, SECRET));
  } finally {
    restoreNow();
  }
});

test('rejects a non-hex / wrong-length v1 signature without throwing', () => {
  try {
    setNow(NOW_ISO);
    assert.equal(statusOf(() => verifyStripeSignature(BODY, `t=${NOW_SECONDS},v1=zzzz`, SECRET)), 400);
  } finally {
    restoreNow();
  }
});

test('rejects a non-numeric timestamp (age is NaN)', () => {
  try {
    setNow(NOW_ISO);
    const good = crypto
      .createHmac('sha256', SECRET)
      .update(`abc.${BODY.toString('utf8')}`)
      .digest('hex');
    assert.equal(statusOf(() => verifyStripeSignature(BODY, `t=abc,v1=${good}`, SECRET)), 400);
  } finally {
    restoreNow();
  }
});
