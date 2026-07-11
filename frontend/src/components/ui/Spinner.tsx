import { cn } from '@/lib/cn';

interface SpinnerProps {
  className?: string;
  /** Diameter in px. Defaults to 16 (inline with body text). */
  size?: number;
  label?: string;
}

/** Indeterminate loading spinner. Uses the `lglspin` keyframe (0.7s linear). */
export function Spinner({ className, size = 16, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-block animate-lglspin rounded-full border-2 border-current border-t-transparent', className)}
      style={{ width: size, height: size }}
    />
  );
}
