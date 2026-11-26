export function FormField({
  id,
  label,
  hint = '',
  error = '',
  required = false,
  className = '',
  children,
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-coffee"
        >
          {label}
          {required && (
            <span className="ml-1 text-fire" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {hint && !error && (
        <p id={id ? `${id}-hint` : undefined} className="m-0 text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className="m-0 text-xs font-medium text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
