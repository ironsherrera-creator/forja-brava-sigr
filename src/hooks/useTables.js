import { useCallback, useEffect, useState } from 'react';
import {
  createRestaurantTable,
  fetchRestaurantTables,
  toggleRestaurantTableActive,
  updateRestaurantTable,
} from '../services/tableService';

export function useTables() {
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetchRestaurantTables().then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
      } else {
        setTables(res.data);
        setError(null);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const createTable = useCallback(
    async (input) => {
      const res = await createRestaurantTable(input);
      if (!res.error) reload();
      return res;
    },
    [reload],
  );

  const editTable = useCallback(
    async (tableId, input) => {
      const res = await updateRestaurantTable(tableId, input);
      if (!res.error) reload();
      return res;
    },
    [reload],
  );

  const toggleActive = useCallback(
    async (table) => {
      const res = await toggleRestaurantTableActive(table);
      if (!res.error) reload();
      return res;
    },
    [reload],
  );

  return {
    tables,
    isLoading,
    error,
    reload,
    createTable,
    editTable,
    toggleActive,
  };
}
