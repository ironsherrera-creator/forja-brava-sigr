import { useState } from 'react';
import { Edit2, MapPin, Plus, Star, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  IconButton,
  Input,
  LoadingState,
  Modal,
  Textarea,
} from '../../components/ui';
import { useAddresses } from '../../hooks/useAddresses';
import { useAuth } from '../../hooks/useAuth';

const EMPTY_FORM = {
  label: '',
  address: '',
  neighborhood: '',
  directions: '',
  isDefault: false,
};

export function ClientAddressesPage() {
  const { user } = useAuth();
  const {
    addresses,
    isLoading,
    error,
    reload,
    addAddress,
    editAddress,
    makeDefault,
    removeAddress,
  } = useAddresses(user?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, isDefault: addresses.length === 0 });
    setFieldErrors({});
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (addr) => {
    setEditingId(addr.id);
    setForm({
      label: addr.label || '',
      address: addr.address || '',
      neighborhood: addr.neighborhood || '',
      directions: addr.directions || '',
      isDefault: Boolean(addr.is_default),
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
      const res = editingId
        ? await editAddress(editingId, form)
        : await addAddress(form);

      if (res.error) {
        if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
        setFormError(res.error.message);
        return;
      }

      setModalOpen(false);
      setActionMessage(
        editingId
          ? 'Dirección actualizada correctamente.'
          : 'Nueva dirección registrada correctamente.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMakeDefault = async (addressId) => {
    setActionMessage('');
    const res = await makeDefault(addressId);
    if (!res.error) {
      setActionMessage('Dirección predeterminada actualizada.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await removeAddress(deleteTarget.id);
      if (!res.error) {
        setActionMessage('Dirección eliminada. Tus pedidos históricos conservan sus datos originales.');
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ÁREA CLIENTE · ENTREGAS"
        title="Mis"
        accent="direcciones."
        description="Administra tus direcciones de entrega. Solo puede existir una dirección predeterminada a la vez."
        actions={
          <Button
            onClick={openCreate}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Nueva dirección
          </Button>
        }
      />

      {actionMessage && (
        <div className="auth-alert auth-alert-success" role="status">
          {actionMessage}
        </div>
      )}

      {error ? (
        <ErrorState
          title="No fue posible cargar tus direcciones"
          description={error.message}
          onRetry={reload}
        />
      ) : isLoading ? (
        <LoadingState title="Cargando tus direcciones…" />
      ) : addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="Aún no tienes direcciones guardadas"
          description="Registra tu dirección de casa u oficina para agilizar tus pedidos a domicilio."
          action={
            <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Registrar primera dirección
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((addr) => (
            <Card
              key={addr.id}
              className={addr.is_default ? '!border-fire' : ''}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="m-0 text-lg font-medium text-text-primary sigr-heading-display">
                    {addr.label}
                  </h2>
                  {addr.is_default && <Badge variant="fire">Principal</Badge>}
                </div>

                <div className="flex items-center gap-1">
                  <IconButton
                    icon={<Edit2 className="h-4 w-4" aria-hidden="true" />}
                    label={`Editar dirección ${addr.label}`}
                    size="sm"
                    onClick={() => openEdit(addr)}
                  />
                  <IconButton
                    icon={<Trash2 className="h-4 w-4 text-error" aria-hidden="true" />}
                    label={`Eliminar dirección ${addr.label}`}
                    size="sm"
                    onClick={() => setDeleteTarget(addr)}
                  />
                </div>
              </div>

              <p className="m-0 mt-2 text-sm font-medium text-text-primary">
                {addr.address}
              </p>
              <p className="m-0 mt-0.5 text-xs text-text-secondary">
                Barrio: {addr.neighborhood}
              </p>
              {addr.directions && (
                <p className="m-0 mt-1.5 text-xs text-text-muted">
                  Referencia: {addr.directions}
                </p>
              )}

              {!addr.is_default && (
                <div className="mt-4 pt-3 border-t border-border-subtle">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMakeDefault(addr.id)}
                    leftIcon={<Star className="h-3.5 w-3.5 text-fire" />}
                  >
                    Establecer como principal
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar dirección' : 'Nueva dirección'}
        description="Esta información se guardará de forma privada bajo tu cuenta."
      >
        <form onSubmit={handleSave} noValidate className="space-y-4">
          {formError && (
            <div className="auth-alert auth-alert-error" role="alert">
              {formError}
            </div>
          )}

          <FormField
            id="addr-label"
            label="Nombre o etiqueta"
            error={fieldErrors.label}
            required
          >
            <Input
              id="addr-label"
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Ej. Casa, Oficina"
              error={Boolean(fieldErrors.label)}
              disabled={saving}
            />
          </FormField>

          <FormField
            id="addr-address"
            label="Dirección"
            error={fieldErrors.address}
            required
          >
            <Input
              id="addr-address"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Ej. Calle 85 # 15-40 Apto 302"
              error={Boolean(fieldErrors.address)}
              disabled={saving}
            />
          </FormField>

          <FormField
            id="addr-neighborhood"
            label="Barrio"
            error={fieldErrors.neighborhood}
            required
          >
            <Input
              id="addr-neighborhood"
              value={form.neighborhood}
              onChange={(e) => setForm((prev) => ({ ...prev, neighborhood: e.target.value }))}
              placeholder="Ej. Chapinero"
              error={Boolean(fieldErrors.neighborhood)}
              disabled={saving}
            />
          </FormField>

          <FormField
            id="addr-directions"
            label="Indicaciones o referencia (opcional)"
            error={fieldErrors.directions}
          >
            <Textarea
              id="addr-directions"
              rows={2}
              value={form.directions}
              onChange={(e) => setForm((prev) => ({ ...prev, directions: e.target.value }))}
              placeholder="Ej. Portería esquina norte, timbre 302"
              disabled={saving}
            />
          </FormField>

          <Checkbox
            id="addr-default"
            checked={form.isDefault}
            onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
            label="Establecer como dirección principal"
            description="Se preseleccionará automáticamente en tus pedidos a domicilio."
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? 'Guardar cambios' : 'Guardar dirección'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="¿Eliminar dirección?"
        description={`Se eliminará "${deleteTarget?.label || ''}". Los pedidos históricos conservarán la dirección registrada al momento de compra.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
