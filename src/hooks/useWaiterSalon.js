import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchWaiterSalonSnapshot,
  subscribeToWaiterSalon,
} from '../services/waiterService';

export function useWaiterSalon({ pollIntervalMs = 25000 } = {}) {
  const [tables, setTables] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const res = await fetchWaiterSalonSnapshot();
      if (!active) return;
      if (res.error) {
        setError(res.error);
      } else {
        setTables(res.data.tables);
        setAccounts(res.data.accounts);
        setOrders(res.data.orders);
        setStaffDirectory(res.data.staffDirectory ?? []);
        setError(null);
      }
      setIsLoading(false);
    };

    load();
    const unsubscribe = subscribeToWaiterSalon(load);
    const timer = setInterval(load, pollIntervalMs);

    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, [reloadToken, pollIntervalMs]);

  const staffById = useMemo(
    () => new Map(staffDirectory.map((s) => [s.staff_id, s])),
    [staffDirectory],
  );

  return {
    tables,
    accounts,
    orders,
    staffDirectory,
    staffById,
    isLoading,
    error,
    reload,
  };
}
