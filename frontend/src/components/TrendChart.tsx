import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type TooltipProps,
} from 'recharts';
import type { TrendPoint } from '@/types';
import { getChartPalette } from '@/lib/chartColors';

interface TrendChartProps {
  data: TrendPoint[];
  days: number;
  loading?: boolean;
}

function formatXAxisDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00'); // Ensure local timezone interpretation
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-surface border border-line-strong rounded-lg shadow-xl px-3 py-2 text-sm">
      <p className="text-fg-muted mb-1.5">{formatXAxisDate(label as string)}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-fg-secondary capitalize">{entry.name}:</span>
          <span className="text-fg font-semibold">
            {formatLargeNumber(entry.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TrendChart({ data, days, loading = false }: TrendChartProps) {
  const palette = useMemo(() => getChartPalette(), []);

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-line p-5 h-72 flex items-center justify-center">
        <div className="w-full h-full animate-pulse bg-surface-hover rounded-lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-line p-5 h-72 flex items-center justify-center">
        <p className="text-fg-muted text-sm">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-line p-5">
      <p className="text-sm font-medium text-fg-secondary mb-4">
        Traffic trend — last {days} days
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxisDate}
            tick={{ fill: palette.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={days > 14 ? 4 : 1}
          />
          <YAxis
            tickFormatter={formatLargeNumber}
            tick={{ fill: palette.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: palette.legend, paddingTop: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="views"
            name="Views"
            stroke={palette.series[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: palette.series[0], stroke: palette.dotStroke, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="visitors"
            name="Visitors"
            stroke={palette.series[1]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: palette.series[1], stroke: palette.dotStroke, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
