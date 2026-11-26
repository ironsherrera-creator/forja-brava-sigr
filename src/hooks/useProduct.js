import { useCallback, useEffect, useState } from 'react';
import { fetchComplementsForProduct } from '../services/complementService';
import { fetchProductBySlug } from '../services/productService';

export function useProduct(slug) {
  const [product, setProduct] = useState(null);
  const [complements, setComplements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const res = await fetchProductBySlug(slug);
      if (!active) return;

      if (res.error || !res.data) {
        setError(res.error);
        setProduct(null);
        setComplements([]);
        setIsLoading(false);
        return;
      }

      setProduct(res.data);
      setError(null);

      const compRes = await fetchComplementsForProduct(res.data.id);
      if (!active) return;

      if (!compRes.error) {
        setComplements(compRes.data);
      } else {
        setComplements([]);
      }
      setIsLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [slug, reloadToken]);

  return { product, complements, isLoading, error, reload };
}
