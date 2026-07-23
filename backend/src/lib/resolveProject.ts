import { prisma } from './prisma';
import { redis } from './redis';

/**
 * Resolve a public trackingId to its internal projectId, using the same
 * Redis-cache-then-DB pattern as the collect hot path (5-min TTL). Shared so
 * the public attribution endpoint resolves projects identically to collect.
 * Returns null for an unknown trackingId.
 */
export async function resolveProjectId(trackingId: string): Promise<string | null> {
  const cacheKey = `project_id:${trackingId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const project = await prisma.project.findUnique({
    where: { trackingId },
    select: { id: true },
  });
  if (!project) return null;

  await redis.setex(cacheKey, 300, project.id);
  return project.id;
}
