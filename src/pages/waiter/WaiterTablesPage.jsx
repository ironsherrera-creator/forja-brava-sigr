import { useMemo, useState } from 'react';
import { Armchair, Clock, RefreshCw, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Tabs,
} from '../../components/ui';
import { useWaiterSalon } from '../../hooks/useWaiterSalon';
import { formatMoney } from '../../utils/formatMoney';

const STATUS_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'disponible', label: 'Disponibles' },
  { id: 'ocupada', label: 'Ocupadas' },
  { id: 'reservada', label: 'Reservadas' },
  { id: 'fuera_de_servicio', label: 'Fuera de servicio' },
];

function getTableStatusMeta(table) {
  if (!table.is_active || table.status === 'fuera_de_servicio') {
    return { label: 'Fuera de servicio', variant: 'error', key: 'fuera_de_servicio' };
  }
  if (table.status === 'ocupada') {
    return { label: 'Ocupada', variant: 'fire', key: 'ocupada' };
  }
  if (table.status === 'reservada') {
    return { label: 'Reservada', variant: 'warning', key: 'reservada' };
  }
  return { label: 'Disponible', variant: 'success', key: 'disponible' };
}

function formatElapsedMinutes(openedAt) {
  if (!openedAt) return null;
  const diffMs = Date.now() - new Date(openedAt).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return '0 min';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export function WaiterTablesPage() {
  const { tables, accounts, staffById, isLoading, error, reload } = useWaiterSalon();
  const [filter, setFilter] = useState('all');

  const accountByTableId = useMemo(
    () => new Map(accounts.map((a) => [a.table_id, a])),
    [accounts],
  );

  const visibleTables = useMemo(() => {
    if (filter === 'all') return tables;
    return tables.filter((t) => getTableStatusMeta(t).key === filter);
  }, [tables, filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 8 · MAPA DE SALÓN"
        title="Mapa de"
        accent="mesas."
        description="Consulta ocupación en tiempo real, saldo acumulado por cuenta (D-04) y abre el detalle de cada mesa."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Actualizar
          </Button>
        }
      />

      <Tabs
        tabs={STATUS_FILTERS}
        activeTab={filter}
        onChange={setFilter}
        ariaLabel="Filtrar mesas por estado"
      />

      {error ? (
        <ErrorState
          title="No fue posible cargar el mapa de mesas"
          description={error.message}
          onRetry={reload}
        />
      ) : isLoading ? (
        <LoadingState title="Cargando mesas del salón…" />
      ) : tables.length === 0 ? (
        <EmptyState
          icon={<Armchair className="h-5 w-5" />}
          title="Aún no hay mesas configuradas"
          description="El administrador debe registrar las mesas del restaurante desde /admin/mesas (inventario dinámico D-01). Cuando existan, aparecerán aquí automáticamente."
        />
      ) : visibleTables.length === 0 ? (
        <EmptyState
          icon={<Armchair className="h-5 w-5" />}
          title="Sin mesas en este estado"
          description="Cambia el filtro para visualizar el resto de las mesas del restaurante."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleTables.map((table) => {
            const meta = getTableStatusMeta(table);
            const activeAcc = accountByTableId.get(table.id);
            const elapsed = formatElapsedMinutes(activeAcc?.opened_at);
            const waiterName = activeAcc?.opened_by
              ? staffById.get(activeAcc.opened_by)?.visible_name || null
              : null;

            return (
              <Card key={table.id} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-wood">
                        {table.zone}
                      </span>
                      <h2 className="m-0 mt-0.5 text-2xl font-medium text-text-primary sigr-heading-display">
                        {table.code}
                      </h2>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                    <Users className="h-4 w-4 text-fire" aria-hidden="true" />
                    <span>
                      Capacidad: <strong className="text-text-primary">{table.capacity}</strong> pers.
                    </span>
                  </div>

                  {activeAcc ? (
                    <div className="mt-3 p-2.5 rounded-[var(--radius-xs)] bg-cream border border-border-subtle space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-text-secondary">Cuenta activa</span>
                        <Badge
                          variant={
                            activeAcc.status === 'closing_requested' ? 'warning' : 'info'
                          }
                        >
                          {activeAcc.status === 'closing_requested'
                            ? 'Cierre solicitado'
                            : 'Abierta'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-text-secondary">Acumulado</span>
                        <strong className="text-fire">
                          {formatMoney(activeAcc.total_amount)}
                        </strong>
                      </div>
                      {waiterName && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-text-secondary">Atiende</span>
                          <span className="font-medium text-text-primary">{waiterName}</span>
                        </div>
                      )}
                      {elapsed && (
                        <div className="flex items-center gap-1 text-[11px] text-text-muted">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>Ocupación: {elapsed}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="m-0 mt-3 text-xs text-text-muted">
                      Sin cuenta abierta actualmente.
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                  <Link
                    to={`/mesero/mesas/${table.id}`}
                    className="inline-flex items-center justify-center h-9 px-3 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
                  >
                    Ver detalle
                  </Link>
                  {table.is_active &&
                    table.status !== 'fuera_de_servicio' &&
                    activeAcc?.status !== 'closing_requested' && (
                      <Link
                        to={`/mesero/comandas/nueva?mesa=${table.id}`}
                        className="inline-flex items-center justify-center h-9 px-3 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
                      >
                        Comanda
                      </Link>
                    )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
