import { useMemo, useState } from 'react';
import { SlidersHorizontal, UtensilsCrossed } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ContentContainer } from '../../components/layout/ContentContainer';
import { ProductCard } from '../../components/public/ProductCard';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  SearchInput,
  Select,
  SkeletonCard,
} from '../../components/ui';
import { useCart } from '../../hooks/useCart';
import { useCatalog } from '../../hooks/useCatalog';
import { useCategories } from '../../hooks/useCategories';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const SORT_OPTIONS = [
  { value: 'featured', label: 'Orden recomendado' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'name_asc', label: 'Alfabético (A–Z)' },
];

const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Solo disponibles' },
  { value: 'all', label: 'Todos los visibles' },
];

export function MenuPage() {
  const { category: categoryParam = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQuery = searchParams.get('q') || '';
  const initialSort = searchParams.get('sort') || 'featured';
  const initialAvailability = searchParams.get('disp') || 'available';

  const [searchText, setSearchText] = useState(initialQuery);
  const [sort, setSort] = useState(initialSort);
  const [availability, setAvailability] = useState(initialAvailability);
  const [addedBanner, setAddedBanner] = useState('');

  const debouncedSearch = useDebouncedValue(searchText, 250);

  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    reload: reloadCategories,
  } = useCategories();

  const {
    products,
    complementsMap,
    isLoading: productsLoading,
    error: productsError,
    reload: reloadProducts,
  } = useCatalog({
    categorySlug: categoryParam,
    search: debouncedSearch,
    sort,
    includeAddons: true,
  });

  const { addItem, openDrawer } = useCart();

  const syncQueryParams = (nextQ, nextSort, nextDisp) => {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set('q', nextQ.trim());
    if (nextSort && nextSort !== 'featured') params.set('sort', nextSort);
    if (nextDisp && nextDisp !== 'available') params.set('disp', nextDisp);
    setSearchParams(params, { replace: true });
  };

  const handleSearchChange = (event) => {
    const next = event.target.value;
    setSearchText(next);
    syncQueryParams(next, sort, availability);
  };

  const handleClearSearch = () => {
    setSearchText('');
    syncQueryParams('', sort, availability);
  };

  const handleSortChange = (event) => {
    const next = event.target.value;
    setSort(next);
    syncQueryParams(searchText, next, availability);
  };

  const handleAvailabilityChange = (event) => {
    const next = event.target.value;
    setAvailability(next);
    syncQueryParams(searchText, sort, next);
  };

  const handleResetFilters = () => {
    setSearchText('');
    setSort('featured');
    setAvailability('available');
    setSearchParams({}, { replace: true });
    if (categoryParam) {
      navigate('/menu');
    }
  };

  const activeCategory = useMemo(
    () => categories.find((cat) => cat.slug === categoryParam) || null,
    [categories, categoryParam],
  );

  const filteredProducts = useMemo(() => {
    if (availability === 'available') {
      return products.filter((item) => item.is_available !== false);
    }
    return products;
  }, [products, availability]);

  const handleQuickAdd = (product) => {
    if (product.is_available === false) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.image_url || '',
      categoryName: product.category?.name || '',
      unitPrice: product.price,
      addons: [],
      quantity: 1,
    });
    setAddedBanner(`${product.name} fue agregado a tu carrito.`);
  };

  const hasFilters = Boolean(
    categoryParam || searchText.trim() || sort !== 'featured' || availability !== 'available',
  );
  const fatalError = categoriesError || productsError;

  return (
    <div className="pt-[var(--public-header-height)] bg-carbon text-cream min-h-screen">
      <section className="border-b border-sand/15 bg-surface-dark/60">
        <ContentContainer size="xl" className="py-10 sm:py-12">
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.18em] text-fire">
            FORJA BRAVA · CARTA DINÁMICA
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="m-0 text-4xl sm:text-5xl font-medium text-cream sigr-heading-display">
                {activeCategory ? activeCategory.name : 'Nuestra'}{' '}
                {!activeCategory && <em className="text-fire">Carta.</em>}
              </h1>
              <p className="m-0 mt-2 max-w-2xl text-sm text-paper/75 leading-relaxed">
                {activeCategory?.description ||
                  'Platos preparados al momento con ingredientes frescos y el sello colombiano a fuego vivo.'}
              </p>
            </div>
            <Badge variant="fire" className="self-start sm:self-end">
              {filteredProducts.length}{' '}
              {filteredProducts.length === 1 ? 'producto' : 'productos'}
            </Badge>
          </div>
        </ContentContainer>
      </section>

      <ContentContainer size="xl" className="py-8">
        {/* Navegación dinámica de categorías */}
        <nav
          aria-label="Categorías del menú"
          className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 border-b border-sand/15"
        >
          <Link
            to="/menu"
            className={[
              'px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] whitespace-nowrap rounded-[var(--radius-sm)] border transition-colors',
              !categoryParam
                ? 'bg-fire text-white border-fire'
                : 'bg-surface-dark text-sand border-sand/20 hover:border-fire hover:text-cream',
            ].join(' ')}
          >
            Todas las categorías
          </Link>
          {!categoriesLoading &&
            categories.map((cat) => {
              const isSelected = categoryParam === cat.slug;
              return (
                <Link
                  key={cat.id}
                  to={`/menu/${cat.slug}`}
                  className={[
                    'px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] whitespace-nowrap rounded-[var(--radius-sm)] border transition-colors',
                    isSelected
                      ? 'bg-fire text-white border-fire'
                      : 'bg-surface-dark text-sand border-sand/20 hover:border-fire hover:text-cream',
                  ].join(' ')}
                >
                  {cat.name}
                </Link>
              );
            })}
        </nav>

        {/* Barra de búsqueda, disponibilidad y ordenamiento */}
        <div className="grid gap-3 md:grid-cols-[1fr_200px_220px] items-center mb-6 p-4 bg-surface rounded-[var(--radius-sm)] border border-border-subtle text-text-primary">
          <SearchInput
            value={searchText}
            onChange={handleSearchChange}
            onClear={handleClearSearch}
            placeholder="Buscar hamburguesas, perros, salchipapas…"
            ariaLabel="Buscar productos por nombre"
          />

          <Select
            aria-label="Filtrar por disponibilidad"
            value={availability}
            onChange={handleAvailabilityChange}
            options={AVAILABILITY_OPTIONS}
          />

          <div className="flex items-center gap-2">
            <SlidersHorizontal
              className="h-4 w-4 text-wood shrink-0 hidden sm:block"
              aria-hidden="true"
            />
            <Select
              aria-label="Ordenar productos"
              value={sort}
              onChange={handleSortChange}
              options={SORT_OPTIONS}
            />
          </div>
        </div>

        {addedBanner && (
          <div
            role="status"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-sm)] bg-success-bg text-success border border-success-border text-xs font-medium"
          >
            <span>{addedBanner}</span>
            <button
              type="button"
              onClick={openDrawer}
              className="underline font-bold uppercase tracking-wider cursor-pointer bg-transparent border-0 text-success"
            >
              Ver carrito
            </button>
          </div>
        )}

        {fatalError ? (
          <ErrorState
            title="No fue posible cargar el menú"
            description={fatalError.message}
            onRetry={() => {
              reloadCategories();
              reloadProducts();
            }}
          />
        ) : productsLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="h-5 w-5" />}
            title={
              searchText.trim()
                ? 'Sin resultados para tu búsqueda'
                : 'No hay productos disponibles en esta categoría'
            }
            description={
              searchText.trim()
                ? `No encontramos platos que coincidan con "${searchText.trim()}". Prueba otro término o limpia los filtros.`
                : 'Prueba explorando otra categoría de nuestra carta.'
            }
            action={
              hasFilters ? (
                <Button variant="primary" size="sm" onClick={handleResetFilters}>
                  Limpiar filtros
                </Button>
              ) : null
            }
          />
        ) : (
          <div
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-live="polite"
          >
            {filteredProducts.map((product) => {
              const productComplements = complementsMap.get(product.id);
              const complementsCount = productComplements ? productComplements.size : 0;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  complementsCount={complementsCount}
                  onQuickAdd={handleQuickAdd}
                />
              );
            })}
          </div>
        )}
      </ContentContainer>
    </div>
  );
}
