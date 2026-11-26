import { Search, X } from 'lucide-react';

export function SearchInput({
  value = '',
  onChange,
  onClear,
  placeholder = 'Buscar…',
  ariaLabel = 'Buscar',
  className = '',
  ...props
}) {
  return (
    <div className={`relative flex items-center ${className}`.trim()}>
      <Search
        className="pointer-events-none absolute left-3 h-4 w-4 text-text-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full h-10 pl-9 pr-9 text-sm bg-surface-elevated text-text-primary border border-border rounded-[var(--radius-sm)] placeholder:text-text-muted/80 hover:border-border-strong focus:border-fire transition-colors"
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 p-1 text-text-muted hover:text-text-primary cursor-pointer bg-transparent border-0"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
