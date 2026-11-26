import { Loader2 } from 'lucide-react';

const VARIANT_CLASSES = {
  primary:
    'bg-fire text-white border border-fire hover:bg-fire-hover hover:border-fire-hover',
  secondary:
    'bg-coffee text-cream border border-coffee hover:bg-wood hover:border-wood',
  outline:
    'bg-transparent text-text-primary border border-border-strong hover:bg-surface-muted',
  ghost:
    'bg-transparent text-text-primary border border-transparent hover:bg-surface-muted',
  danger:
    'bg-error text-white border border-error hover:opacity-90',
  dark:
    'bg-carbon text-cream border border-carbon hover:bg-coffee',
};

const SIZE_CLASSES = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-xs gap-2',
  lg: 'h-12 px-5 text-sm gap-2.5',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon = null,
  rightIcon = null,
  className = '',
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center font-semibold tracking-wider uppercase',
        'rounded-[var(--radius-sm)] transition-colors duration-150 cursor-pointer select-none',
        'disabled:opacity-55 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
      ) : (
        leftIcon && <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!loading && rightIcon && (
        <span className="shrink-0" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
}
