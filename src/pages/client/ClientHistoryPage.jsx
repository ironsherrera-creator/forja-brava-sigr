import { useMemo, useState } from 'react';
import { ArrowUpRight, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Pagination,
  SearchInput,
  Select,
  Table,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useOrders } from '../../hooks/useOrders';
import { formatDateTimeBogota, getDateIsoBogota } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';
import { getOrderStatusBadgeVariant } from '../../utils/orderStatus';

const PAGE_SIZE = 8;

export function ClientHistoryPage() {
  const { user } = useAuth();
  const { orders, isLoading, error, reload } = useOrders(user?.id);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (
        search.trim() &&
        !String(order.order_number || '')
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      ) {
        return false;
      }
      if (dateFilter && getDateIsoBogota(order.created_at) !== dateFilter) {
        return false;
      }
      return true;
    });
  }, [orders, statusFilter, search, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const columns = [
    {
      key: 'order_number',
      header: 'Pedido',
      render: (row) => <strong className="text-text-primary">{row.order_number}</strong>,
    },
    {
      key: 'created_at',
      header: 'Fecha',
      render: (row) => (
        <span className="text-xs text-text-secondary">
          {formatDateTimeBogota(row.created_at)}
        </span>
      ),
    },
    {
      key: 'modality',
      header: 'Modalidad',
      render: (row) => <span className="capitalize text-xs">{row.modality}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={getOrderStatusBadgeVariant(row.status)}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total histórico',
      render: (row) => <strong>{formatMoney(row.total)}</strong>,
    },
    {
      key: 'actions',
      header: 'Detalle',
      render: (row) => (
        <Link
          to={`/cliente/pedidos/${row.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-fire hover:underline"
        >
          <span>Ver</span>
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ÁREA CLIENTE · HISTORIAL"
        title="Historial de"
        accent="compras."
        description="Consulta de solo lectura de tus pedidos anteriores con precios históricos preservados."
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-3 mb-5">
          <SearchInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearch('');
              setPage(1);
            }}
            placeholder="Buscar por número (ej. FB-2026…)"
            ariaLabel="Buscar en historial por número de pedido"
          />

          <Select
            aria-label="Filtrar historial por estado"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'Entregado', label: 'Entregado' },
              { value: 'Cancelado', label: 'Cancelado' },
              { value: 'Pendiente', label: 'Pendiente' },
            ]}
          />

          <Input
            type="date"
            aria-label="Filtrar por fecha"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {error ? (
          <ErrorState
            title="No fue posible cargar el historial"
            description={error.message}
            onRetry={reload}
          />
        ) : isLoading ? (
          <LoadingState title="Cargando historial de compras…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="Sin compras registradas con estos filtros"
            description="Tus pedidos completados y pasados aparecerán aquí para consulta."
          />
        ) : (
          <>
            <Table
              caption="Historial de compras del cliente"
              columns={columns}
              data={pageRows}
            />
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
