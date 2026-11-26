import { useState } from 'react';
import { ArrowUpRight, ClipboardList, Radar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Tabs,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useOrders } from '../../hooks/useOrders';
import { formatDateTimeBogota } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';
import { getOrderStatusBadgeVariant } from '../../utils/orderStatus';

const STATUS_TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'en_curso', label: 'En curso' },
  { id: 'entregados', label: 'Entregados' },
  { id: 'cancelados', label: 'Cancelados' },
];

export function ClientOrdersPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const { orders, isLoading, error, reload } = useOrders(user?.id, {
    statusFilter,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ÁREA CLIENTE · MIS PEDIDOS"
        title="Tus"
        accent="pedidos."
        description="Consulta el estado real, el pago y el detalle histórico de cada orden realizada."
        actions={
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
          >
            <span>Nuevo pedido</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      />

      <Tabs
        tabs={STATUS_TABS}
        activeId={statusFilter}
        onChange={setStatusFilter}
        ariaLabel="Filtrar pedidos por estado"
      />

      {error ? (
        <ErrorState
          title="No fue posible consultar tus pedidos"
          description={error.message}
          onRetry={reload}
        />
      ) : isLoading ? (
        <LoadingState title="Cargando tus pedidos…" />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No hay pedidos en esta categoría"
          description="Cuando realices un pedido en FORJA BRAVA aparecerá aquí con su estado actualizado."
          action={
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
            >
              Explorar menú
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-base text-text-primary sigr-heading-display">
                      {order.order_number}
                    </strong>
                    <Badge variant={getOrderStatusBadgeVariant(order.status)}>
                      {order.status}
                    </Badge>
                    <Badge variant="neutral">{order.payment_status}</Badge>
                  </div>
                  <p className="m-0 text-xs text-text-secondary">
                    {formatDateTimeBogota(order.created_at)} · Modalidad:{' '}
                    <span className="capitalize font-medium">{order.modality}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <strong className="text-lg text-coffee">
                    {formatMoney(order.total)}
                  </strong>
                  <Link
                    to={`/cliente/seguimiento/${order.id}`}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
                  >
                    <Radar className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
                    <span>Seguir</span>
                  </Link>
                  <Link
                    to={`/cliente/pedidos/${order.id}`}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-sm)] bg-coffee text-cream text-xs font-semibold uppercase tracking-wider hover:bg-wood transition-colors"
                  >
                    <span>Ver detalle</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
