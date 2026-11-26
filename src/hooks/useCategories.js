import { useCallback, useEffect, useState } from 'react';
import { fetchActiveCategories } from '../services/categoryService';

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetchActiveCategories();
    if (res.error) {
      setError(res.error);
      setCategories([]);
    } else {
      setCategories(res.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchActiveCategories().then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
        setCategories([]);
      } else {
        setCategories(res.data);
        setError(null);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { categories, isLoading, error, reload: load };
}
