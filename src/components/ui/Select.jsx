export function Select({
  id,
  options = [],
  placeholder = '',
  error = false,
  className = '',
  children,
  ...props
}) {
  return (
    <select
      id={id}
      aria-invalid={Boolean(error) || undefined}
      className={[
        'w-full h-10 px-3 text-sm bg-surface-elevated text-text-primary',
        'border rounded-[var(--radius-sm)] transition-colors duration-150',
        'disabled:bg-disabled-bg disabled:text-disabled-text disabled:cursor-not-allowed',
        error ? 'border-error' : 'border-border hover:border-border-strong focus:border-fire',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.length > 0
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
}
