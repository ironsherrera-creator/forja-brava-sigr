import { useCallback, useEffect, useState } from 'react';
import { fetchCustomerOrders } from '../services/orderService';

export function useOrders(userId, { statusFilter = 'all' } = {}) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    fetchCustomerOrders(userId, { statusFilter }).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
      } else {
        setOrders(res.data);
        setError(null);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId, statusFilter, reloadToken]);

  return { orders, isLoading, error, reload };
}
