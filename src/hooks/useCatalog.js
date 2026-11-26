import { useCallback, useEffect, useState } from 'react';
import { fetchComplementsMapForProducts } from '../services/complementService';
import { fetchPublicProducts } from '../services/productService';

export function useCatalog({
  categorySlug = '',
  search = '',
  sort = 'featured',
  includeAddons = true,
} = {}) {
  const [products, setProducts] = useState([]);
  const [complementsMap, setComplementsMap] = useState(() => new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const productsRes = await fetchPublicProducts({
        categorySlug,
        search,
        sort,
        includeAddons,
      });

      if (!active) return;

      if (productsRes.error) {
        setError(productsRes.error);
        setProducts([]);
        setComplementsMap(new Map());
        setIsLoading(false);
        return;
      }

      const list = productsRes.data || [];
      setProducts(list);
      setError(null);

      if (list.length > 0) {
        const compRes = await fetchComplementsMapForProducts(list.map((p) => p.id));
        if (active && !compRes.error) {
          setComplementsMap(compRes.data);
        }
      } else {
        setComplementsMap(new Map());
      }

      if (active) {
        setIsLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [categorySlug, search, sort, includeAddons, reloadToken]);

  return { products, complementsMap, isLoading, error, reload };
}
