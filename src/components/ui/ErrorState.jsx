import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({
  title = 'No fue posible cargar esta sección',
  description = 'Verifica tu conexión e intenta nuevamente.',
  onRetry = null,
  retryLabel = 'Reintentar',
  className = '',
}) {
  return (
    <div
      role="alert"
      className={[
        'flex flex-col items-center justify-center text-center',
        'px-6 py-10 bg-error-bg/50 border border-error-border rounded-[var(--radius-sm)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AlertTriangle className="h-7 w-7 text-error mb-3" aria-hidden="true" />
      <h3 className="m-0 text-lg font-medium text-text-primary sigr-heading-display">
        {title}
      </h3>
      <p className="m-0 mt-1.5 max-w-md text-xs leading-relaxed text-text-secondary">
        {description}
      </p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
