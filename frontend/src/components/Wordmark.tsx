import { cn } from '@/lib/cn';

interface WordmarkProps {
  className?: string;
  /** Hide the "Logly" text and render only the glyph (e.g. collapsed sidebar). */
  markOnly?: boolean;
}

/**
 * Logly logo — the activity/pulse glyph on an accent square (Design System brief).
 * `M22 12h-4l-3 9L9 3l-3 9H2` in bg-base on a #16C98A rounded square.
 */
export function Wordmark({ className, markOnly = false }: WordmarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-accent">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M22 12h-4l-3 9L9 3l-3 9H2"
            stroke="rgb(var(--c-bg-base))"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!markOnly && <span className="text-lg font-semibold tracking-tight text-fg">Logly</span>}
    </span>
  );
}
