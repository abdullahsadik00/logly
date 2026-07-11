import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Calm zero-state: a small bordered icon tile in a dashed card (Design System brief). */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-line text-fg-muted">
          <Icon size={18} strokeWidth={1.75} />
        </span>
      )}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
