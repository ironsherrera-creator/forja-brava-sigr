import { Loader2 } from 'lucide-react';

export function LoadingState({
  title = 'Cargando información…',
  description = 'Estamos preparando esta sección para ti.',
  className = '',
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`.trim()}
    >
      <Loader2 className="h-7 w-7 text-fire animate-spin mb-3" aria-hidden="true" />
      <p className="m-0 text-sm font-medium text-text-primary">{title}</p>
      {description && (
        <p className="m-0 mt-1 text-xs text-text-muted">{description}</p>
      )}
    </div>
  );
}
