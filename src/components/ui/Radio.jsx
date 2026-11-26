export function Radio({
  id,
  name,
  label,
  description = '',
  className = '',
  ...props
}) {
  return (
    <label
      htmlFor={id}
      className={`inline-flex items-start gap-2.5 cursor-pointer select-none ${className}`.trim()}
    >
      <input
        id={id}
        name={name}
        type="radio"
        className="mt-0.5 h-4 w-4 accent-fire cursor-pointer"
        {...props}
      />
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm font-medium text-text-primary">{label}</span>}
          {description && <span className="text-xs text-text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}
