import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Send, Trash2, UtensilsCrossed } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  FormField,
  Input,
  LoadingState,
  SearchInput,
  Select,
  Textarea,
} from '../../components/ui';
import { useWaiterSalon } from '../../hooks/useWaiterSalon';
import { fetchActiveCategories } from '../../services/categoryService';
import { fetchComplementsMapForProducts } from '../../services/complementService';
import { fetchPublicProducts } from '../../services/productService';
import {
  generateWaiterRequestId,
  submitWaiterTableOrder,
} from '../../services/waiterService';
import { formatMoney } from '../../utils/formatMoney';

export function WaiterNewOrderPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { tables, accounts, isLoading: salonLoading } = useWaiterSalon();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [complementsMap, setComplementsMap] = useState(() => new Map());
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [selectedTableId, setSelectedTableId] = useState(searchParams.get('mesa') || '');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [lines, setLines] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const requestIdRef = useRef(generateWaiterRequestId());

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchActiveCategories(),
      fetchPublicProducts({ includeAddons: false }),
    ]).then(async ([catRes, prodRes]) => {
      if (!active) return;
      const loadedProducts = prodRes.data ?? [];
      setCategories(catRes.data ?? []);
      setProducts(loadedProducts);

      const compRes = await fetchComplementsMapForProducts(
        loadedProducts.map((p) => p.id),
      );
      if (!active) return;
      setComplementsMap(compRes.data ?? new Map());
      setCatalogLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const closingTableIds = useMemo(
    () =>
      new Set(
        accounts
          .filter((a) => a.status === 'closing_requested')
          .map((a) => a.table_id),
      ),
    [accounts],
  );

  const eligibleTables = useMemo(
    () =>
      tables.filter(
        (t) =>
          t.is_active &&
          t.status !== 'fuera_de_servicio' &&
          !closingTableIds.has(t.id),
      ),
    [tables, closingTableIds],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.is_available) return false;
      if (selectedCategory !== 'all' && p.category?.slug !== selectedCategory) {
        return false;
      }
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, selectedCategory, search]);

  const addProductLine = (product) => {
    if (!product.is_available) return;
    setSubmitError('');
    setLines((prev) => [
      ...prev,
      {
        uid: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: product.id,
        name: product.name,
        unitPrice: Number(product.price) || 0,
        quantity: 1,
        addonIds: [],
        notes: '',
      },
    ]);
  };

  const updateLine = (uid, patch) => {
    setLines((prev) =>
      prev.map((line) => (line.uid === uid ? { ...line, ...patch } : line)),
    );
  };

  const toggleLineAddon = (uid, addonId) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.uid !== uid) return line;
        const exists = line.addonIds.includes(addonId);
        return {
          ...line,
          addonIds: exists
            ? line.addonIds.filter((id) => id !== addonId)
            : [...line.addonIds, addonId],
        };
      }),
    );
  };

  const removeLine = (uid) => {
    setLines((prev) => prev.filter((line) => line.uid !== uid));
  };

  const estimatedTotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const availableAddons = complementsMap.get(line.productId) ?? [];
      const addonsUnit = line.addonIds.reduce((acc, aid) => {
        const found = availableAddons.find((a) => a.id === aid);
        return acc + (Number(found?.price) || 0);
      }, 0);
      return sum + (line.unitPrice + addonsUnit) * line.quantity;
    }, 0);
  }, [lines, complementsMap]);

  const handleConfirm = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitError('');
    setSubmitSuccess('');

    if (!selectedTableId) {
      setSubmitError('Selecciona una mesa activa para registrar la comanda.');
      return;
    }

    if (lines.length === 0) {
      setSubmitError('Agrega al menos un producto a la comanda.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitWaiterTableOrder({
        tableId: selectedTableId,
        notes: orderNotes,
        clientRequestId: requestIdRef.current,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          addonIds: l.addonIds,
          notes: l.notes,
        })),
      });

      if (res.error) {
        setSubmitError(res.error.message);
        return;
      }

      setSubmitSuccess(
        `Comanda ${res.data.order_number} registrada en la cuenta de mesa por ${formatMoney(res.data.total)}.`,
      );
      setLines([]);
      setOrderNotes('');
      requestIdRef.current = generateWaiterRequestId();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 8 · TOMA DE COMANDA"
        title="Registrar"
        accent="comanda en mesa."
        description="Selecciona mesa, productos disponibles, complementos reales y observaciones. PostgreSQL calcula los totales y acumula en la cuenta única de la mesa (D-04)."
      />

      {submitError && (
        <div className="auth-alert auth-alert-error" role="alert">
          {submitError}
        </div>
      )}
      {submitSuccess && (
        <div
          className="auth-alert auth-alert-success flex flex-wrap items-center justify-between gap-2"
          role="status"
        >
          <span>{submitSuccess}</span>
          {selectedTableId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/mesero/mesas/${selectedTableId}`)}
            >
              Ver cuenta de mesa
            </Button>
          )}
        </div>
      )}

      {!salonLoading && eligibleTables.length === 0 && (
        <div className="auth-alert auth-alert-error" role="alert">
          {tables.length === 0
            ? 'No hay mesas configuradas. El administrador debe registrarlas desde /admin/mesas antes de tomar comandas.'
            : 'No hay mesas activas disponibles para tomar comandas en este momento.'}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] items-start">
        {/* Catálogo operativo */}
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="cmd-table" label="Mesa de salón" required>
              <Select
                id="cmd-table"
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                options={[
                  { value: '', label: 'Selecciona una mesa…' },
                  ...eligibleTables.map((t) => ({
                    value: t.id,
                    label: `${t.code} · ${t.zone} (${t.status})`,
                  })),
                ]}
              />
            </FormField>

            <FormField id="cmd-category" label="Categoría">
              <Select
                id="cmd-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={[
                  { value: 'all', label: 'Todas las categorías' },
                  ...categories.map((c) => ({ value: c.slug, label: c.name })),
                ]}
              />
            </FormField>
          </div>

          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar plato disponible…"
            ariaLabel="Buscar producto para comanda"
          />

          {catalogLoading || salonLoading ? (
            <LoadingState title="Cargando carta disponible…" />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={<UtensilsCrossed className="h-5 w-5" />}
              title="Sin productos disponibles"
              description="Ajusta la búsqueda o categoría."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="p-3 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <strong className="block text-sm text-text-primary truncate">
                      {prod.name}
                    </strong>
                    <span className="text-xs font-semibold text-fire">
                      {formatMoney(prod.price)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addProductLine(prod)}
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Agregar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Resumen de comanda */}
        <Card>
          <form onSubmit={handleConfirm} noValidate className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display">
                Resumen de comanda
              </h2>
              <Badge variant="fire">{lines.length} líneas</Badge>
            </div>

            {lines.length === 0 ? (
              <p className="m-0 text-xs text-text-muted py-6 text-center">
                Agrega productos del catálogo para armar la comanda.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {lines.map((line) => {
                  const addons = complementsMap.get(line.productId) ?? [];
                  return (
                    <div
                      key={line.uid}
                      className="p-3 rounded-[var(--radius-sm)] border border-border-subtle bg-cream/60 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs text-text-primary">
                          {line.name}
                        </strong>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            aria-label={`Disminuir cantidad de ${line.name}`}
                            onClick={() =>
                              updateLine(line.uid, {
                                quantity: Math.max(1, line.quantity - 1),
                              })
                            }
                            className="h-7 w-7 inline-flex items-center justify-center rounded border border-border-strong bg-surface cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold w-6 text-center">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Aumentar cantidad de ${line.name}`}
                            onClick={() =>
                              updateLine(line.uid, {
                                quantity: Math.min(50, line.quantity + 1),
                              })
                            }
                            className="h-7 w-7 inline-flex items-center justify-center rounded border border-border-strong bg-surface cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Eliminar ${line.name}`}
                            onClick={() => removeLine(line.uid)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded border border-error/40 text-error bg-surface cursor-pointer ml-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {addons.length > 0 && (
                        <div className="pt-1 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-coffee">
                            Complementos
                          </span>
                          {addons.map((addon) => (
                            <Checkbox
                              key={addon.id}
                              id={`${line.uid}-${addon.id}`}
                              checked={line.addonIds.includes(addon.id)}
                              onChange={() => toggleLineAddon(line.uid, addon.id)}
                              label={`${addon.name} (+${formatMoney(addon.price)})`}
                            />
                          ))}
                        </div>
                      )}

                      <Input
                        value={line.notes}
                        maxLength={200}
                        onChange={(e) =>
                          updateLine(line.uid, { notes: e.target.value })
                        }
                        placeholder="Observación de este plato (ej. término medio, sin cebolla)"
                        aria-label={`Observación para ${line.name}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <FormField id="cmd-notes" label="Observaciones generales (opcional)">
              <Textarea
                id="cmd-notes"
                rows={2}
                maxLength={300}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Indicaciones generales para la mesa"
              />
            </FormField>

            <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                Estimado (validado en servidor)
              </span>
              <strong className="text-xl text-fire sigr-heading-display">
                {formatMoney(estimatedTotal)}
              </strong>
            </div>

            <Button
              type="submit"
              fullWidth
              loading={submitting}
              disabled={submitting || lines.length === 0 || !selectedTableId}
              leftIcon={<Send className="h-4 w-4" />}
            >
              Confirmar comanda
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
