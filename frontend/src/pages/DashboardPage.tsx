import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { metricsKeys } from '@/lib/queryKeys';
import MetricCard from '@/components/MetricCard';
import TrendChart from '@/components/TrendChart';
import RealtimeCount from '@/components/RealtimeCount';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { TodayMetrics, TrendPoint, PageStat, EventStat, DateRange } from '@/types';

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'Today', value: 'today' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

function dateRangeToDays(range: DateRange): number {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  return 1;
}

/** Consistent inline error state for a dashboard card. */
function CardError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-4 text-center text-sm text-danger">
      {message}
    </div>
  );
}

function TopPagesTable({ projectId }: { projectId: string }) {
  const { data: pages = [], isLoading, isError } = useQuery({
    queryKey: metricsKeys.pages(projectId),
    queryFn: () => api.get<PageStat[]>(`/api/projects/${projectId}/metrics/pages`),
  });

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-fg-secondary">Top pages</h2>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-surface-hover" />
          ))}
        </div>
      ) : isError ? (
        <CardError message="Couldn't load top pages. Please retry." />
      ) : pages.length === 0 ? (
        <p className="py-4 text-center text-sm text-fg-muted">No page data yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-muted">
                <th className="pb-2 text-left font-medium">Page</th>
                <th className="pb-2 text-right font-medium">Views</th>
                <th className="pb-2 text-right font-medium">Visitors</th>
                <th className="pb-2 text-right font-medium">Bounce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {pages.map((p) => (
                <tr key={p.page} className="transition-colors hover:bg-surface-hover">
                  <td className="max-w-[180px] truncate py-2 pr-4 font-mono text-xs text-fg">{p.page}</td>
                  <td className="py-2 text-right text-fg-secondary">{p.views.toLocaleString()}</td>
                  <td className="py-2 text-right text-fg-secondary">{p.visitors.toLocaleString()}</td>
                  <td className="py-2 text-right text-fg-muted">{p.bounceRate.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TopEventsTable({ projectId }: { projectId: string }) {
  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: metricsKeys.events(projectId),
    queryFn: () => api.get<EventStat[]>(`/api/projects/${projectId}/metrics/events`),
  });

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-fg-secondary">Top custom events</h2>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-surface-hover" />
          ))}
        </div>
      ) : isError ? (
        <CardError message="Couldn't load custom events. Please retry." />
      ) : events.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm text-fg-muted">No custom events yet</p>
          <p className="mt-1 text-xs text-fg-faint">
            Use <code className="rounded bg-base px-1">window.logly.track()</code> to emit events
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-muted">
                <th className="pb-2 text-left font-medium">Event</th>
                <th className="pb-2 text-right font-medium">Count</th>
                <th className="pb-2 text-right font-medium">Unique users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {events.map((ev) => (
                <tr key={ev.name} className="transition-colors hover:bg-surface-hover">
                  <td className="py-2 pr-4 text-fg">{ev.name}</td>
                  <td className="py-2 text-right text-fg-secondary">{ev.count.toLocaleString()}</td>
                  <td className="py-2 text-right text-fg-muted">{ev.uniqueUsers.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

interface RevenueBySource {
  data: { source: string; amountCents: number }[];
  meta: { currency: string | null; totalCents: number };
}

/** Formats integer cents as a currency string, e.g. 1999 -> "$19.99". */
function formatMoney(cents: number, currency: string | null): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency ?? 'usd').toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${(currency ?? '').toUpperCase()}`.trim();
  }
}

// v0 revenue attribution: the wedge number. Revenue grouped by the acquisition
// source Logly derived server-side from the observed visit.
function RevenueBySourceCard({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: metricsKeys.revenueBySource(projectId),
    queryFn: () =>
      api.get<RevenueBySource>(`/api/projects/${projectId}/metrics/revenue-by-source`),
  });

  const rows = data?.data ?? [];
  const currency = data?.meta.currency ?? null;

  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold text-fg-secondary">Revenue by source</h2>
      {!isLoading && !isError && (
        <p className="mb-4 text-2xl font-bold text-fg">
          {formatMoney(data?.meta.totalCents ?? 0, currency)}
        </p>
      )}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-surface-hover" />
          ))}
        </div>
      ) : isError ? (
        <CardError message="Couldn't load revenue. Please retry." />
      ) : rows.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-sm text-fg-muted">No revenue attributed yet</p>
          <p className="mt-1 text-xs text-fg-faint">Connect Stripe and pass the attribution ref at signup</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-fg-muted">
                <th className="pb-2 text-left font-medium">Source</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {rows.map((r) => (
                <tr key={r.source} className="transition-colors hover:bg-surface-hover">
                  <td className="py-2 pr-4 text-fg">{r.source}</td>
                  <td className="py-2 text-right text-fg-secondary">{formatMoney(r.amountCents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id!;

  const [dateRange, setDateRange] = useState<DateRange>('today');
  const days = dateRangeToDays(dateRange);

  const { data: todayMetrics, isLoading: metricsLoading, isError: metricsError } = useQuery({
    queryKey: metricsKeys.today(projectId),
    queryFn: () => api.get<TodayMetrics>(`/api/projects/${projectId}/metrics/today`),
    refetchInterval: 30_000,
  });

  const { data: trend = [], isLoading: trendLoading, isError: trendError } = useQuery({
    queryKey: metricsKeys.trend(projectId, days),
    queryFn: () => api.get<TrendPoint[]>(`/api/projects/${projectId}/metrics/trend`, { days }),
    enabled: dateRange !== 'today',
  });

  return (
    <div className="space-y-6">
      {/* Toolbar — realtime + date range (page-level chrome now lives in AppShell) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RealtimeCount projectId={projectId} />
        <div className="flex overflow-hidden rounded-lg border border-line">
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors',
                dateRange === opt.value
                  ? 'bg-accent text-accent-contrast'
                  : 'bg-surface text-fg-secondary hover:bg-surface-hover hover:text-fg',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI metric cards */}
      {metricsError ? (
        <CardError message="Couldn't load today's metrics. Please retry." />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Page views" value={todayMetrics?.views ?? 0} delta={todayMetrics?.viewsDelta} loading={metricsLoading} />
          <MetricCard label="Unique visitors" value={todayMetrics?.visitors ?? 0} delta={todayMetrics?.visitorsDelta} loading={metricsLoading} />
          <MetricCard label="Sessions" value={todayMetrics?.sessions ?? 0} loading={metricsLoading} />
          <MetricCard label="Bounce rate" value={todayMetrics?.bounceRate ?? 0} format="percent" loading={metricsLoading} />
        </div>
      )}

      {/* Trend chart */}
      {dateRange !== 'today' ? (
        trendError ? (
          <Card className="p-5">
            <CardError message="Couldn't load the trend chart. Please retry." />
          </Card>
        ) : (
          <TrendChart data={trend} days={days} loading={trendLoading} />
        )
      ) : (
        <Card className="p-5">
          <p className="py-8 text-center text-sm text-fg-muted">Switch to 7d or 30d to see the trend chart</p>
        </Card>
      )}

      {/* Revenue attribution (v0 wedge) */}
      <RevenueBySourceCard projectId={projectId} />

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopPagesTable projectId={projectId} />
        <TopEventsTable projectId={projectId} />
      </div>
    </div>
  );
}
