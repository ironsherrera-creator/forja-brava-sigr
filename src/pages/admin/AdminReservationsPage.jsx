import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, RefreshCw, Shuffle, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Modal,
  SearchInput,
  Select,
  Table,
} from '../../components/ui';
import { useTables } from '../../hooks/useTables';
import {
  adminUpdateReservation,
  fetchAdminReservations,
} from '../../services/reservationService';
import { formatDateTimeBogota, formatTimeBogota } from '../../utils/formatDate';

function statusBadgeVariant(status) {
  switch (status) {
    case 'Confirmada':
      return 'success';
    case 'Atendida':
      return 'info';
    case 'Cancelada':
      return 'error';
    default:
      return 'warning';
  }
}

export function AdminReservationsPage() {
  const { tables } = useTables();
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const [reassignTarget, setReassignTarget] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    fetchAdminReservations({
      date: dateFilter,
      status: statusFilter,
      search,
    }).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
      } else {
        setReservations(res.data);
        setError(null);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [dateFilter, statusFilter, search, reloadToken]);

  const handleStatusChange = async (resRow, newStatus) => {
    setActionError('');
    setActionSuccess('');
    const result = await adminUpdateReservation({
      reservationId: resRow.id,
      newStatus,
    });
    if (result.error) {
      setActionError(result.error.message);
      return;
    }
    setActionSuccess(`Reserva ${resRow.reservation_code} actualizada a "${newStatus}".`);
    reload();
  };

  const openReassign = (resRow) => {
    setReassignTarget(resRow);
    setSelectedTableId(resRow.table_id || '');
    setActionError('');
  };

  const handleConfirmReassign = async (event) => {
    event.preventDefault();
    if (!reassignTarget || !selectedTableId) return;
    setReassigning(true);
    setActionError('');
    setActionSuccess('');
    try {
      const result = await adminUpdateReservation({
        reservationId: reassignTarget.id,
        newTableId: selectedTableId,
      });
      if (result.error) {
        setActionError(result.error.message);
        return;
      }
      setReassignTarget(null);
      setActionSuccess(
        `Mesa reasignada correctamente para la reserva ${reassignTarget.reservation_code}.`,
      );
      reload();
    } finally {
      setReassigning(false);
    }
  };

  const eligibleTables = reassignTarget
    ? tables.filter(
        (t) => t.is_active && t.status !== 'fuera_de_servicio',
      )
    : [];

  const columns = [
    {
      key: 'code',
      header: 'Reserva',
      render: (row) => (
        <div>
          <strong className="text-text-primary">{row.reservation_code}</strong>
          <p className="m-0 text-xs text-text-secondary">{row.customer_name}</p>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Horario (Bogotá)',
      render: (row) => (
        <span className="text-xs text-text-primary whitespace-nowrap">
          {formatDateTimeBogota(row.start_at)} – {formatTimeBogota(row.end_at)}
        </span>
      ),
    },
    {
      key: 'party_size',
      header: 'Personas',
      render: (row) => <span className="text-xs font-semibold">{row.party_size}</span>,
    },
    {
      key: 'table',
      header: 'Mesa',
      render: (row) => {
        const tbl = Array.isArray(row.restaurant_tables)
          ? row.restaurant_tables[0]
          : row.restaurant_tables;
        return tbl ? (
          <span className="text-xs font-medium">
            {tbl.code} ({tbl.zone} · {tbl.capacity}p)
          </span>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        );
      },
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.status === 'Pendiente' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange(row, 'Confirmada')}
            >
              Confirmar
            </Button>
          )}
          {row.status === 'Confirmada' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange(row, 'Atendida')}
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />}
            >
              Atendida
            </Button>
          )}
          {(row.status === 'Pendiente' || row.status === 'Confirmada') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openReassign(row)}
                leftIcon={<Shuffle className="h-3.5 w-3.5 text-wood" />}
              >
                Mesa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleStatusChange(row, 'Cancelada')}
                leftIcon={<XCircle className="h-3.5 w-3.5 text-error" />}
              >
                Cancelar
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 7 · ADMINISTRACIÓN DE RESERVAS"
        title="Gestión de"
        accent="reservas."
        description="Consulta reservas, confirma, registra asistencia, cancela o reasigna mesas validando capacidad y ausencia de solapamientos en PostgreSQL."
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
        <div className="grid gap-3 md:grid-cols-3 mb-5">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar cliente, código o teléfono…"
            ariaLabel="Buscar reservas"
          />

          <Input
            type="date"
            aria-label="Filtrar reservas por fecha"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />

          <Select
            aria-label="Filtrar reservas por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'Pendiente', label: 'Pendiente' },
              { value: 'Confirmada', label: 'Confirmada' },
              { value: 'Atendida', label: 'Atendida' },
              { value: 'Cancelada', label: 'Cancelada' },
            ]}
          />
        </div>

        {error ? (
          <ErrorState
            title="No fue posible cargar las reservas"
            description={error.message}
            onRetry={reload}
          />
        ) : isLoading ? (
          <LoadingState title="Cargando reservas…" />
        ) : reservations.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" />}
            title="Sin reservas para los filtros actuales"
            description="Ajusta la fecha o el estado para consultar otros registros."
          />
        ) : (
          <Table
            caption="Listado administrativo de reservas"
            columns={columns}
            data={reservations}
          />
        )}
      </Card>

      <Modal
        open={Boolean(reassignTarget)}
        onClose={() => setReassignTarget(null)}
        title={`Reasignar mesa · ${reassignTarget?.reservation_code || ''}`}
        description={`Reserva para ${reassignTarget?.party_size || 0} personas. PostgreSQL validará capacidad y ausencia de solapamientos.`}
      >
        <form onSubmit={handleConfirmReassign} className="space-y-4">
          {actionError && (
            <div className="auth-alert auth-alert-error" role="alert">
              {actionError}
            </div>
          )}

          <FormField id="reassign-table" label="Seleccionar mesa activa" required>
            <Select
              id="reassign-table"
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              options={eligibleTables.map((t) => ({
                value: t.id,
                label: `${t.code} · ${t.zone} (Capacidad: ${t.capacity} pers.)`,
              }))}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button
              variant="outline"
              onClick={() => setReassignTarget(null)}
              disabled={reassigning}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={reassigning}>
              Guardar asignación
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
