import { useEffect, useState } from 'react';
import { ArrowLeft, Radar } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Card,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { fetchCustomerOrderDetail } from '../../services/orderService';
import { formatDateTimeBogota } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';
import { getOrderStatusBadgeVariant } from '../../utils/orderStatus';

export function ClientOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchCustomerOrderDetail(id).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setOrder(null);
      } else {
        setOrder(res.data);
        setError(null);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (isLoading) {
    return <LoadingState title="Cargando detalle del pedido…" />;
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Pedido no disponible"
          description={
            error?.message ||
            'No tienes acceso a este pedido o no existe en el sistema.'
          }
        />
        <Link
          to="/cliente/pedidos"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fire hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Volver a mis pedidos</span>
        </Link>
      </div>
    );
  }

  const latestPayment = order.payments?.[0] || null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="DETALLE HISTÓRICO DEL PEDIDO"
        title={order.order_number}
        description={`Registrado el ${formatDateTimeBogota(order.created_at)} · Los precios e ítems mostrados corresponden al snapshot histórico de compra.`}
        badge={
          <Badge variant={getOrderStatusBadgeVariant(order.status)}>
            {order.status}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/cliente/seguimiento/${order.id}`}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
            >
              <Radar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Seguimiento</span>
            </Link>
            <Link
              to="/cliente/pedidos"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Mis pedidos</span>
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
        <Card>
          <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display pb-3 border-b border-border-subtle">
            Productos (snapshot histórico)
          </h2>

          <ul className="m-0 p-0 list-none divide-y divide-border-subtle">
            {order.items.map((item) => {
              const addons = Array.isArray(item.addons_snapshot)
                ? item.addons_snapshot
                : [];
              return (
                <li key={item.id} className="py-3.5 flex justify-between gap-4 text-sm">
                  <div>
                    <p className="m-0 font-semibold text-text-primary">
                      {item.quantity} × {item.product_name_snapshot}
                    </p>
                    <p className="m-0 text-xs text-text-muted">
                      Precio unitario histórico: {formatMoney(item.unit_price_snapshot)}
                    </p>
                    {addons.length > 0 && (
                      <ul className="m-0 mt-1 p-0 list-none space-y-0.5">
                        {addons.map((a, idx) => (
                          <li key={a.id || idx} className="text-xs text-text-secondary">
                            + {a.name} ({formatMoney(a.price)})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <strong className="text-text-primary whitespace-nowrap">
                    {formatMoney(item.line_total)}
                  </strong>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 pt-4 border-t border-border-subtle space-y-1.5 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal</span>
              <span>{formatMoney(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Tarifa de domicilio</span>
              <span>{formatMoney(order.delivery_fee)}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-text-primary pt-2 border-t border-border-subtle">
              <span>Total</span>
              <span className="text-fire">{formatMoney(order.total)}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-3 text-xs">
            <h2 className="m-0 text-lg font-medium text-text-primary sigr-heading-display pb-2 border-b border-border-subtle">
              Entrega y pago
            </h2>
            <p className="m-0">
              <strong className="text-coffee">Modalidad:</strong>{' '}
              <span className="capitalize">{order.modality}</span>
            </p>
            {order.delivery_address && (
              <p className="m-0">
                <strong className="text-coffee">Dirección histórica:</strong>{' '}
                {order.delivery_address} · {order.delivery_neighborhood}
                {order.delivery_directions ? ` (${order.delivery_directions})` : ''}
              </p>
            )}
            {order.notes && (
              <p className="m-0">
                <strong className="text-coffee">Observaciones:</strong> {order.notes}
              </p>
            )}
            {latestPayment && (
              <div className="pt-2 border-t border-border-subtle space-y-1">
                <p className="m-0">
                  <strong className="text-coffee">Método:</strong> {latestPayment.method}
                </p>
                <p className="m-0">
                  <strong className="text-coffee">Estado pago:</strong> {latestPayment.status}
                </p>
                <p className="m-0">
                  <strong className="text-coffee">Referencia:</strong>{' '}
                  <code>{latestPayment.transaction_ref}</code>
                </p>
                <p className="m-0 text-[11px] text-text-muted">
                  {latestPayment.disclaimer}
                </p>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="m-0 text-lg font-medium text-text-primary sigr-heading-display pb-2 mb-3 border-b border-border-subtle">
              Historial de estados
            </h2>
            <ol className="m-0 p-0 list-none space-y-3">
              {order.history.map((entry) => (
                <li key={entry.id} className="border-l-2 border-fire pl-3 text-xs">
                  <strong className="text-text-primary">{entry.new_status}</strong>
                  <p className="m-0 text-text-muted">
                    {formatDateTimeBogota(entry.changed_at)}
                  </p>
                  {entry.reason && (
                    <p className="m-0 mt-0.5 text-text-secondary">{entry.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
