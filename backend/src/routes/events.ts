import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

// GET /api/projects/:id/events
eventsRouter.get('/:id/events', async (req: Request, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!project) throw new ApiError(404, 'Project not found');

  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? '50', 10)));
  const type = req.query.type as string | undefined;
  const from = req.query.from ? new Date(req.query.from as string) : undefined;
  const to = req.query.to ? new Date(req.query.to as string) : undefined;

  const where = {
    projectId: project.id,
    ...(type ? { type } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      // Only the columns the events table renders — deliberately excludes
      // visitorId / sessionId / eventProps (no need to expose them to the client).
      select: {
        id: true,
        type: true,
        page: true,
        referrer: true,
        country: true,
        deviceType: true,
        eventName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  // Paginated<EventRow> shape consumed by EventsPage.
  res.json({
    data: events,
    total,
    page,
    pageSize: limit,
  });
});
