import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Eye, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  SearchInput,
  Select,
  Table,
} from '../../components/ui';
import { fetchAuditLogs } from '../../services/adminAuditService';
import { formatDateTimeBogota, getDateIsoBogota } from '../../utils/formatDate';

const ENTITIES = [
  { value: 'all', label: 'Todas las entidades' },
  { value: 'orders', label: 'orders' },
  { value: 'reservations', label: 'reservations' },
  { value: 'table_accounts', label: 'table_accounts' },
  { value: 'restaurant_tables', label: 'restaurant_tables' },
  { value: 'products', label: 'products' },
  { value: 'categories', label: 'categories' },
  { value: 'profiles', label: 'profiles' },
  { value: 'payments', label: 'payments' },
  { value: 'restaurant_settings', label: 'restaurant_settings' },
];

export function AdminAuditPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [entityFilter, setEntityFilter] = useState('all');
  const [actionSearch, setActionSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchAuditLogs({ entity: entityFilter, action: actionSearch });
    if (res.error) setError(res.error);
    else {
      setLogs(res.data);
      setError(null);
    }
    setIsLoading(false);
  }, [entityFilter, actionSearch]);

  useEffect(() => {
    let active = true;
    fetchAuditLogs({ entity: entityFilter, action: actionSearch }).then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else {
        setLogs(res.data);
        setError(null);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [entityFilter, actionSearch]);

  const visible = useMemo(() => {
    if (!dateFilter) return logs;
    return logs.filter((row) => getDateIsoBogota(row.created_at) === dateFilter);
  }, [logs, dateFilter]);

  const columns = [
    {
      key: 'created_at',
      header: 'Fecha (Bogotá)',
      render: (row) => (
        <span className="text-xs whitespace-nowrap">
          {formatDateTimeBogota(row.created_at)}
        </span>
      ),
    },
    {
      key: 'actor_role',
      header: 'Rol actor',
      render: (row) => <Badge variant="info">{row.actor_role || 'sistema'}</Badge>,
    },
    {
      key: 'action',
      header: 'Acción',
      render: (row) => (
        <code className="text-xs font-semibold text-text-primary">{row.action}</code>
      ),
    },
    {
      key: 'entity_name',
      header: 'Entidad',
      render: (row) => <span className="text-xs text-text-secondary">{row.entity_name}</span>,
    },
    {
      key: 'details',
      header: 'Detalle',
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedLog(row)}
          leftIcon={<Eye className="h-3.5 w-3.5" />}
        >
          Ver snapshot
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 9 · TRAZABILIDAD INMUTABLE"
        title="Bitácora de"
        accent="auditoría."
        description="Consulta de solo lectura sobre audit_logs. Los registros son inmutables (append-only) mediante trigger en PostgreSQL."
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

      <Card>
        <div className="grid gap-3 md:grid-cols-3 mb-5">
          <Select
            aria-label="Filtrar por entidad"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            options={ENTITIES}
          />
          <SearchInput
            value={actionSearch}
            onChange={(e) => setActionSearch(e.target.value)}
            onClear={() => setActionSearch('')}
            placeholder="Filtrar por acción (ej. CREATE_ORDER)…"
            ariaLabel="Buscar acción en auditoría"
          />
          <Input
            type="date"
            aria-label="Filtrar auditoría por fecha"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        {error ? (
          <ErrorState
            title="No fue posible cargar la auditoría"
            description={error.message}
            onRetry={load}
          />
        ) : isLoading ? (
          <LoadingState title="Cargando bitácora inmutable…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-5 w-5" />}
            title="Sin eventos de auditoría para los filtros"
            description="Los eventos críticos del sistema quedarán registrados aquí."
          />
        ) : (
          <Table caption="Registros inmutables de auditoría" columns={columns} data={visible} />
        )}
      </Card>

      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={`Evento ${selectedLog?.action || ''}`}
        description={`Entidad: ${selectedLog?.entity_name || ''} · ID: ${selectedLog?.entity_id || '—'}`}
        size="lg"
      >
        {selectedLog && (
          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div>
              <strong className="block mb-1 text-text-primary">Estado anterior (old_data)</strong>
              <pre className="p-3 rounded bg-surface-muted overflow-auto max-h-64 text-[11px]">
                {JSON.stringify(selectedLog.old_data ?? null, null, 2)}
              </pre>
            </div>
            <div>
              <strong className="block mb-1 text-text-primary">Estado nuevo (new_data)</strong>
              <pre className="p-3 rounded bg-surface-muted overflow-auto max-h-64 text-[11px]">
                {JSON.stringify(selectedLog.new_data ?? null, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
