import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'warning' | 'info' | 'violet';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-white/[0.06] text-fg-secondary',
  accent: 'bg-accent/15 text-accent',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  violet: 'bg-violet/15 text-violet',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Render as a compact counter pill (mono, min-width) — e.g. alert counts. */
  count?: boolean;
}

/** Small status/counter pill. Numeric counters use mono + min-width. */
export function Badge({ tone = 'neutral', count = false, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full text-xs font-medium',
        count ? 'min-w-[18px] px-1.5 py-0.5 font-mono' : 'px-2 py-0.5',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
