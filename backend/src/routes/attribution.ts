import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolveProjectId } from '../lib/resolveProject';
import { ApiError } from '../middleware/errorHandler';

export const attributionRouter = Router();

// The opaque ref is the only field. No client-supplied source/utm — the server
// derives source from the observed collect Event at read time (see deriveSource).
const attributionSchema = z.object({
  attributionRef: z.string().uuid(),
});

// Generous limiter sized for the real traffic shape: signups are low-volume and
// often POSTed from the customer's app SERVER (one IP), so we don't want to
// throttle a legitimate launch-day spike. The primary anti-flood guard is the
// idempotent upsert on the unique attribution_ref (repeats never multiply rows).
const attributionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

// Preflight — mirrors collect: the customer's site/app calls this cross-origin.
attributionRouter.options('/:trackingId', (_req: Request, res: Response) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.status(204).send();
});

// POST /api/attribution/:trackingId  — called at signup with the opaque ref.
attributionRouter.post('/:trackingId', attributionLimiter, async (req: Request, res: Response) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });

  const projectId = await resolveProjectId(req.params.trackingId);
  if (!projectId) throw new ApiError(404, 'Unknown tracking ID');

  const parsed = attributionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.errors.map((e) => e.message).join(', '));
  }
  const { attributionRef } = parsed.data;

  // Idempotent: repeats for the same ref do not create duplicate rows.
  await prisma.attribution.upsert({
    where: { attributionRef },
    create: { attributionRef, projectId },
    update: {},
  });

  res.status(204).send();
});
