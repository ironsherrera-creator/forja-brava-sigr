export function Textarea({
  id,
  rows = 3,
  error = false,
  className = '',
  ...props
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      aria-invalid={Boolean(error) || undefined}
      className={[
        'w-full px-3 py-2.5 text-sm bg-surface-elevated text-text-primary',
        'border rounded-[var(--radius-sm)] transition-colors duration-150 resize-y',
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
