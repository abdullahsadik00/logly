import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import express from 'express';
import { prisma } from '../lib/prisma';
import { resolveProjectId } from '../lib/resolveProject';
import { ApiError } from '../middleware/errorHandler';

export const stripeWebhookRouter = Router();

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify a Stripe webhook signature manually (no stripe SDK dependency).
 * Header shape: `t=<unix-ts>,v1=<hex-hmac>[,v1=<hmac>...]`. The signed payload
 * is `${t}.${rawBody}`, HMAC-SHA256 with the endpoint secret. We enforce a
 * 5-minute timestamp tolerance and compare in constant time.
 * Verified against https://docs.stripe.com/webhooks/signature (2026-07-24).
 */
function verifyStripeSignature(rawBody: Buffer, header: string | undefined, secret: string): void {
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
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
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

interface StripeEventShape {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

// POST /api/stripe/webhook/:trackingId
// Mounted with express.raw so `req.body` is the raw Buffer needed for signature
// verification — must run BEFORE the global express.json() (see index.ts).
stripeWebhookRouter.post(
  '/:trackingId',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new ApiError(500, 'Stripe webhook secret not configured');

    const projectId = await resolveProjectId(req.params.trackingId);
    if (!projectId) throw new ApiError(404, 'Unknown tracking ID');

    const rawBody = req.body as Buffer;
    verifyStripeSignature(rawBody, req.headers['stripe-signature'] as string | undefined, secret);

    const event = JSON.parse(rawBody.toString('utf8')) as StripeEventShape;

    // Idempotency: the unique stripe_event_id makes a redelivered event a no-op.
    const already = await prisma.payment.findUnique({ where: { stripeEventId: event.id } });
    if (already) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    let amountCents: number | null = null;
    let currency: string | null = null;
    let attributionRef: string | null = null;

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      amountCents = typeof s.amount_total === 'number' ? s.amount_total : null;
      currency = typeof s.currency === 'string' ? s.currency : null;
      attributionRef =
        typeof s.client_reference_id === 'string' ? s.client_reference_id : null;
    } else if (event.type === 'charge.refunded') {
      const c = event.data.object;
      // Refund nets against revenue → store as a negative amount.
      amountCents = typeof c.amount_refunded === 'number' ? -c.amount_refunded : null;
      currency = typeof c.currency === 'string' ? c.currency : null;
      // Charges don't carry client_reference_id; refund attributes at project level.
      attributionRef = null;
    } else {
      // Unhandled event types are acknowledged so Stripe stops retrying.
      res.status(200).json({ received: true, ignored: event.type });
      return;
    }

    if (amountCents === null || currency === null) {
      res.status(200).json({ received: true, ignored: 'missing amount/currency' });
      return;
    }

    // Only link the ref if we actually recorded that attribution (else store null
    // → surfaces under the 'direct/unknown' bucket, never dropped).
    let linkedRef: string | null = null;
    if (attributionRef) {
      const attr = await prisma.attribution.findUnique({ where: { attributionRef } });
      linkedRef = attr ? attributionRef : null;
    }

    await prisma.payment.create({
      data: {
        projectId,
        attributionRef: linkedRef,
        stripeEventId: event.id,
        amountCents,
        currency,
      },
    });

    res.status(200).json({ received: true });
  },
);
