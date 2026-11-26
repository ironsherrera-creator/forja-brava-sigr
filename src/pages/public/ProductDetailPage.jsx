import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ContentContainer } from '../../components/layout/ContentContainer';
import { ProductImage } from '../../components/public/ProductImage';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { useCart } from '../../hooks/useCart';
import { useProduct } from '../../hooks/useProduct';
import {
  calculateAddonsUnitTotal,
  calculateLineTotal,
  calculateUnitPrice,
  MAX_ITEM_QUANTITY,
  normalizeQuantity,
} from '../../utils/cartUtils';
import { formatMoney } from '../../utils/formatMoney';

export function ProductDetailPage() {
  const { slug = '' } = useParams();
  const { product, complements, isLoading, error, reload } = useProduct(slug);
  const { addItem } = useCart();

  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState('');
  const [addedConfirmation, setAddedConfirmation] = useState('');

  const selectedAddons = useMemo(
    () => complements.filter((addon) => selectedAddonIds.includes(addon.id)),
    [complements, selectedAddonIds],
  );

  const toggleAddon = (addonId) => {
    setValidationError('');
    setAddedConfirmation('');
    setSelectedAddonIds((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId],
    );
  };

  const handleDecrease = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncrease = () => {
    setQuantity((prev) => Math.min(MAX_ITEM_QUANTITY, prev + 1));
  };

  const handleAddToCart = () => {
    setValidationError('');
    setAddedConfirmation('');

    if (!product || product.is_available === false) {
      setValidationError('Este producto no se encuentra disponible actualmente.');
      return;
    }

    const safeQty = normalizeQuantity(quantity);
    if (safeQty < 1) {
      setValidationError('La cantidad mínima permitida es 1.');
      return;
    }

    // Validar que todos los complementos seleccionados pertenezcan al producto y estén activos
    const validAddonIds = new Set(
      complements.filter((c) => c.is_available !== false).map((c) => c.id),
    );
    const hasInvalidAddon = selectedAddonIds.some((id) => !validAddonIds.has(id));
    if (hasInvalidAddon) {
      setValidationError('Uno de los complementos seleccionados ya no está disponible.');
      return;
    }

    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        imageUrl: product.image_url || '',
        categoryName: product.category?.name || '',
        unitPrice: product.price,
        addons: selectedAddons.map((addon) => ({
          id: addon.id,
          name: addon.name,
          price: addon.price,
        })),
        quantity: safeQty,
      },
      { openCartDrawer: true },
    );

    setAddedConfirmation(
      `${safeQty} × ${product.name} agregado al carrito correctamente.`,
    );
  };

  if (isLoading) {
    return (
      <div className="pt-[var(--public-header-height)] min-h-screen bg-cream text-text-primary">
        <ContentContainer size="lg" className="py-16">
          <LoadingState
            title="Cargando producto…"
            description="Consultando precio vigente, disponibilidad y complementos en FORJA BRAVA."
          />
        </ContentContainer>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="pt-[var(--public-header-height)] min-h-screen bg-cream text-text-primary">
        <ContentContainer size="md" className="py-16">
          <ErrorState
            title="Producto no disponible"
            description={
              error?.message ||
              'El producto que buscas fue retirado o no se encuentra disponible.'
            }
            onRetry={error?.code !== 'PRODUCT_NOT_FOUND' ? reload : null}
          />
          <div className="mt-6 text-center">
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fire hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Volver al menú</span>
            </Link>
          </div>
        </ContentContainer>
      </div>
    );
  }

  const isAvailable = product.is_available !== false;
  const addonsUnitTotal = calculateAddonsUnitTotal(selectedAddons);
  const unitTotal = calculateUnitPrice(product.price, selectedAddons);
  const lineTotal = calculateLineTotal(product.price, selectedAddons, quantity);

  return (
    <div className="pt-[var(--public-header-height)] min-h-screen bg-cream text-text-primary">
      <ContentContainer size="lg" className="py-8 sm:py-10">
        <nav aria-label="Navegación de producto" className="mb-6 flex items-center gap-2 text-xs text-text-secondary">
          <Link to="/menu" className="inline-flex items-center gap-1.5 hover:text-fire transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Menú</span>
          </Link>
          {product.category && (
            <>
              <span>/</span>
              <Link
                to={`/menu/${product.category.slug}`}
                className="hover:text-fire transition-colors"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="font-semibold text-text-primary truncate">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] items-start">
          {/* Imagen principal */}
          <div className="overflow-hidden rounded-[var(--radius-sm)] border border-border bg-carbon aspect-[4/3] shadow-[var(--shadow-sm)]">
            <ProductImage
              imageUrl={product.image_url}
              slug={product.slug}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Información y configuración */}
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {product.category?.name && (
                  <Badge variant="wood">{product.category.name}</Badge>
                )}
                {product.tag && <Badge variant="fire">{product.tag}</Badge>}
                <Badge variant={isAvailable ? 'success' : 'error'}>
                  {isAvailable ? 'Disponible' : 'Agotado'}
                </Badge>
              </div>

              <h1 className="m-0 text-4xl font-medium text-text-primary sigr-heading-display">
                {product.name}
              </h1>

              <p className="m-0 mt-3 text-2xl font-semibold text-coffee">
                {formatMoney(product.price)}
              </p>

              <p className="m-0 mt-3 text-sm leading-relaxed text-text-secondary">
                {product.description}
              </p>

              {product.ingredients && (
                <div className="mt-4 p-3.5 rounded-[var(--radius-sm)] bg-surface-muted/70 border border-border-subtle">
                  <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-coffee">
                    Ingredientes
                  </p>
                  <p className="m-0 mt-1 text-xs text-text-secondary leading-relaxed">
                    {product.ingredients}
                  </p>
                </div>
              )}
            </div>

            {/* Complementos dinámicos desde product_complements */}
            {complements.length > 0 && (
              <Card>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="m-0 text-lg font-medium text-text-primary sigr-heading-display">
                      Complementos opcionales
                    </h2>
                    <p className="m-0 mt-0.5 text-xs text-text-secondary">
                      Personaliza tu plato agregando las adiciones disponibles.
                    </p>
                  </div>
                  <Badge variant="neutral">Opcional</Badge>
                </div>

                <div className="space-y-2">
                  {complements.map((addon) => {
                    const checked = selectedAddonIds.includes(addon.id);
                    return (
                      <label
                        key={addon.id}
                        className={[
                          'flex items-center justify-between gap-3 p-3 rounded-[var(--radius-sm)] border cursor-pointer transition-colors',
                          checked
                            ? 'border-fire bg-fire/8'
                            : 'border-border-subtle bg-surface-elevated hover:border-border-strong',
                        ].join(' ')}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(addon.id)}
                            disabled={!isAvailable}
                            className="h-4 w-4 accent-fire cursor-pointer"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-text-primary">
                              {addon.name}
                            </span>
                            {addon.description && (
                              <span className="block text-xs text-text-muted truncate">
                                {addon.description}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-coffee whitespace-nowrap">
                          + {formatMoney(addon.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Resumen de precio y selector de cantidad */}
            <Card>
              <div className="space-y-2 text-xs text-text-secondary pb-4 border-b border-border-subtle">
                <div className="flex justify-between">
                  <span>Precio base</span>
                  <span className="font-medium text-text-primary">
                    {formatMoney(product.price)}
                  </span>
                </div>
                {selectedAddons.length > 0 && (
                  <div className="flex justify-between">
                    <span>
                      Complementos ({selectedAddons.length})
                    </span>
                    <span className="font-medium text-text-primary">
                      + {formatMoney(addonsUnitTotal)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Valor unitario</span>
                  <span className="font-semibold text-text-primary">
                    {formatMoney(unitTotal)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 text-sm text-text-primary">
                  <span className="font-semibold">Total ({quantity} u.)</span>
                  <strong className="text-lg text-fire">{formatMoney(lineTotal)}</strong>
                </div>
              </div>

              {validationError && (
                <div
                  role="alert"
                  className="mt-4 p-3 rounded-[var(--radius-sm)] bg-error-bg text-error border border-error-border text-xs font-medium"
                >
                  {validationError}
                </div>
              )}

              {addedConfirmation && (
                <div
                  role="status"
                  className="mt-4 flex items-center gap-2 p-3 rounded-[var(--radius-sm)] bg-success-bg text-success border border-success-border text-xs font-medium"
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{addedConfirmation}</span>
                </div>
              )}

              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div
                  className="inline-flex items-center justify-between border border-border rounded-[var(--radius-sm)] bg-surface-elevated h-12 px-1"
                  aria-label="Selector de cantidad"
                >
                  <button
                    type="button"
                    onClick={handleDecrease}
                    disabled={!isAvailable || quantity <= 1}
                    aria-label="Disminuir cantidad"
                    className="h-10 w-10 inline-flex items-center justify-center text-text-primary hover:bg-surface-muted disabled:opacity-40 cursor-pointer bg-transparent border-0"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span
                    data-testid="product-quantity"
                    className="px-4 text-sm font-bold text-text-primary"
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncrease}
                    disabled={!isAvailable || quantity >= MAX_ITEM_QUANTITY}
                    aria-label="Aumentar cantidad"
                    className="h-10 w-10 inline-flex items-center justify-center text-text-primary hover:bg-surface-muted disabled:opacity-40 cursor-pointer bg-transparent border-0"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <Button
                  size="lg"
                  fullWidth
                  disabled={!isAvailable}
                  onClick={handleAddToCart}
                  leftIcon={<ShoppingBag className="h-4 w-4" />}
                >
                  {isAvailable ? 'Agregar al carrito' : 'Producto agotado'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </ContentContainer>
    </div>
  );
}
