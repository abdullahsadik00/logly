import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Error message — sets the danger border and is announced to screen readers. */
  error?: string;
  hint?: ReactNode;
  leadingIcon?: ReactNode;
  /** Content pinned to the trailing edge (e.g. a show/hide password toggle). */
  trailing?: ReactNode;
}

/**
 * Token-driven text field. Border logic per the brief: error → danger,
 * else focus → accent, else neutral. Label + error are wired for a11y.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leadingIcon, trailing, id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-fg-secondary">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 text-fg-muted">{leadingIcon}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'w-full rounded-md bg-surface px-3 py-2 text-sm text-fg placeholder-fg-faint',
            'border transition-colors duration-fast ease-brand',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/40'
              : 'border-line-strong focus:border-accent focus:ring-accent/30',
            Boolean(leadingIcon) && 'pl-9',
            Boolean(trailing) && 'pr-10',
            className,
          )}
          {...rest}
        />
        {trailing && <span className="absolute right-2 flex items-center">{trailing}</span>}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
