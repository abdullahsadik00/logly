import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { computeVisitorId } from '../lib/salt';
import { ApiError } from '../middleware/errorHandler';

export const collectRouter = Router();

const collectSchema = z.object({
  type: z.enum(['pageview', 'custom']),
  page: z.string().url().max(2048),
  referrer: z.string().optional(),
  eventName: z.string().max(100).optional(),
  eventProps: z.record(z.unknown()).optional(),
  sessionId: z.string().uuid().optional(),
});

type CollectBody = z.infer<typeof collectSchema>;

function getDeviceType(ua: string): string {
  if (/Mobile/i.test(ua)) return 'mobile';
  if (/Tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

/** Best-effort client IP — used only to derive the visitor hash, never stored. */
function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress ?? '';
}

async function getProjectIdForTrackingId(trackingId: string): Promise<string | null> {
  const cacheKey = `project_id:${trackingId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const project = await prisma.project.findUnique({
    where: { trackingId },
    select: { id: true },
  });

  if (!project) return null;

  await redis.setex(cacheKey, 300, project.id); // cache for 5 minutes
  return project.id;
}

// Handle OPTIONS preflight
collectRouter.options('/:trackingId', (_req: Request, res: Response) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.status(204).send();
});

// POST /api/collect/:trackingId
collectRouter.post('/:trackingId', async (req: Request, res: Response) => {
  // Set CORS headers — allow from any origin (SDK embed)
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });

  const { trackingId } = req.params;

  // 1. Resolve projectId via Redis cache → DB fallback
  const projectId = await getProjectIdForTrackingId(trackingId);
  if (!projectId) {
    throw new ApiError(404, 'Unknown tracking ID');
  }

  // 2. Parse and validate body
  const parseResult = collectSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new ApiError(400, parseResult.error.errors.map(e => e.message).join(', '));
  }

  const body: CollectBody = parseResult.data;

  // 3. Derive metadata from headers
  const ua = (req.headers['user-agent'] ?? '').toString();
  const deviceType = getDeviceType(ua);
  const country =
    (req.headers['cf-ipcountry'] as string | undefined) ??
    (req.headers['x-country'] as string | undefined) ??
    null;

  // Derive a daily-salted visitor id from the request fingerprint. The IP/UA are
  // hashed here and discarded — only the hash is ever stored (see lib/salt.ts).
  const visitorId = computeVisitorId(projectId, getClientIp(req), ua);

  const eventData = {
    projectId,
    type: body.type,
    page: body.page,
    referrer: body.referrer ?? null,
    country,
    deviceType,
    eventName: body.eventName ?? null,
    eventProps: body.eventProps ?? null,
    visitorId,
    sessionId: body.sessionId ?? null,
    createdAt: new Date().toISOString(),
  };

  // 4. Push to Redis list for batch processing — fast path
  const eventsKey = `events:${projectId}`;
  const realtimeKey = `realtime:${projectId}`;

  await redis.rpush(eventsKey, JSON.stringify(eventData));

  // 5. Track active projects so the worker can find them
  await redis.sadd('active_projects', projectId);

  // 6. Increment real-time counter with 5-minute TTL
  await redis.incr(realtimeKey);
  await redis.expire(realtimeKey, 300);

  // 7. Respond immediately — do NOT wait for DB write
  res.status(204).send();
});
