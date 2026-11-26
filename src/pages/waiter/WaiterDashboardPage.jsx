import { useMemo } from 'react';
import {
  Armchair,
  CheckCircle2,
  ClipboardList,
  PlusCircle,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useWaiterSalon } from '../../hooks/useWaiterSalon';
import { formatDateTimeBogota } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';
import { getOrderStatusBadgeVariant } from '../../utils/orderStatus';

export function WaiterDashboardPage() {
  const { profile } = useAuth();
  const { tables, accounts, orders, isLoading, error, reload } = useWaiterSalon();

  const metrics = useMemo(() => {
    const disponibles = tables.filter((t) => t.is_active && t.status === 'disponible').length;
    const ocupadas = tables.filter((t) => t.is_active && t.status === 'ocupada').length;
    const reservadas = tables.filter((t) => t.is_active && t.status === 'reservada').length;
    const fuera = tables.filter((t) => !t.is_active || t.status === 'fuera_de_servicio').length;
    const activeAccounts = accounts.length;
    const closingRequested = accounts.filter((a) => a.status === 'closing_requested').length;
    const readyToDeliver = orders.filter((o) => o.status === 'Listo');
    const pendingDelivery = orders.filter(
      (o) => !['Entregado', 'Cancelado'].includes(o.status),
    ).length;

    return {
      disponibles,
      ocupadas,
      reservadas,
      fuera,
      activeAccounts,
      closingRequested,
      totalOrders: orders.length,
      pendingDelivery,
      readyToDeliver,
    };
  }, [tables, accounts, orders]);

  const tableById = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 8 · SERVICIO EN SALÓN"
        title="Panel de"
        accent="mesero."
        description={`Hola, ${profile?.full_name || 'equipo de salón'}. Monitorea el estado real de mesas, cuentas acumuladas (D-04) y comandas en vivo.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Actualizar
            </Button>
            <Link
              to="/mesero/comandas/nueva"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              <span>Nueva comanda</span>
            </Link>
          </div>
        }
      />

      {error ? (
        <ErrorState
          title="No fue posible cargar el estado del salón"
          description={error.message}
          onRetry={reload}
        />
      ) : isLoading ? (
        <LoadingState title="Sincronizando mesas, cuentas y comandas…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Mesas disponibles
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-success sigr-heading-display">
                {metrics.disponibles}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Mesas ocupadas
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-fire sigr-heading-display">
                {metrics.ocupadas}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Mesas reservadas
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-warning sigr-heading-display">
                {metrics.reservadas}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Fuera de servicio
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-text-secondary sigr-heading-display">
                {metrics.fuera}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Cuentas activas
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-text-primary sigr-heading-display">
                {metrics.activeAccounts}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Cierres solicitados
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-wood sigr-heading-display">
                {metrics.closingRequested}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Pedidos registrados
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-text-primary sigr-heading-display">
                {metrics.totalOrders}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Pendientes de entrega
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-fire sigr-heading-display">
                {metrics.pendingDelivery}
              </p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display">
                  Pedidos listos para entregar
                </h2>
                <Link
                  to="/mesero/pedidos"
                  className="text-xs font-semibold text-fire hover:underline"
                >
                  Ver todos
                </Link>
              </div>
              {metrics.readyToDeliver.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  title="Sin pedidos pendientes en barra"
                  description="Cuando cocina marque una comanda como Lista aparecerá aquí para entrega inmediata."
                />
              ) : (
                <ul className="m-0 p-0 list-none space-y-2.5">
                  {metrics.readyToDeliver.slice(0, 6).map((ord) => {
                    const tbl = tableById.get(ord.table_id);
                    return (
                      <li
                        key={ord.id}
                        className="p-3 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm text-text-primary">
                              {ord.order_number}
                            </strong>
                            <Badge variant={getOrderStatusBadgeVariant(ord.status)}>
                              {ord.status}
                            </Badge>
                          </div>
                          <p className="m-0 mt-0.5 text-xs text-text-secondary">
                            Mesa {tbl?.code || '—'} · {formatDateTimeBogota(ord.created_at)}
                          </p>
                        </div>
                        <Link
                          to="/mesero/pedidos"
                          className="text-xs font-semibold text-fire hover:underline whitespace-nowrap"
                        >
                          Gestionar
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display">
                  Accesos rápidos de salón
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  to="/mesero/mesas"
                  className="p-4 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated hover:border-fire transition-colors block"
                >
                  <Armchair className="h-5 w-5 text-fire mb-2" aria-hidden="true" />
                  <strong className="block text-sm text-text-primary">Mapa de mesas</strong>
                  <span className="text-xs text-text-secondary">
                    Ver ocupación, saldos acumulados y abrir detalle.
                  </span>
                </Link>
                <Link
                  to="/mesero/comandas/nueva"
                  className="p-4 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated hover:border-fire transition-colors block"
                >
                  <PlusCircle className="h-5 w-5 text-fire mb-2" aria-hidden="true" />
                  <strong className="block text-sm text-text-primary">Tomar comanda</strong>
                  <span className="text-xs text-text-secondary">
                    Registrar productos, complementos y observaciones.
                  </span>
                </Link>
                <Link
                  to="/mesero/cuentas"
                  className="p-4 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated hover:border-fire transition-colors block"
                >
                  <Receipt className="h-5 w-5 text-fire mb-2" aria-hidden="true" />
                  <strong className="block text-sm text-text-primary">Cuentas activas</strong>
                  <span className="text-xs text-text-secondary">
                    Revisar consumos acumulados y solicitar cierres.
                  </span>
                </Link>
                <Link
                  to="/mesero/pedidos"
                  className="p-4 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated hover:border-fire transition-colors block"
                >
                  <ClipboardList className="h-5 w-5 text-fire mb-2" aria-hidden="true" />
                  <strong className="block text-sm text-text-primary">Pedidos de mesa</strong>
                  <span className="text-xs text-text-secondary">
                    Entregar comandas listas o cancelar pendientes.
                  </span>
                </Link>
              </div>
              {accounts.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border-subtle text-xs text-text-secondary flex items-center justify-between">
                  <span>Saldo acumulado en salón</span>
                  <strong className="text-sm text-fire">
                    {formatMoney(
                      accounts.reduce((sum, a) => sum + (Number(a.total_amount) || 0), 0),
                    )}
                  </strong>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
