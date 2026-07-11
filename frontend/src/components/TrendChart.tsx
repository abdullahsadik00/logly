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
    <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl px-3 py-2 text-sm">
      <p className="text-slate-400 mb-1.5">{formatXAxisDate(label as string)}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-300 capitalize">{entry.name}:</span>
          <span className="text-white font-semibold">
            {formatLargeNumber(entry.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TrendChart({ data, days, loading = false }: TrendChartProps) {
  if (loading) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 h-72 flex items-center justify-center">
        <div className="w-full h-full animate-pulse bg-slate-700/40 rounded-lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 h-72 flex items-center justify-center">
        <p className="text-slate-500 text-sm">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <p className="text-sm font-medium text-slate-400 mb-4">
        Traffic trend — last {days} days
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxisDate}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={days > 14 ? 4 : 1}
          />
          <YAxis
            tickFormatter={formatLargeNumber}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#94a3b8', paddingTop: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="views"
            name="Views"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1', stroke: '#0f172a', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="visitors"
            name="Visitors"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
