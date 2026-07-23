import test from 'node:test';
import assert from 'node:assert/strict';
import { getDeviceType } from '../device';

test('detects mobile', () => {
  assert.equal(
    getDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'),
    'mobile',
  );
});

test('detects tablet', () => {
  assert.equal(getDeviceType('Mozilla/5.0 (Android 13; Tablet) AppleWebKit/537.36'), 'tablet');
});

test('defaults to desktop', () => {
  assert.equal(
    getDeviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605'),
    'desktop',
  );
});

test('treats an empty UA as desktop', () => {
  assert.equal(getDeviceType(''), 'desktop');
});
