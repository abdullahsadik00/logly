import { Router, Request, Response } from 'express';
import express from 'express';
import { prisma } from '../lib/prisma';
import { resolveProjectId } from '../lib/resolveProject';
import { verifyStripeSignature } from '../lib/stripeSignature';
import { ApiError } from '../middleware/errorHandler';

export const stripeWebhookRouter = Router();

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

    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      // express.raw only populates a Buffer when Content-Type is application/json;
      // a mismatched/empty content-type would otherwise crash the .toString() below.
      throw new ApiError(400, 'Expected raw application/json body');
    }
    verifyStripeSignature(rawBody, req.headers['stripe-signature'] as string | undefined, secret);

    const event = JSON.parse(rawBody.toString('utf8')) as StripeEventShape;

    let amountCents: number | null = null;
    let currency: string | null = null;
    let attributionRef: string | null = null;

    // v0 handles only completed payments. Refunds are deliberately deferred: Stripe's
    // charge.refunded carries a CUMULATIVE amount_refunded and fires per partial refund,
    // so naive handling double-counts. A follow-up will do delta-based refunds with
    // re-attribution to the original source. Until then, refunds are acknowledged and
    // ignored (not stored) so Stripe stops retrying.
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      amountCents = typeof s.amount_total === 'number' ? s.amount_total : null;
      currency = typeof s.currency === 'string' ? s.currency : null;
      attributionRef =
        typeof s.client_reference_id === 'string' ? s.client_reference_id : null;
    } else {
      // Unhandled / deferred event types (incl. refunds) are acknowledged, not stored.
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

    // Idempotency via the unique stripe_event_id — upsert, not check-then-create,
    // so two near-simultaneous redeliveries of the same event can't race into a
    // P2002 (the update branch is a no-op).
    await prisma.payment.upsert({
      where: { stripeEventId: event.id },
      create: {
        projectId,
        attributionRef: linkedRef,
        stripeEventId: event.id,
        amountCents,
        currency,
      },
      update: {},
    });

    res.status(200).json({ received: true });
  },
);
