import { useCallback, useEffect, useState } from 'react';
import { Edit2, FolderTree, Plus, Power } from 'lucide-react';
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
  Table,
  Textarea,
} from '../../components/ui';
import {
  fetchAllAdminCategories,
  saveAdminCategory,
} from '../../services/adminCatalogService';

const EMPTY_CATEGORY = {
  name: '',
  slug: '',
  description: '',
  display_order: 0,
  is_active: true,
};

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_CATEGORY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchAllAdminCategories();
    if (res.error) setError(res.error);
    else {
      setCategories(res.data);
      setError(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchAllAdminCategories().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setCategories(res.data);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_CATEGORY, display_order: categories.length + 1 });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (cat) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      display_order: cat.display_order ?? 0,
      is_active: Boolean(cat.is_active),
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setStatusNotice('');
    try {
      const res = await saveAdminCategory(editingId, form);
      if (res.error) {
        setFormError(res.error.message);
        return;
      }
      setModalOpen(false);
      setStatusNotice(
        editingId
          ? `Categoría "${res.data.name}" actualizada.`
          : `Categoría "${res.data.name}" creada.`,
      );
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (cat) => {
    const res = await saveAdminCategory(cat.id, { ...cat, is_active: !cat.is_active });
    if (!res.error) {
      setStatusNotice(
        res.data.is_active
          ? `Categoría "${res.data.name}" activada.`
          : `Categoría "${res.data.name}" desactivada.`,
      );
      load();
    }
  };

  const columns = [
    {
      key: 'display_order',
      header: 'Orden',
      render: (row) => <strong className="text-xs">{row.display_order}</strong>,
    },
    {
      key: 'name',
      header: 'Categoría',
      render: (row) => (
        <div>
          <strong className="text-text-primary">{row.name}</strong>
          <p className="m-0 text-[11px] text-text-muted">{row.slug}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'error'}>
          {row.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openEdit(row)}
            leftIcon={<Edit2 className="h-3.5 w-3.5" />}
          >
            Editar
          </Button>
          <IconButton
            icon={<Power className="h-4 w-4" aria-hidden="true" />}
            label={row.is_active ? `Desactivar ${row.name}` : `Activar ${row.name}`}
            variant="outline"
            size="sm"
            onClick={() => handleToggle(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 9 · CATÁLOGO"
        title="Gestión de"
        accent="categorías."
        description="Organiza el orden de visualización y disponibilidad de las categorías de la carta."
        actions={
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Nueva categoría
          </Button>
        }
      />

      {statusNotice && (
        <div className="auth-alert auth-alert-success" role="status">
          {statusNotice}
        </div>
      )}

      <Card>
        {error ? (
          <ErrorState
            title="No fue posible cargar las categorías"
            description={error.message}
            onRetry={load}
          />
        ) : isLoading ? (
          <LoadingState title="Cargando categorías…" />
        ) : categories.length === 0 ? (
          <EmptyState
            icon={<FolderTree className="h-5 w-5" />}
            title="Sin categorías"
            description="Crea la primera categoría para organizar el menú."
          />
        ) : (
          <Table caption="Categorías del menú" columns={columns} data={categories} />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar categoría' : 'Crear categoría'}
      >
        <form onSubmit={handleSave} noValidate className="space-y-4">
          {formError && (
            <div className="auth-alert auth-alert-error" role="alert">
              {formError}
            </div>
          )}

          <FormField id="cat-name" label="Nombre" required>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </FormField>

          <FormField id="cat-order" label="Orden de visualización">
            <Input
              id="cat-order"
              type="number"
              min={0}
              value={form.display_order}
              onChange={(e) => setForm((p) => ({ ...p, display_order: e.target.value }))}
            />
          </FormField>

          <FormField id="cat-desc" label="Descripción">
            <Textarea
              id="cat-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </FormField>

          <Checkbox
            id="cat-active"
            checked={form.is_active}
            onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
            label="Categoría activa en el menú"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
