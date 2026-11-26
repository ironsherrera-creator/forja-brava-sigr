const VARIANT_CLASSES = {
  ghost:
    'bg-transparent text-text-primary hover:bg-surface-muted border border-transparent',
  outline:
    'bg-surface-elevated text-text-primary hover:bg-surface-muted border border-border',
  primary:
    'bg-fire text-white hover:bg-fire-hover border border-fire',
  dark:
    'bg-transparent text-cream hover:bg-white/10 border border-white/15',
};

const SIZE_CLASSES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
};

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={[
        'inline-flex items-center justify-center rounded-[var(--radius-sm)]',
        'transition-colors duration-150 cursor-pointer shrink-0',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.ghost,
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {icon}
    </button>
  );
}
