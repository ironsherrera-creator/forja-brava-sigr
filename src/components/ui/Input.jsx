export function Input({
  id,
  error = false,
  className = '',
  ...props
}) {
  return (
    <input
      id={id}
      aria-invalid={Boolean(error) || undefined}
      className={[
        'w-full h-10 px-3 text-sm bg-surface-elevated text-text-primary',
        'border rounded-[var(--radius-sm)] transition-colors duration-150',
        'placeholder:text-text-muted/80',
        'disabled:bg-disabled-bg disabled:text-disabled-text disabled:cursor-not-allowed',
        error ? 'border-error' : 'border-border hover:border-border-strong focus:border-fire',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
