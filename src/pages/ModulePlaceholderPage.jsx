import { ArrowLeft, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge, Card, EmptyState } from '../components/ui';

export function ModulePlaceholderPage({
  eyebrow = 'FORJA BRAVA · SIGR',
  title,
  accent = '',
  description,
  stageTag = 'Estructura visual lista · Próxima etapa funcional',
  backTo = '/',
  backLabel = 'Volver al inicio del área',
  plannedItems = [],
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        accent={accent}
        description={description}
        badge={<Badge variant="wood">{stageTag}</Badge>}
        actions={
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{backLabel}</span>
          </Link>
        }
      />

      <EmptyState
        icon={<Layers className="h-5 w-5" />}
        title="Módulo preparado para integración operativa"
        description="La navegación, protección por rol y superficie visual de esta sección ya están integradas. Su lógica transaccional contra Supabase se conectará en la etapa funcional correspondiente."
      />

      {plannedItems.length > 0 && (
        <Card>
          <p className="m-0 mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-coffee">
            Alcance planificado del módulo
          </p>
          <ul className="m-0 p-0 list-none grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plannedItems.map((item) => (
              <li
                key={item}
                className="p-3.5 rounded-[var(--radius-xs)] bg-cream border border-border-subtle text-xs text-coffee leading-relaxed"
              >
                {item}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
