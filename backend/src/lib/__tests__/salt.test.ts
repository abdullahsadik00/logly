import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVisitorId } from '../salt';

const PROJECT = 'project-1';
const IP = '203.0.113.7';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

// Freeze `new Date()` / Date.now() to a fixed instant so we can cross a UTC
// midnight and observe the salt rotation without touching the real clock.
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

test('returns a 64-char sha256 hex string', () => {
  assert.match(computeVisitorId(PROJECT, IP, UA), /^[0-9a-f]{64}$/);
});

test('is deterministic for the same inputs within a day', () => {
  assert.equal(computeVisitorId(PROJECT, IP, UA), computeVisitorId(PROJECT, IP, UA));
});

test('changes when any input changes', () => {
  const base = computeVisitorId(PROJECT, IP, UA);
  assert.notEqual(computeVisitorId('project-2', IP, UA), base);
  assert.notEqual(computeVisitorId(PROJECT, '198.51.100.1', UA), base);
  assert.notEqual(computeVisitorId(PROJECT, IP, 'a-different-user-agent'), base);
});

test('is un-linkable across a UTC day rollover (salt rotation)', () => {
  try {
    setNow('2026-01-01T12:00:00Z');
    const day1 = computeVisitorId(PROJECT, IP, UA);

    setNow('2026-01-02T12:00:00Z');
    const day2 = computeVisitorId(PROJECT, IP, UA);

    // Same visitor, next day → different hash: yesterday's salt is gone.
    assert.notEqual(day2, day1);
    // ...but still stable within the new day.
    assert.equal(computeVisitorId(PROJECT, IP, UA), day2);
  } finally {
    restoreNow();
  }
});
