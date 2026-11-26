import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Power, Upload, UtensilsCrossed } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
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
  SearchInput,
  Select,
  Table,
  Textarea,
} from '../../components/ui';
import {
  fetchAllAdminCategories,
  fetchAllAdminProducts,
  saveAdminProduct,
  uploadProductImage,
} from '../../services/adminCatalogService';
import { formatMoney } from '../../utils/formatMoney';

const EMPTY_PRODUCT = {
  category_id: '',
  name: '',
  slug: '',
  description: '',
  ingredients: '',
  price: 0,
  image_url: '',
  tag: '',
  is_addon: false,
  is_available: true,
  complement_ids: [],
};

export function AdminProductsPage() {
  const { id } = useParams();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(location.pathname.endsWith('/nuevo'));
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    const [prodRes, catRes] = await Promise.all([
      fetchAllAdminProducts(),
      fetchAllAdminCategories(),
    ]);
    if (prodRes.error) {
      setError(prodRes.error);
    } else {
      setProducts(prodRes.data);
      setCategories(catRes.data ?? []);
      setError(null);
      if (id) {
        const found = prodRes.data.find((p) => p.id === id);
        if (found) {
          setEditingId(found.id);
          setForm({
            category_id: found.category_id || '',
            name: found.name || '',
            slug: found.slug || '',
            description: found.description || '',
            ingredients: found.ingredients || '',
            price: found.price ?? 0,
            image_url: found.image_url || '',
            tag: found.tag || '',
            is_addon: Boolean(found.is_addon),
            is_available: Boolean(found.is_available),
            complement_ids: found.complement_ids ?? [],
          });
          setModalOpen(true);
        }
      }
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchAllAdminProducts(), fetchAllAdminCategories()]).then(
      ([prodRes, catRes]) => {
        if (!active) return;
        if (prodRes.error) setError(prodRes.error);
        else {
          setProducts(prodRes.data);
          setCategories(catRes.data ?? []);
          setError(null);
        }
        setIsLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const addonOptions = useMemo(
    () => products.filter((p) => p.is_addon && p.id !== editingId),
    [products, editingId],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.category?.name || '').toLowerCase().includes(q),
    );
  }, [products, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_PRODUCT, category_id: categories[0]?.id || '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (prod) => {
    setEditingId(prod.id);
    setForm({
      category_id: prod.category_id || '',
      name: prod.name || '',
      slug: prod.slug || '',
      description: prod.description || '',
      ingredients: prod.ingredients || '',
      price: prod.price ?? 0,
      image_url: prod.image_url || '',
      tag: prod.tag || '',
      is_addon: Boolean(prod.is_addon),
      is_available: Boolean(prod.is_available),
      complement_ids: prod.complement_ids ?? [],
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFormError('');
    try {
      const res = await uploadProductImage(file);
      if (res.error) {
        setFormError(res.error.message);
      } else if (res.url) {
        setForm((prev) => ({ ...prev, image_url: res.url }));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setStatusNotice('');
    try {
      const res = await saveAdminProduct(editingId, form, { syncComplements: true });
      if (res.error) {
        setFormError(res.error.message);
        return;
      }
      setModalOpen(false);
      setStatusNotice(
        editingId
          ? `Producto "${res.data.name}" actualizado correctamente.`
          : `Producto "${res.data.name}" creado correctamente.`,
      );
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailable = async (prod) => {
    setStatusNotice('');
    const res = await saveAdminProduct(
      prod.id,
      {
        ...prod,
        is_available: !prod.is_available,
      },
      { syncComplements: false },
    );
    if (!res.error) {
      setStatusNotice(
        res.data.is_available
          ? `Producto "${res.data.name}" activado en la carta.`
          : `Producto "${res.data.name}" desactivado (snapshots históricos preservados).`,
      );
      load();
    } else {
      setFormError(res.error.message);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Producto',
      render: (row) => (
        <div>
          <strong className="text-text-primary">{row.name}</strong>
          <p className="m-0 text-[11px] text-text-muted">
            {row.category?.name || 'Sin categoría'} {row.is_addon ? '· Complemento' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Precio',
      render: (row) => <strong className="text-fire">{formatMoney(row.price)}</strong>,
    },
    {
      key: 'status',
      header: 'Disponibilidad',
      render: (row) => (
        <Badge variant={row.is_available ? 'success' : 'error'}>
          {row.is_available ? 'Disponible' : 'Inactivo'}
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
            label={row.is_available ? `Desactivar ${row.name}` : `Activar ${row.name}`}
            variant="outline"
            size="sm"
            onClick={() => handleToggleAvailable(row)}
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
        accent="productos."
        description="Administra la carta, precios, imágenes en Supabase Storage y complementos permitidos sin eliminar historial de pedidos."
        actions={
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Nuevo producto
          </Button>
        }
      />

      {statusNotice && (
        <div className="auth-alert auth-alert-success" role="status">
          {statusNotice}
        </div>
      )}

      <Card>
        <div className="max-w-sm mb-4">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar producto o categoría…"
            ariaLabel="Buscar productos"
          />
        </div>

        {error ? (
          <ErrorState
            title="No fue posible cargar los productos"
            description={error.message}
            onRetry={load}
          />
        ) : isLoading ? (
          <LoadingState title="Cargando catálogo administrativo…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="h-5 w-5" />}
            title="Sin productos registrados"
            description="Crea el primer plato o complemento de la carta."
          />
        ) : (
          <Table caption="Productos del catálogo" columns={columns} data={visible} />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar producto' : 'Crear producto'}
        description="Los cambios de precio afectan solo a nuevos pedidos; los pedidos anteriores conservan su snapshot histórico."
        size="lg"
      >
        <form onSubmit={handleSave} noValidate className="space-y-4">
          {formError && (
            <div className="auth-alert auth-alert-error" role="alert">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="prod-name" label="Nombre" required>
              <Input
                id="prod-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </FormField>

            <FormField id="prod-category" label="Categoría" required>
              <Select
                id="prod-category"
                value={form.category_id}
                onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                options={[
                  { value: '', label: 'Selecciona categoría…' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </FormField>

            <FormField id="prod-price" label="Precio (COP)" required>
              <Input
                id="prod-price"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              />
            </FormField>

            <FormField id="prod-tag" label="Etiqueta destacada (opcional)">
              <Input
                id="prod-tag"
                value={form.tag}
                onChange={(e) => setForm((p) => ({ ...p, tag: e.target.value }))}
                placeholder="Ej. FAVORITA, PICANTE"
              />
            </FormField>
          </div>

          <FormField id="prod-desc" label="Descripción">
            <Textarea
              id="prod-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </FormField>

          <FormField id="prod-img" label="Imagen (URL o carga a Storage product-images)">
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                id="prod-img"
                value={form.image_url}
                onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                placeholder="https://... o assets/images/..."
                className="flex-1"
              />
              <label className="inline-flex items-center gap-1.5 h-10 px-3 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold cursor-pointer hover:bg-surface-muted">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{uploading ? 'Subiendo…' : 'Subir imagen'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </FormField>

          <div className="flex flex-wrap gap-5">
            <Checkbox
              id="prod-available"
              checked={form.is_available}
              onChange={(e) => setForm((p) => ({ ...p, is_available: e.target.checked }))}
              label="Disponible en carta"
            />
            <Checkbox
              id="prod-addon"
              checked={form.is_addon}
              onChange={(e) => setForm((p) => ({ ...p, is_addon: e.target.checked }))}
              label="Es complemento / adición"
            />
          </div>

          {!form.is_addon && addonOptions.length > 0 && (
            <div className="pt-2 border-t border-border-subtle space-y-2">
              <p className="m-0 text-xs font-semibold text-coffee">
                Complementos permitidos para este producto
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {addonOptions.map((addon) => (
                  <Checkbox
                    key={addon.id}
                    id={`addon-rel-${addon.id}`}
                    checked={form.complement_ids.includes(addon.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.complement_ids, addon.id]
                        : form.complement_ids.filter((cid) => cid !== addon.id);
                      setForm((p) => ({ ...p, complement_ids: next }));
                    }}
                    label={`${addon.name} (${formatMoney(addon.price)})`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {editingId ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
