function getInitials(name = '') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'FB';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
};

export function Avatar({
  name = '',
  src = '',
  size = 'md',
  className = '',
}) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar de usuario'}
        className={`${sizeClass} rounded-full object-cover border border-border shrink-0 ${className}`.trim()}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={[
        sizeClass,
        'inline-flex items-center justify-center rounded-full shrink-0',
        'bg-coffee text-cream border border-sand/40 font-semibold tracking-wider',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {getInitials(name)}
    </span>
  );
}
