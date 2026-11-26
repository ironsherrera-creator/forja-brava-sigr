import { Inbox } from 'lucide-react';

export function EmptyState({
  icon = null,
  title = 'Sin registros todavía',
  description = 'Cuando exista información disponible para esta sección aparecerá aquí.',
  action = null,
  className = '',
}) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        'px-6 py-12 bg-surface-elevated border border-dashed border-border rounded-[var(--radius-sm)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="h-12 w-12 rounded-full bg-surface-muted border border-border-subtle flex items-center justify-center text-wood mb-4"
        aria-hidden="true"
      >
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="m-0 text-xl font-medium text-text-primary sigr-heading-display">
        {title}
      </h3>
      <p className="m-0 mt-2 max-w-md text-xs leading-relaxed text-text-secondary">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
