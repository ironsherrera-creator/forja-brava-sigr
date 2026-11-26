import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Radar, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
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
import { useOrders } from '../../hooks/useOrders';
import { fetchCustomerOrderDetail } from '../../services/orderService';
import { subscribeToCustomerOrder } from '../../services/orderTrackingService';
import { formatDateTimeBogota } from '../../utils/formatDate';
import { getOrderStatusBadgeVariant } from '../../utils/orderStatus';

const ORDER_STEPS = [
  'Pendiente',
  'Confirmado',
  'En preparación',
  'Listo',
  'Despachado',
  'Entregado',
];

export function ClientTrackingPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { orders, isLoading: listLoading } = useOrders(user?.id);

  const targetOrderId = id || orders[0]?.id || null;

  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDetail = useCallback(async (orderId, showSpinner = false) => {
    if (!orderId) return;
    if (showSpinner) setRefreshing(true);
    const res = await fetchCustomerOrderDetail(orderId);
    if (res.error) {
      setError(res.error);
      setDetail(null);
    } else {
      setDetail(res.data);
      setError(null);
    }
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!targetOrderId) return undefined;

    let active = true;
    fetchCustomerOrderDetail(targetOrderId).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setDetail(null);
      } else {
        setDetail(res.data);
        setError(null);
      }
      setIsLoading(false);
    });

    const unsubscribe = subscribeToCustomerOrder(targetOrderId, () => {
      loadDetail(targetOrderId, false);
    });

    // Polling controlado de respaldo cada 20 s si Realtime no entrega evento
    const poll = setInterval(() => {
      loadDetail(targetOrderId, false);
    }, 20000);

    return () => {
      active = false;
      unsubscribe();
      clearInterval(poll);
    };
  }, [targetOrderId, loadDetail]);

  if ((isLoading || listLoading) && !detail) {
    return <LoadingState title="Cargando seguimiento en vivo…" />;
  }

  if (!targetOrderId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="ÁREA CLIENTE · TIEMPO REAL"
          title="Seguimiento"
          accent="en vivo."
          description="Visualiza el avance de tu pedido en tiempo real."
        />
        <EmptyState
          icon={<Radar className="h-5 w-5" />}
          title="No tienes pedidos para seguir todavía"
          description="Cuando confirmes un pedido podrás consultar aquí cada cambio de estado."
          action={
            <Link
              to="/menu"
              className="inline-flex items-center h-10 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
            >
              Explorar menú
            </Link>
          }
        />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <ErrorState
        title="No pudimos consultar el seguimiento"
        description={error?.message || 'El pedido no existe o no pertenece a tu cuenta.'}
        onRetry={() => loadDetail(targetOrderId, true)}
      />
    );
  }

  const visibleSteps =
    detail.modality === 'domicilio'
      ? ORDER_STEPS
      : ORDER_STEPS.filter((s) => s !== 'Despachado');
  const currentStepIndex = visibleSteps.indexOf(detail.status);
  const isCancelled = detail.status === 'Cancelado';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SEGUIMIENTO DE PEDIDO"
        title={detail.order_number}
        description={`Última actualización: ${formatDateTimeBogota(detail.updated_at)}`}
        badge={
          <Badge variant={getOrderStatusBadgeVariant(detail.status)}>
            {detail.status}
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            loading={refreshing}
            onClick={() => loadDetail(targetOrderId, true)}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Actualizar
          </Button>
        }
      />

      {isCancelled ? (
        <Card className="!border-error-border !bg-error-bg/25">
          <p className="m-0 text-sm font-semibold text-error">
            Este pedido fue cancelado.
          </p>
        </Card>
      ) : (
        <Card>
          <p className="m-0 mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-coffee">
            Progreso confirmado del pedido
          </p>
          <ol className="m-0 p-0 list-none grid gap-3 sm:grid-cols-5">
            {visibleSteps.map((step, idx) => {
              const reached = currentStepIndex >= idx;
              return (
                <li
                  key={step}
                  className={[
                    'p-3 rounded-[var(--radius-sm)] border text-xs flex items-center gap-2',
                    reached
                      ? 'border-fire bg-fire/10 text-text-primary font-semibold'
                      : 'border-border-subtle bg-surface-elevated text-text-muted',
                  ].join(' ')}
                >
                  {reached ? (
                    <CheckCircle2 className="h-4 w-4 text-fire shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{step}</span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <Card>
        <h2 className="m-0 text-lg font-medium text-text-primary sigr-heading-display pb-2 mb-4 border-b border-border-subtle">
          Bitácora oficial de estados (`order_status_history`)
        </h2>
        <ol className="m-0 p-0 list-none space-y-3">
          {detail.history.map((h) => (
            <li key={h.id} className="border-l-2 border-fire pl-3.5 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-text-primary">{h.new_status}</strong>
                <span className="text-text-muted">
                  {formatDateTimeBogota(h.changed_at)}
                </span>
              </div>
              {h.reason && (
                <p className="m-0 mt-0.5 text-text-secondary">{h.reason}</p>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
