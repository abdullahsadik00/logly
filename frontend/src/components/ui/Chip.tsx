import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  leadingIcon?: ReactNode;
  /** When set, renders a × affordance and calls this instead of navigating. */
  onRemove?: () => void;
}

/**
 * Filter / selection chip (7px radius). Selected = accent tint + border.
 * A removable chip renders a × button (used as an ExplorationState filter chip).
 */
export function Chip({ selected = false, leadingIcon, onRemove, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-fast ease-brand',
        selected
          ? 'border-accent/35 bg-accent/10 text-accent'
          : 'border-line bg-surface text-fg-secondary hover:border-line-strong',
      )}
    >
      {leadingIcon}
      <button type="button" className={cn('inline-flex items-center gap-1.5', className)} {...rest}>
        {children}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="-mr-0.5 ml-0.5 rounded-sm opacity-70 transition-opacity hover:opacity-100"
        >
          ×
        </button>
      )}
    </span>
  );
}
