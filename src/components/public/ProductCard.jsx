import { ArrowUpRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../../utils/formatMoney';
import { Badge, Button } from '../ui';
import { ProductImage } from './ProductImage';

export function ProductCard({
  product,
  complementsCount = 0,
  onQuickAdd = null,
}) {
  const isAvailable = product.is_available !== false;
  const canQuickAdd = isAvailable && complementsCount === 0 && Boolean(onQuickAdd);
  const productHref = `/producto/${product.slug}`;

  return (
    <article className="group flex flex-col bg-surface-dark border border-sand/15 rounded-[var(--radius-sm)] overflow-hidden transition-colors hover:border-fire/60">
      <Link
        to={productHref}
        className="relative block aspect-[4/3] overflow-hidden bg-coffee/60"
      >
        <ProductImage
          imageUrl={product.image_url}
          slug={product.slug}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {product.tag && (
            <span className="px-2.5 py-1 bg-paper text-carbon text-[10px] font-bold uppercase tracking-[0.12em]">
              {product.tag}
            </span>
          )}
          {!isAvailable && <Badge variant="error">Agotado</Badge>}
        </div>
      </Link>

      <div className="flex flex-col flex-1 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {product.category?.name && (
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-fire">
                {product.category.name}
              </p>
            )}
            <h3 className="m-0 mt-1 text-xl font-medium text-cream sigr-heading-display leading-snug">
              <Link to={productHref} className="hover:text-fire-hover transition-colors">
                {product.name}
              </Link>
            </h3>
          </div>
          <span className="text-sm font-semibold text-sand whitespace-nowrap pt-1">
            {formatMoney(product.price)}
          </span>
        </div>

        <p className="m-0 mt-2.5 text-xs leading-relaxed text-paper/75 line-clamp-2 flex-1">
          {product.description || 'Preparado al momento con el sello de FORJA BRAVA.'}
        </p>

        <div className="mt-4 pt-3.5 border-t border-sand/15 flex items-center justify-between gap-2">
          <Link
            to={productHref}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cream hover:text-fire-hover transition-colors"
          >
            <span>Ver producto</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
          </Link>

          {canQuickAdd ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onQuickAdd(product)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              aria-label={`Agregar ${product.name} al carrito`}
            >
              Agregar
            </Button>
          ) : isAvailable && complementsCount > 0 ? (
            <Link
              to={productHref}
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-sand hover:text-cream transition-colors"
            >
              Personalizar
            </Link>
          ) : (
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sand/60">
              No disponible
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
