import crypto from 'crypto';
import { ApiError } from '../middleware/errorHandler';

export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify a Stripe webhook signature manually (no stripe SDK dependency).
 * Header shape: `t=<unix-ts>,v1=<hex-hmac>[,v1=<hmac>...]`. The signed payload
 * is `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret. We enforce a
 * 5-minute timestamp tolerance and compare in constant time.
 * Verified against https://docs.stripe.com/webhooks/signature (2026-07-24).
 *
 * Throws ApiError(400) on any verification failure; returns void on success.
 */
export function verifyStripeSignature(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
): void {
  if (!header) throw new ApiError(400, 'Missing Stripe-Signature header');

  let timestamp = '';
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v;
    else if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) {
    throw new ApiError(400, 'Malformed Stripe-Signature header');
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    throw new ApiError(400, 'Stripe signature timestamp outside tolerance');
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');

  const match = signatures.some((sig) => {
    let sigBuf: Buffer;
    try {
      sigBuf = Buffer.from(sig, 'hex');
    } catch {
      return false;
    }
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
  if (!match) throw new ApiError(400, 'Stripe signature verification failed');
}
