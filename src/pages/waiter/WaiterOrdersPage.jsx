import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, RefreshCw, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  SearchInput,
  Select,
  Table,
} from '../../components/ui';
import { useWaiterSalon } from '../../hooks/useWaiterSalon';
import { updateWaiterOrderStatus } from '../../services/waiterService';
import { formatDateTimeBogota, getDateIsoBogota } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';
import { getOrderStatusBadgeVariant } from '../../utils/orderStatus';

export function WaiterOrdersPage({ historyOnly = false }) {
  const { tables, orders, isLoading, error, reload } = useWaiterSalon();

  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const [busyId, setBusyId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const tableById = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (historyOnly && !['Entregado', 'Cancelado'].includes(o.status)) return false;
      if (tableFilter !== 'all' && o.table_id !== tableFilter) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (dateFilter && getDateIsoBogota(o.created_at) !== dateFilter) return false;
      if (q && !String(o.order_number || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, historyOnly, tableFilter, statusFilter, dateFilter, search]);

  const handleDeliver = async (order) => {
    setBusyId(order.id);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await updateWaiterOrderStatus(
        order.id,
        'Entregado',
        'Entregado en mesa por mesero',
      );
      if (res.error) {
        setActionError(res.error.message);
      } else {
        setActionSuccess(`Pedido ${order.order_number} marcado como Entregado.`);
        reload();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setBusyId(cancelTarget.id);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await updateWaiterOrderStatus(
        cancelTarget.id,
        'Cancelado',
        'Cancelado en estado Pendiente por mesero',
      );
      if (res.error) {
        setActionError(res.error.message);
      } else {
        setActionSuccess(`Pedido ${cancelTarget.order_number} cancelado correctamente.`);
        reload();
      }
      setCancelTarget(null);
    } finally {
      setBusyId(null);
    }
  };

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
      key: 'table',
      header: 'Mesa',
      render: (row) => {
        const tbl = tableById.get(row.table_id);
        return (
          <span className="text-xs font-semibold">
            {tbl ? `${tbl.code} (${tbl.zone})` : '—'}
          </span>
        );
      },
    },
    {
      key: 'items',
      header: 'Productos',
      render: (row) => (
        <span className="text-xs text-text-secondary">
          {(row.order_items ?? [])
            .map((i) => `${i.quantity}× ${i.product_name_snapshot}`)
            .join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (row) => <strong className="text-fire">{formatMoney(row.total)}</strong>,
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
      header: 'Acciones (D-05)',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.status === 'Listo' && (
            <Button
              size="sm"
              loading={busyId === row.id}
              onClick={() => handleDeliver(row)}
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Entregar
            </Button>
          )}
          {row.status === 'Pendiente' && (
            <Button
              size="sm"
              variant="outline"
              loading={busyId === row.id}
              onClick={() => setCancelTarget(row)}
              leftIcon={<XCircle className="h-3.5 w-3.5 text-error" />}
            >
              Cancelar
            </Button>
          )}
          {row.status !== 'Listo' && row.status !== 'Pendiente' && (
            <span className="text-[11px] text-text-muted">Sin acción de salón</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={historyOnly ? 'ETAPA 8 · HISTORIAL DE SALÓN' : 'ETAPA 8 · PEDIDOS EN MESA'}
        title={historyOnly ? 'Historial de' : 'Pedidos'}
        accent={historyOnly ? 'servicio.' : 'registrados.'}
        description="Regla D-05: el mesero puede marcar como Entregado únicamente pedidos Listos y cancelar pedidos recién registrados en estado Pendiente."
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
        <div className="grid gap-3 md:grid-cols-4 mb-5">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar número de pedido…"
            ariaLabel="Buscar pedido de mesa"
          />

          <Select
            aria-label="Filtrar por mesa"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Todas las mesas' },
              ...tables.map((t) => ({ value: t.id, label: `${t.code} (${t.zone})` })),
            ]}
          />

          <Select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={
              historyOnly
                ? [
                    { value: 'all', label: 'Todos los finalizados' },
                    { value: 'Entregado', label: 'Entregado' },
                    { value: 'Cancelado', label: 'Cancelado' },
                  ]
                : [
                    { value: 'all', label: 'Todos los estados' },
                    { value: 'Pendiente', label: 'Pendiente' },
                    { value: 'Confirmado', label: 'Confirmado' },
                    { value: 'En preparación', label: 'En preparación' },
                    { value: 'Listo', label: 'Listo' },
                    { value: 'Entregado', label: 'Entregado' },
                    { value: 'Cancelado', label: 'Cancelado' },
                  ]
            }
          />

          <Input
            type="date"
            aria-label="Filtrar por fecha"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        {error ? (
          <ErrorState
            title="No fue posible cargar los pedidos de mesa"
            description={error.message}
            onRetry={reload}
          />
        ) : isLoading ? (
          <LoadingState title="Cargando comandas de salón…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No hay pedidos con los filtros seleccionados"
            description="Las comandas registradas en salón aparecerán aquí."
          />
        ) : (
          <Table
            caption="Pedidos registrados en salón"
            columns={columns}
            data={filtered}
          />
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        loading={Boolean(busyId)}
        title={`Cancelar pedido ${cancelTarget?.order_number || ''}`}
        description="Solo se cancelan comandas en estado Pendiente. El saldo de la cuenta de mesa se recalculará automáticamente."
        confirmLabel="Confirmar cancelación"
      />
    </div>
  );
}
