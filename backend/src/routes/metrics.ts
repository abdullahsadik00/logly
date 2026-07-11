import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { requireAuth } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';

export const metricsRouter = Router();

metricsRouter.use(requireAuth);

async function verifyOwnership(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new ApiError(404, 'Project not found');
  return project;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/projects/:id/metrics/today
metricsRouter.get('/:id/metrics/today', async (req: Request, res: Response) => {
  const project = await verifyOwnership(req.params.id, req.userId);
  const projectId = project.id;

  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [todayStat, yesterdayStat] = await Promise.all([
    prisma.dailyStat.findUnique({ where: { projectId_date: { projectId, date: today } } }),
    prisma.dailyStat.findUnique({ where: { projectId_date: { projectId, date: yesterday } } }),
  ]);

  const realtimeCount = await redis.get(`realtime:${projectId}`);
  const realtimeViews = parseInt(realtimeCount ?? '0', 10);

  const todayViews = todayStat?.views ?? 0;
  const yesterdayViews = yesterdayStat?.views ?? 0;
  const viewsDelta =
    yesterdayViews === 0 ? null : ((todayViews - yesterdayViews) / yesterdayViews) * 100;

  res.json({
    today: {
      views: todayViews,
      visitors: todayStat?.visitors ?? 0,
      sessions: todayStat?.sessions ?? 0,
    },
    yesterday: {
      views: yesterdayViews,
      visitors: yesterdayStat?.visitors ?? 0,
      sessions: yesterdayStat?.sessions ?? 0,
    },
    realtime: { views: realtimeViews },
    delta: { viewsPct: viewsDelta !== null ? Math.round(viewsDelta * 10) / 10 : null },
  });
});

// GET /api/projects/:id/metrics/trend
metricsRouter.get('/:id/metrics/trend', async (req: Request, res: Response) => {
  const project = await verifyOwnership(req.params.id, req.userId);
  const projectId = project.id;

  const days = Math.min(parseInt((req.query.days as string) ?? '7', 10), 90);
  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

  const stats = await prisma.dailyStat.findMany({
    where: { projectId, date: { gte: from } },
    orderBy: { date: 'asc' },
  });

  res.json({ trend: stats, days });
});

// GET /api/projects/:id/metrics/pages
metricsRouter.get('/:id/metrics/pages', async (req: Request, res: Response) => {
  const project = await verifyOwnership(req.params.id, req.userId);
  const projectId = project.id;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pages = await prisma.$queryRaw<Array<{ page: string; views: bigint }>>`
    SELECT page, COUNT(*) as views
    FROM events
    WHERE project_id = ${projectId}
      AND created_at > ${thirtyDaysAgo}
    GROUP BY page
    ORDER BY views DESC
    LIMIT 20
  `;

  res.json({ pages: (pages as Array<{ page: string; views: bigint }>).map(p => ({ page: p.page, views: Number(p.views) })) });
});

// GET /api/projects/:id/metrics/events
metricsRouter.get('/:id/metrics/events', async (req: Request, res: Response) => {
  const project = await verifyOwnership(req.params.id, req.userId);
  const projectId = project.id;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const events = await prisma.$queryRaw<Array<{ event_name: string; count: bigint }>>`
    SELECT event_name, COUNT(*) as count
    FROM events
    WHERE project_id = ${projectId}
      AND type = 'custom'
      AND created_at > ${thirtyDaysAgo}
    GROUP BY event_name
    ORDER BY count DESC
    LIMIT 20
  `;

  res.json({
    events: (events as Array<{ event_name: string; count: bigint }>).map(e => ({ eventName: e.event_name, count: Number(e.count) })),
  });
});

// GET /api/projects/:id/metrics/realtime (SSE)
metricsRouter.get('/:id/metrics/realtime', async (req: Request, res: Response) => {
  const project = await verifyOwnership(req.params.id, req.userId);
  const projectId = project.id;

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // disable Nginx buffering
  });
  res.flushHeaders();

  const sendCount = async () => {
    const val = await redis.get(`realtime:${projectId}`);
    const count = parseInt(val ?? '0', 10);
    res.write(`data: ${JSON.stringify({ count })}\n\n`);
  };

  // Send immediately then every 5 seconds
  await sendCount();
  const interval = setInterval(() => {
    void sendCount();
  }, 5000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});
