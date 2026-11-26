import { AlertTriangle, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { calculateLineTotal } from '../../utils/cartUtils';
import { formatMoney } from '../../utils/formatMoney';
import { ProductImage } from '../public/ProductImage';
import { Badge, Drawer, EmptyState, IconButton } from '../ui';

export function CartDrawer() {
  const {
    items,
    totalUnits,
    subtotal,
    hasUnavailableItems,
    syncNotice,
    isDrawerOpen,
    closeDrawer,
    incrementItem,
    decrementItem,
    removeItem,
  } = useCart();
  const { isAuthenticated } = useAuth();

  return (
    <Drawer
      open={isDrawerOpen}
      onClose={closeDrawer}
      title={`Tu carrito (${totalUnits})`}
      side="right"
      tone="light"
      className="!w-[min(420px,94vw)]"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {syncNotice && (
            <div
              role="status"
              className="flex items-start gap-2.5 p-3 rounded-[var(--radius-sm)] bg-warning-bg text-warning border border-warning-border text-xs leading-relaxed"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{syncNotice}</span>
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-5 w-5" />}
              title="Tu carrito está vacío"
              description="Explora nuestra carta preparada al fuego y agrega tus favoritos."
              action={
                <Link
                  to="/menu"
                  onClick={closeDrawer}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
                >
                  <span>Explorar menú</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              }
            />
          ) : (
            <ul className="m-0 p-0 list-none space-y-3">
              {items.map((item) => {
                const lineTotal = calculateLineTotal(
                  item.unitPrice,
                  item.addons,
                  item.quantity,
                );
                return (
                  <li
                    key={item.lineKey}
                    className={[
                      'p-3 rounded-[var(--radius-sm)] border bg-surface-elevated flex gap-3',
                      item.unavailable ? 'border-error-border bg-error-bg/25' : 'border-border-subtle',
                    ].join(' ')}
                  >
                    <div className="h-16 w-16 rounded-[var(--radius-xs)] overflow-hidden shrink-0 bg-coffee/20">
                      <ProductImage
                        imageUrl={item.imageUrl}
                        slug={item.slug}
                        alt={item.name}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={item.slug ? `/producto/${item.slug}` : '/menu'}
                          onClick={closeDrawer}
                          className="text-sm font-semibold text-text-primary hover:text-fire transition-colors truncate"
                        >
                          {item.name}
                        </Link>
                        <IconButton
                          icon={<Trash2 className="h-3.5 w-3.5 text-error" aria-hidden="true" />}
                          label={`Eliminar ${item.name} del carrito`}
                          size="sm"
                          onClick={() => removeItem(item.lineKey)}
                        />
                      </div>

                      {item.addons.length > 0 && (
                        <ul className="m-0 mt-1 p-0 list-none space-y-0.5">
                          {item.addons.map((addon) => (
                            <li key={addon.id} className="text-[11px] text-text-secondary">
                              + {addon.name} ({formatMoney(addon.price)})
                            </li>
                          ))}
                        </ul>
                      )}

                      {item.unavailable && (
                        <div className="mt-1.5">
                          <Badge variant="error">No disponible</Badge>
                        </div>
                      )}

                      {item.priceChanged && !item.unavailable && (
                        <p className="m-0 mt-1 text-[11px] text-warning font-medium">
                          Precio actualizado desde la carta vigente.
                        </p>
                      )}

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center border border-border rounded-[var(--radius-xs)] bg-surface">
                          <button
                            type="button"
                            onClick={() => decrementItem(item.lineKey)}
                            aria-label={`Disminuir cantidad de ${item.name}`}
                            className="h-7 w-7 inline-flex items-center justify-center text-text-primary hover:bg-surface-muted cursor-pointer bg-transparent border-0"
                          >
                            <Minus className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <span className="px-2.5 text-xs font-semibold text-text-primary">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => incrementItem(item.lineKey)}
                            disabled={item.unavailable}
                            aria-label={`Aumentar cantidad de ${item.name}`}
                            className="h-7 w-7 inline-flex items-center justify-center text-text-primary hover:bg-surface-muted disabled:opacity-40 cursor-pointer bg-transparent border-0"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>

                        <span className="text-xs font-bold text-text-primary">
                          {formatMoney(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-border-subtle bg-surface-elevated space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Subtotal estimado</span>
              <strong className="text-base text-text-primary">
                {formatMoney(subtotal)}
              </strong>
            </div>
            <p className="m-0 text-[11px] text-text-muted leading-snug">
              Los precios definitivos y disponibilidad se validarán en el servidor al confirmar el pedido.
            </p>
            <div className="grid gap-2">
              <Link
                to="/carrito"
                onClick={closeDrawer}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
              >
                <span>Ver carrito completo</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              {!hasUnavailableItems && (
                <Link
                  to={isAuthenticated ? '/checkout' : '/login?redirect=%2Fcheckout'}
                  onClick={closeDrawer}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-[var(--radius-sm)] border border-border-strong text-[11px] font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
                >
                  {isAuthenticated ? 'Ir al checkout' : 'Iniciar sesión para continuar'}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
