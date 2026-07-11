import { clsx } from 'clsx';

interface MetricCardProps {
  label: string;
  value: number;
  /** Percentage change vs previous period. Positive = growth, negative = decline. */
  delta?: number;
  format?: 'number' | 'percent';
  loading?: boolean;
}

function formatValue(value: number, format: 'number' | 'percent'): string {
  if (format === 'percent') {
    return `${value.toFixed(1)}%`;
  }
  // Format large numbers: 1234 → 1.2k, 1234567 → 1.2M
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString();
}

function DeltaBadge({ delta }: { delta: number }) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium',
        isNeutral && 'bg-white/[0.06] text-fg-muted',
        isPositive && 'bg-accent/15 text-accent',
        !isPositive && !isNeutral && 'bg-danger/15 text-danger',
      )}
    >
      {isNeutral ? '—' : isPositive ? '↑' : '↓'}
      {!isNeutral && `${Math.abs(delta).toFixed(1)}%`}
    </span>
  );
}

export default function MetricCard({ label, value, delta, format = 'number', loading = false }: MetricCardProps) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-line bg-surface p-5">
        <div className="mb-4 h-3 w-1/2 rounded bg-surface-hover" />
        <div className="h-8 w-2/3 rounded bg-surface-hover" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-fg-muted">{label}</p>
        {delta !== undefined && <DeltaBadge delta={delta} />}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-fg">{formatValue(value, format)}</p>
      {delta !== undefined && <p className="mt-1 text-xs text-fg-faint">vs yesterday</p>}
    </div>
  );
}
