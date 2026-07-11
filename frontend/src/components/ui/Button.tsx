import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  // Primary = light surface on dark (brief: bg #F2F4F7 → #FFF on hover)
  primary: 'bg-fg text-base hover:bg-white',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-hover',
  ghost: 'bg-transparent text-fg-secondary hover:bg-white/[0.06] hover:text-fg',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
  success: 'bg-accent text-accent-contrast hover:brightness-105',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-[11px] py-1.5 gap-1.5',
  md: 'text-[13px] px-3.5 py-2 gap-2',
  lg: 'text-sm px-[18px] py-[11px] gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/**
 * Token-driven button. Variants/sizes/states per the Design System brief:
 * default · focus (accent ring, from global :focus-visible) · pressed
 * (translateY 1px) · loading (inline spinner) · disabled (opacity .45).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, leadingIcon, trailingIcon, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',
        'transition-[background-color,color,transform,filter] duration-instant ease-brand',
        'active:translate-y-px disabled:opacity-disabled disabled:cursor-not-allowed disabled:active:translate-y-0',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === 'lg' ? 16 : 14} /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
});
