import { useMemo, useState } from 'react';
import { Armchair, Edit2, Plus, Power, Users } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  FormField,
  IconButton,
  Input,
  LoadingState,
  Modal,
  Select,
} from '../../components/ui';
import { useTables } from '../../hooks/useTables';

const EMPTY_TABLE = {
  code: '',
  zone: 'Salón',
  capacity: 4,
  isActive: true,
};

function getOperationalBadgeVariant(table) {
  if (!table.is_active || table.status === 'fuera_de_servicio') return 'error';
  if (table.status === 'ocupada') return 'fire';
  if (table.status === 'reservada') return 'warning';
  return 'success';
}

function getOperationalLabel(table) {
  if (!table.is_active || table.status === 'fuera_de_servicio') return 'Inactiva';
  if (table.status === 'ocupada') return 'Ocupada';
  if (table.status === 'reservada') return 'Reservada';
  return 'Disponible';
}

export function AdminTablesPage() {
  const {
    tables,
    isLoading,
    error,
    reload,
    createTable,
    editTable,
    toggleActive,
  } = useTables();

  const [zoneFilter, setZoneFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_TABLE);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');

  const zones = useMemo(
    () => Array.from(new Set(tables.map((t) => t.zone).filter(Boolean))),
    [tables],
  );

  const visibleTables = useMemo(
    () =>
      zoneFilter === 'all'
        ? tables
        : tables.filter((t) => t.zone === zoneFilter),
    [tables, zoneFilter],
  );

  const stats = useMemo(() => {
    const active = tables.filter((t) => t.is_active);
    const totalCapacity = active.reduce((acc, t) => acc + (Number(t.capacity) || 0), 0);
    return {
      total: tables.length,
      activeCount: active.length,
      inactiveCount: tables.length - active.length,
      totalCapacity,
    };
  }, [tables]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_TABLE);
    setFieldErrors({});
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (table) => {
    setEditingId(table.id);
    setForm({
      code: table.code,
      zone: table.zone,
      capacity: table.capacity,
      isActive: Boolean(table.is_active),
    });
    setFieldErrors({});
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        capacity: Number(form.capacity),
      };
      const res = editingId
        ? await editTable(editingId, payload)
        : await createTable(payload);

      if (res.error) {
        if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
        setFormError(res.error.message);
        return;
      }

      setModalOpen(false);
      setStatusNotice(
        editingId
          ? `Mesa ${res.data.code} actualizada correctamente.`
          : `Mesa ${res.data.code} creada correctamente.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (table) => {
    setStatusNotice('');
    const res = await toggleActive(table);
    if (!res.error) {
      setStatusNotice(
        res.data.is_active
          ? `Mesa ${res.data.code} activada para servicio y reservas.`
          : `Mesa ${res.data.code} desactivada lógicamente (historial preservado).`,
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 7 · INVENTARIO DE MESAS (D-01)"
        title="Gestión de"
        accent="mesas."
        description="Configura códigos, zonas, capacidades y estado administrativo. Las mesas con historial se desactivan lógicamente sin eliminarse."
        actions={
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Crear mesa
          </Button>
        }
      />

      {statusNotice && (
        <div className="auth-alert auth-alert-success" role="status">
          {statusNotice}
        </div>
      )}

      {/* Indicadores de capacidad */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
            Total mesas
          </p>
          <p className="m-0 mt-1 text-3xl font-medium text-text-primary sigr-heading-display">
            {stats.total}
          </p>
        </Card>
        <Card>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
            Mesas activas
          </p>
          <p className="m-0 mt-1 text-3xl font-medium text-success sigr-heading-display">
            {stats.activeCount}
          </p>
        </Card>
        <Card>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
            Capacidad activa total
          </p>
          <p className="m-0 mt-1 text-3xl font-medium text-fire sigr-heading-display">
            {stats.totalCapacity} pers.
          </p>
        </Card>
        <Card>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
            Inactivas / Fuera de servicio
          </p>
          <p className="m-0 mt-1 text-3xl font-medium text-text-secondary sigr-heading-display">
            {stats.inactiveCount}
          </p>
        </Card>
      </div>

      {zones.length > 0 && (
        <div className="max-w-xs">
          <Select
            aria-label="Filtrar mesas por zona"
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Todas las zonas' },
              ...zones.map((z) => ({ value: z, label: z })),
            ]}
          />
        </div>
      )}

      {error ? (
        <ErrorState
          title="No fue posible cargar las mesas"
          description={error.message}
          onRetry={reload}
        />
      ) : isLoading ? (
        <LoadingState title="Cargando inventario de mesas…" />
      ) : visibleTables.length === 0 ? (
        <EmptyState
          icon={<Armchair className="h-5 w-5" />}
          title="No hay mesas configuradas"
          description="Crea las mesas reales del restaurante para habilitar el motor de disponibilidad y reservas."
          action={
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Crear primera mesa
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleTables.map((table) => (
            <Card key={table.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-wood">
                    {table.zone}
                  </span>
                  <h2 className="m-0 mt-0.5 text-2xl font-medium text-text-primary sigr-heading-display">
                    {table.code}
                  </h2>
                </div>
                <Badge variant={getOperationalBadgeVariant(table)}>
                  {getOperationalLabel(table)}
                </Badge>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                <Users className="h-4 w-4 text-fire" aria-hidden="true" />
                <span>
                  Capacidad: <strong className="text-text-primary">{table.capacity}</strong>{' '}
                  {table.capacity === 1 ? 'persona' : 'personas'}
                </span>
              </div>

              <p className="m-0 mt-1 text-[11px] text-text-muted">
                Estado administrativo:{' '}
                <strong>{table.is_active ? 'Activa' : 'Desactivada'}</strong>
              </p>

              <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(table)}
                  leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                >
                  Editar
                </Button>
                <IconButton
                  icon={<Power className="h-4 w-4" aria-hidden="true" />}
                  label={
                    table.is_active
                      ? `Desactivar mesa ${table.code}`
                      : `Activar mesa ${table.code}`
                  }
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(table)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar mesa' : 'Crear mesa'}
        description="Los cambios de capacidad y estado recalculan automáticamente la disponibilidad de futuras reservas."
      >
        <form onSubmit={handleSave} noValidate className="space-y-4">
          {formError && (
            <div className="auth-alert auth-alert-error" role="alert">
              {formError}
            </div>
          )}

          <FormField
            id="tbl-code"
            label="Código o número de mesa"
            error={fieldErrors.code}
            required
          >
            <Input
              id="tbl-code"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="Ej. M-01"
              error={Boolean(fieldErrors.code)}
              disabled={saving}
            />
          </FormField>

          <FormField
            id="tbl-zone"
            label="Zona o ubicación"
            error={fieldErrors.zone}
            required
          >
            <Input
              id="tbl-zone"
              value={form.zone}
              onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))}
              placeholder="Ej. Salón, Terraza, Barra"
              error={Boolean(fieldErrors.zone)}
              disabled={saving}
            />
          </FormField>

          <FormField
            id="tbl-capacity"
            label="Capacidad máxima (personas)"
            error={fieldErrors.capacity}
            required
          >
            <Input
              id="tbl-capacity"
              type="number"
              min={1}
              max={40}
              value={form.capacity}
              onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
              error={Boolean(fieldErrors.capacity)}
              disabled={saving}
            />
          </FormField>

          <Checkbox
            id="tbl-active"
            checked={form.isActive}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            label="Mesa activa y disponible para reservas"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? 'Guardar cambios' : 'Crear mesa'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
