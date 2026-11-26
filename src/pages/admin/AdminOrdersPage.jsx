import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Eye, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  Modal,
  SearchInput,
  Select,
  Table,
  Textarea,
} from '../../components/ui';
import {
  adminRefundOrderPayment,
  adminTransitionOrderStatus,
  fetchAdminOrders,
  getAllowedAdminNextStatuses,
  getOrderRefundSummary,
} from '../../services/adminOrdersService';
import { formatDateTimeBogota } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';
import { getOrderStatusBadgeVariant } from '../../utils/orderStatus';

export function AdminOrdersPage() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('estado') || 'all';

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [modalityFilter, setModalityFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [detailOrder, setDetailOrder] = useState(null);
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchAdminOrders({
      status: statusFilter,
      modality: modalityFilter,
    });
    if (res.error) setError(res.error);
    else {
      setOrders(res.data);
      setError(null);
    }
    setIsLoading(false);
  }, [statusFilter, modalityFilter]);

  useEffect(() => {
    let active = true;
    fetchAdminOrders({ status: statusFilter, modality: modalityFilter }).then(
      (res) => {
        if (!active) return;
        if (res.error) setError(res.error);
        else {
          setOrders(res.data);
          setError(null);
        }
        setIsLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [statusFilter, modalityFilter]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        String(o.order_number || '').toLowerCase().includes(q) ||
        String(o.customer_name || '').toLowerCase().includes(q),
    );
  }, [orders, search]);

  const handleTransition = async (order, nextStatus) => {
    setBusyId(order.id);
    setActionError('');
    setActionSuccess('');
    try {
      const reason =
        nextStatus === 'Cancelado'
          ? 'Cancelado desde panel administrativo'
          : `Avance operativo a ${nextStatus}`;
      const res = await adminTransitionOrderStatus(order.id, nextStatus, reason);
      if (res.error) {
        setActionError(res.error.message);
      } else {
        setActionSuccess(
          `Pedido ${order.order_number} actualizado a "${nextStatus}".`,
        );
        load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const openRefundModal = (order) => {
    setRefundOrder(order);
    setRefundReason('');
    setRefundError('');
  };

  const handleConfirmRefund = async (event) => {
    event.preventDefault();
    if (!refundOrder) return;
    setRefundBusy(true);
    setRefundError('');
    setActionError('');
    setActionSuccess('');
    try {
      const res = await adminRefundOrderPayment(refundOrder.id, refundReason);
      if (res.error) {
        setRefundError(res.error.message);
        return;
      }
      setActionSuccess(
        `Reembolso registrado para el pedido ${refundOrder.order_number} por ${formatMoney(res.data?.amount ?? refundOrder.total)}.`,
      );
      setRefundOrder(null);
      setDetailOrder(null);
      load();
    } finally {
      setRefundBusy(false);
    }
  };

  const refundSummary = useMemo(
    () => (refundOrder ? getOrderRefundSummary(refundOrder) : null),
    [refundOrder],
  );

  const columns = [
    {
      key: 'order_number',
      header: 'Pedido',
      render: (row) => (
        <div>
          <strong className="text-text-primary">{row.order_number}</strong>
          <p className="m-0 text-[11px] text-text-muted">
            {formatDateTimeBogota(row.created_at)}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente / Modalidad',
      render: (row) => (
        <div>
          <span className="text-xs font-medium text-text-primary">
            {row.customer_name}
          </span>
          <p className="m-0 text-[11px] text-text-muted capitalize">
            {row.modality}
          </p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total / Pago',
      render: (row) => (
        <div>
          <strong className="text-fire">{formatMoney(row.total)}</strong>
          <p className="m-0 text-[11px] text-text-muted">{row.payment_status}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={getOrderStatusBadgeVariant(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Gestión',
      render: (row) => {
        const nextStatuses = getAllowedAdminNextStatuses(row);
        const rSummary = getOrderRefundSummary(row);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDetailOrder(row)}
              leftIcon={<Eye className="h-3.5 w-3.5" />}
            >
              Detalle
            </Button>
            {nextStatuses.map((st) => (
              <Button
                key={st}
                size="sm"
                variant={st === 'Cancelado' ? 'outline' : 'secondary'}
                loading={busyId === row.id}
                onClick={() => handleTransition(row, st)}
              >
                {st}
              </Button>
            ))}
            {rSummary.canRefund && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => openRefundModal(row)}
                leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              >
                Reembolsar pago
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 9 · OPERACIÓN"
        title="Gestión de"
        accent="pedidos."
        description="Control centralizado de estados de preparación, despacho, entrega y cancelación trazable vía RPC update_order_status."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Actualizar
          </Button>
        }
      />

      {actionError && (
        <div className="auth-alert auth-alert-error" role="alert">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="auth-alert auth-alert-success" role="status">
          {actionSuccess}
        </div>
      )}

      <Card>
        <div className="grid gap-3 md:grid-cols-3 mb-5">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar número o cliente…"
            ariaLabel="Buscar pedidos administrativos"
          />
          <Select
            aria-label="Filtrar por modalidad"
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Todas las modalidades' },
              { value: 'domicilio', label: 'Domicilio' },
              { value: 'recoger', label: 'Recoger' },
              { value: 'mesa', label: 'Mesa' },
            ]}
          />
          <Select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'Pendiente', label: 'Pendiente' },
              { value: 'Confirmado', label: 'Confirmado' },
              { value: 'En preparación', label: 'En preparación' },
              { value: 'Listo', label: 'Listo' },
              { value: 'Despachado', label: 'Despachado' },
              { value: 'Entregado', label: 'Entregado' },
              { value: 'Cancelado', label: 'Cancelado' },
            ]}
          />
        </div>

        {error ? (
          <ErrorState
            title="No fue posible cargar los pedidos"
            description={error.message}
            onRetry={load}
          />
        ) : isLoading ? (
          <LoadingState title="Cargando pedidos del restaurante…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="Sin pedidos para los filtros actuales"
            description="Ajusta el estado o modalidad para consultar otras órdenes."
          />
        ) : (
          <Table caption="Listado administrativo de pedidos" columns={columns} data={visible} />
        )}
      </Card>

      <Modal
        open={Boolean(detailOrder)}
        onClose={() => setDetailOrder(null)}
        title={`Pedido ${detailOrder?.order_number || ''}`}
        description={`Modalidad: ${detailOrder?.modality || ''} · Estado: ${detailOrder?.status || ''}`}
        size="lg"
      >
        {detailOrder && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-[var(--radius-sm)] bg-cream border border-border-subtle space-y-1">
              <p className="m-0">
                <strong>Cliente:</strong> {detailOrder.customer_name}
              </p>
              {detailOrder.delivery_address && (
                <p className="m-0">
                  <strong>Dirección:</strong> {detailOrder.delivery_address} ·{' '}
                  {detailOrder.delivery_neighborhood}
                </p>
              )}
              <p className="m-0">
                <strong>Pago:</strong> {detailOrder.payment_status} ·{' '}
                <strong className="text-fire">{formatMoney(detailOrder.total)}</strong>
              </p>
              {getOrderRefundSummary(detailOrder).canRefund && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => openRefundModal(detailOrder)}
                    leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    Reembolsar pago confirmado
                  </Button>
                </div>
              )}
            </div>

            <div>
              <h3 className="m-0 mb-2 text-sm font-semibold text-text-primary">
                Productos (snapshots históricos)
              </h3>
              <ul className="m-0 p-0 list-none space-y-1.5">
                {(detailOrder.order_items ?? []).map((item) => (
                  <li key={item.id} className="flex justify-between border-b border-border-subtle/50 pb-1">
                    <span>
                      {item.quantity} × {item.product_name_snapshot}
                    </span>
                    <strong>{formatMoney(item.line_total)}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="m-0 mb-2 text-sm font-semibold text-text-primary">
                Historial de estados
              </h3>
              <ul className="m-0 p-0 list-none space-y-1">
                {(detailOrder.order_status_history ?? []).map((h) => (
                  <li key={h.id} className="text-text-secondary">
                    <strong>{h.new_status}</strong> · {formatDateTimeBogota(h.changed_at)}
                    {h.reason ? ` — ${h.reason}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(refundOrder)}
        onClose={() => setRefundOrder(null)}
        title={`Reembolsar pago · ${refundOrder?.order_number || ''}`}
        description="Revisión financiera previa y confirmación explícita vía RPC refund_order_payment."
        size="lg"
      >
        {refundOrder && refundSummary && (
          <form onSubmit={handleConfirmRefund} noValidate className="space-y-4 text-xs">
            {refundError && (
              <div className="auth-alert auth-alert-error" role="alert">
                {refundError}
              </div>
            )}

            <dl className="grid gap-3 sm:grid-cols-2 p-3.5 rounded-[var(--radius-sm)] bg-cream border border-border-subtle">
              <div>
                <dt className="text-text-muted">Pedido / Estado</dt>
                <dd className="m-0 font-semibold text-text-primary">
                  {refundOrder.order_number} · {refundOrder.status}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Referencia de pago original</dt>
                <dd className="m-0 font-semibold text-text-primary">
                  {refundSummary.transactionRef}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Método de pago / Estado</dt>
                <dd className="m-0 font-semibold text-text-primary">
                  {refundSummary.paymentMethod} · {refundSummary.paymentStatus}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Importe pagado original</dt>
                <dd className="m-0 font-bold text-text-primary">
                  {formatMoney(refundSummary.paidAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Importe ya reembolsado</dt>
                <dd className="m-0 font-semibold text-text-secondary">
                  {formatMoney(refundSummary.refundedAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Saldo reembolsable</dt>
                <dd className="m-0 font-bold text-sm text-fire">
                  {formatMoney(refundSummary.refundableBalance)}
                </dd>
              </div>
            </dl>

            <div className="p-3 rounded-[var(--radius-sm)] bg-warning-bg border border-warning-border text-warning flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              {refundSummary.paymentMethod === 'Efectivo' ? (
                <span>
                  <strong>Impacto en liquidez física (Efectivo):</strong> este reembolso descuenta{' '}
                  {formatMoney(refundSummary.refundableBalance)} del efectivo físico esperado en la
                  sesión de caja abierta. Si no hay efectivo suficiente en turno, la operación será
                  rechazada.
                </span>
              ) : (
                <span>
                  <strong>Pago digital simulado ({refundSummary.paymentMethod}):</strong> esta
                  operación asienta el movimiento contable de reembolso en SIGR y reduce las ventas
                  digitales netas, pero <strong>no ejecuta una reversión bancaria real</strong> en
                  una entidad financiera externa.
                </span>
              )}
            </div>

            <FormField
              id="refund-reason"
              label="Motivo obligatorio del reembolso (auditoría)"
              required
            >
              <Textarea
                id="refund-reason"
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Ej. Pedido cancelado por agotamiento de insumo tras confirmación de pago"
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
              <Button
                variant="outline"
                onClick={() => setRefundOrder(null)}
                disabled={refundBusy}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="danger"
                loading={refundBusy}
                disabled={refundReason.trim().length < 4}
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                Confirmar reembolso
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
