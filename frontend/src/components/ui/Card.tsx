import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a hover border lift — use for clickable cards. */
  interactive?: boolean;
}

/** Surface card — bg #141619, 1px border, 12px radius (brief). */
export function Card({ interactive = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface',
        interactive && 'transition-colors duration-fast ease-brand hover:border-line-strong',
        className,
      )}
      {...rest}
    />
  );
}
