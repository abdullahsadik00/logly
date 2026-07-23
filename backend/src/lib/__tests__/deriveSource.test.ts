import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSource } from '../deriveSource';

test('deriveSource: utm_source in the landing URL wins', () => {
  assert.equal(
    deriveSource('https://acme.com/pricing?utm_source=Twitter&utm_medium=social', 'https://t.co/'),
    'twitter',
  );
});

test('deriveSource: falls back to referrer host (www stripped) when no utm', () => {
  assert.equal(deriveSource('https://acme.com/pricing', 'https://www.google.com/search?q=x'), 'google.com');
});

test("deriveSource: returns 'direct' with no utm and no referrer", () => {
  assert.equal(deriveSource('https://acme.com/', null), 'direct');
});

test("deriveSource: returns 'direct' when both inputs are null", () => {
  assert.equal(deriveSource(null, null), 'direct');
});

test('deriveSource: malformed page URL falls through to referrer', () => {
  assert.equal(deriveSource('not-a-url', 'https://news.ycombinator.com/'), 'news.ycombinator.com');
});

test("deriveSource: malformed referrer with no utm yields 'direct'", () => {
  assert.equal(deriveSource('https://acme.com/', 'garbage'), 'direct');
});

test('deriveSource: empty utm_source value falls back to referrer', () => {
  assert.equal(deriveSource('https://acme.com/?utm_source=', 'https://reddit.com/'), 'reddit.com');
});
