import { useEffect, useState } from 'react';
import { fetchRestaurantSettings } from '../services/catalogService';

export function useRestaurantSettings() {
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchRestaurantSettings().then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
      } else {
        setSettings(res.data);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { settings, isLoading, error };
}
