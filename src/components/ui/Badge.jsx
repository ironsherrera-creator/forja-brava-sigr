const VARIANT_CLASSES = {
  neutral: 'bg-surface-muted text-coffee border-border',
  fire: 'bg-fire/12 text-fire border-fire/30',
  wood: 'bg-wood/12 text-wood border-wood/25',
  success: 'bg-success-bg text-success border-success-border',
  warning: 'bg-warning-bg text-warning border-warning-border',
  error: 'bg-error-bg text-error border-error-border',
  info: 'bg-info-bg text-info border-info-border',
};

export function Badge({
  children,
  variant = 'neutral',
  className = '',
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 border rounded-[var(--radius-xs)]',
        'text-[10px] font-bold uppercase tracking-[0.12em] whitespace-nowrap',
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
