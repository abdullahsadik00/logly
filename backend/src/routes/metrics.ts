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

/**
 * Bounce rate (0–100) for a project since `from`: the share of pageview
 * sessions that consisted of a single pageview. Computed live from raw events.
 */
async function computeBounceRate(projectId: string, from: Date): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ bounce: number | null }>>`
    SELECT COUNT(*) FILTER (WHERE pv = 1)::float / NULLIF(COUNT(*), 0) AS bounce
    FROM (
      SELECT session_id, COUNT(*) AS pv
      FROM events
      WHERE project_id = ${projectId}
        AND type = 'pageview'
        AND session_id IS NOT NULL
        AND created_at >= ${from}
      GROUP BY session_id
    ) s
  `;
  const fraction = rows[0]?.bounce ?? 0;
  return Math.round((fraction ?? 0) * 1000) / 10;
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

  const todayViews = todayStat?.views ?? 0;
  const todayVisitors = todayStat?.visitors ?? 0;
  const todaySessions = todayStat?.sessions ?? 0;
  const yesterdayViews = yesterdayStat?.views ?? 0;
  const yesterdayVisitors = yesterdayStat?.visitors ?? 0;

  const bounceRate = await computeBounceRate(projectId, today);
  const round1 = (n: number) => Math.round(n * 10) / 10;

  // Flat shape consumed directly by the dashboard KPI cards. Deltas are omitted
  // (not zero/null) when there is no prior-day baseline, so the UI hides the
  // badge instead of showing a misleading change.
  res.json({
    views: todayViews,
    visitors: todayVisitors,
    sessions: todaySessions,
    bounceRate,
    ...(yesterdayViews > 0
      ? { viewsDelta: round1(((todayViews - yesterdayViews) / yesterdayViews) * 100) }
      : {}),
    ...(yesterdayVisitors > 0
      ? { visitorsDelta: round1(((todayVisitors - yesterdayVisitors) / yesterdayVisitors) * 100) }
      : {}),
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

  // Bare array of TrendPoint; date normalized to YYYY-MM-DD for the chart.
  res.json(
    stats.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      views: s.views,
      visitors: s.visitors,
    })),
  );
});

// GET /api/projects/:id/metrics/pages
metricsRouter.get('/:id/metrics/pages', async (req: Request, res: Response) => {
  const project = await verifyOwnership(req.params.id, req.userId);
  const projectId = project.id;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // views = all events on the page; visitors = distinct daily-salted hashes;
  // bounce = share of the page's pageview sessions that were single-pageview.
  const pages = await prisma.$queryRaw<
    Array<{ page: string; views: bigint; visitors: bigint; bounce: number | null }>
  >`
    SELECT
      e.page AS page,
      COUNT(*) AS views,
      COUNT(DISTINCT e.visitor_id) AS visitors,
      COUNT(DISTINCT e.session_id) FILTER (WHERE spv.pv = 1)::float
        / NULLIF(COUNT(DISTINCT e.session_id), 0) AS bounce
    FROM events e
    LEFT JOIN (
      SELECT session_id, COUNT(*) AS pv
      FROM events
      WHERE project_id = ${projectId}
        AND type = 'pageview'
        AND created_at > ${thirtyDaysAgo}
      GROUP BY session_id
    ) spv ON spv.session_id = e.session_id
    WHERE e.project_id = ${projectId}
      AND e.created_at > ${thirtyDaysAgo}
    GROUP BY e.page
    ORDER BY views DESC
    LIMIT 20
  `;

  // Bare PageStat[] for the Top pages table.
  res.json(
    pages.map((p) => ({
      page: p.page,
      views: Number(p.views),
      visitors: Number(p.visitors),
      bounceRate: Math.round((p.bounce ?? 0) * 1000) / 10,
    })),
  );
});

// GET /api/projects/:id/metrics/events
metricsRouter.get('/:id/metrics/events', async (req: Request, res: Response) => {
  const project = await verifyOwnership(req.params.id, req.userId);
  const projectId = project.id;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const events = await prisma.$queryRaw<
    Array<{ event_name: string; count: bigint; unique_users: bigint }>
  >`
    SELECT event_name, COUNT(*) as count, COUNT(DISTINCT visitor_id) AS unique_users
    FROM events
    WHERE project_id = ${projectId}
      AND type = 'custom'
      AND created_at > ${thirtyDaysAgo}
    GROUP BY event_name
    ORDER BY count DESC
    LIMIT 20
  `;

  // Bare EventStat[] for the Top custom events table.
  res.json(
    events.map((e) => ({
      name: e.event_name,
      count: Number(e.count),
      uniqueUsers: Number(e.unique_users),
    })),
  );
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
