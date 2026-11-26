import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentContainer } from '../../components/layout/ContentContainer';
import { PageHeader } from '../../components/layout/PageHeader';
import { ProductImage } from '../../components/public/ProductImage';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Radio,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useRestaurantSettings } from '../../hooks/useRestaurantSettings';
import { calculateLineTotal } from '../../utils/cartUtils';
import { formatMoney } from '../../utils/formatMoney';

export function CartPage() {
  const {
    items,
    totalUnits,
    subtotal,
    hasUnavailableItems,
    isSyncing,
    syncNotice,
    syncError,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart,
    syncWithCatalog,
  } = useCart();
  const { isAuthenticated } = useAuth();
  const { settings } = useRestaurantSettings();

  const [selectedModality, setSelectedModality] = useState('domicilio');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const allowClientTableOrders = Boolean(settings?.allow_client_table_orders);

  return (
    <div className="pt-[var(--public-header-height)] min-h-screen bg-cream text-text-primary">
      <ContentContainer size="xl" className="py-8 sm:py-10">
        <PageHeader
          eyebrow="FORJA BRAVA · CARRITO DE COMPRA"
          title="Tu"
          accent="pedido."
          description="Revisa tus productos, complementos y cantidades. Los precios se verifican contra la carta vigente de Supabase."
          badge={
            <Badge variant="fire">
              {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
            </Badge>
          }
          actions={
            items.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  loading={isSyncing}
                  onClick={syncWithCatalog}
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Validar carta
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClearOpen(true)}
                  leftIcon={<Trash2 className="h-3.5 w-3.5 text-error" />}
                >
                  Vaciar carrito
                </Button>
              </div>
            ) : null
          }
        />

        {syncNotice && (
          <div
            role="status"
            className="mb-6 flex items-start gap-2.5 p-4 rounded-[var(--radius-sm)] bg-warning-bg text-warning border border-warning-border text-xs font-medium"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{syncNotice}</span>
          </div>
        )}

        {syncError && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-[var(--radius-sm)] bg-error-bg text-error border border-error-border text-xs font-medium"
          >
            {syncError}
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Tu carrito está vacío"
            description="Aún no has agregado platos de FORJA BRAVA. Explora nuestra carta preparada al fuego."
            action={
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Explorar el menú</span>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] items-start">
            {/* Lista de líneas */}
            <div className="space-y-3">
              {items.map((item) => {
                const lineTotal = calculateLineTotal(
                  item.unitPrice,
                  item.addons,
                  item.quantity,
                );
                return (
                  <Card
                    key={item.lineKey}
                    className={
                      item.unavailable
                        ? '!border-error-border !bg-error-bg/20'
                        : ''
                    }
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="h-24 w-full sm:w-28 rounded-[var(--radius-xs)] overflow-hidden bg-carbon shrink-0">
                        <ProductImage
                          imageUrl={item.imageUrl}
                          slug={item.slug}
                          alt={item.name}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            {item.categoryName && (
                              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-wood">
                                {item.categoryName}
                              </p>
                            )}
                            <Link
                              to={item.slug ? `/producto/${item.slug}` : '/menu'}
                              className="text-lg font-medium text-text-primary hover:text-fire transition-colors sigr-heading-display"
                            >
                              {item.name}
                            </Link>
                          </div>
                          <IconButton
                            icon={<Trash2 className="h-4 w-4 text-error" aria-hidden="true" />}
                            label={`Eliminar ${item.name}`}
                            size="sm"
                            onClick={() => removeItem(item.lineKey)}
                          />
                        </div>

                        <p className="m-0 mt-1 text-xs text-text-secondary">
                          Base: {formatMoney(item.unitPrice)}
                        </p>

                        {item.addons.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border-subtle">
                            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-coffee">
                              Complementos seleccionados
                            </p>
                            <ul className="m-0 mt-1 p-0 list-none space-y-0.5">
                              {item.addons.map((addon) => (
                                <li key={addon.id} className="text-xs text-text-secondary">
                                  + {addon.name} ({formatMoney(addon.price)})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {item.unavailable && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <Badge variant="error">No disponible</Badge>
                            <span className="text-xs text-error">
                              {item.unavailableReason || 'Retira este ítem para continuar.'}
                            </span>
                          </div>
                        )}

                        {item.priceChanged && !item.unavailable && (
                          <div className="mt-2">
                            <Badge variant="warning">Precio actualizado desde la carta</Badge>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="inline-flex items-center border border-border rounded-[var(--radius-sm)] bg-surface-elevated">
                            <button
                              type="button"
                              onClick={() => decrementItem(item.lineKey)}
                              aria-label={`Disminuir cantidad de ${item.name}`}
                              className="h-9 w-9 inline-flex items-center justify-center text-text-primary hover:bg-surface-muted cursor-pointer bg-transparent border-0"
                            >
                              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <span className="px-3.5 text-xs font-bold text-text-primary">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => incrementItem(item.lineKey)}
                              disabled={item.unavailable}
                              aria-label={`Aumentar cantidad de ${item.name}`}
                              className="h-9 w-9 inline-flex items-center justify-center text-text-primary hover:bg-surface-muted disabled:opacity-40 cursor-pointer bg-transparent border-0"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>

                          <strong className="text-base text-text-primary">
                            {formatMoney(lineTotal)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}

              <div className="pt-2">
                <Link
                  to="/menu"
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-coffee hover:text-fire transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Seguir explorando el menú</span>
                </Link>
              </div>
            </div>

            {/* Resumen y preparación de modalidad para checkout futuro */}
            <Card className="sticky top-[calc(var(--public-header-height)+24px)]">
              <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display pb-3 border-b border-border-subtle">
                Resumen de compra
              </h2>

              <div className="mt-4 space-y-2.5">
                <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-coffee">
                  Modalidad preferida (para el siguiente paso)
                </p>
                <div className="space-y-2">
                  <Radio
                    id="mod-domicilio"
                    name="order-modality"
                    checked={selectedModality === 'domicilio'}
                    onChange={() => setSelectedModality('domicilio')}
                    label="Domicilio"
                    description="La tarifa fija de envío se calculará en el checkout según configuración."
                  />
                  <Radio
                    id="mod-recoger"
                    name="order-modality"
                    checked={selectedModality === 'recoger'}
                    onChange={() => setSelectedModality('recoger')}
                    label="Recoger en tienda"
                    description="Sin costo de domicilio."
                  />
                  <Radio
                    id="mod-mesa"
                    name="order-modality"
                    disabled={!allowClientTableOrders}
                    checked={selectedModality === 'mesa'}
                    onChange={() => setSelectedModality('mesa')}
                    label="En mesa"
                    description={
                      allowClientTableOrders
                        ? 'Requiere reserva vigente confirmada.'
                        : 'Actualmente los pedidos en mesa son registrados por el mesero del salón.'
                    }
                  />
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-border-subtle space-y-2 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <span>Productos ({totalUnits})</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-text-primary pt-2 border-t border-border-subtle">
                  <span>Subtotal estimado</span>
                  <span className="text-fire">{formatMoney(subtotal)}</span>
                </div>
              </div>

              {hasUnavailableItems ? (
                <div
                  role="alert"
                  className="mt-4 p-3 rounded-[var(--radius-sm)] bg-error-bg text-error border border-error-border text-xs font-medium"
                >
                  Retira los productos marcados como no disponibles antes de continuar.
                </div>
              ) : !isAuthenticated ? (
                <div className="mt-5 space-y-2.5">
                  <Link
                    to="/login?redirect=%2Fcheckout"
                    className="inline-flex items-center justify-center w-full h-11 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
                  >
                    Iniciar sesión para continuar
                  </Link>
                  <p className="m-0 text-[11px] text-text-muted text-center">
                    Conforme a la política de seguridad (D-06), debes iniciar sesión para confirmar pedidos.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-2.5">
                  <Link
                    to="/checkout"
                    className="inline-flex items-center justify-center w-full h-11 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
                  >
                    Continuar al checkout
                  </Link>
                  <p className="m-0 text-[11px] text-text-muted text-center">
                    Los precios y disponibilidad definitivos se validarán en PostgreSQL.
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}
      </ContentContainer>

      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={() => {
          clearCart();
          setConfirmClearOpen(false);
        }}
        title="¿Vaciar el carrito?"
        description="Se eliminarán todos los productos y complementos seleccionados."
        confirmLabel="Vaciar carrito"
      />
    </div>
  );
}
