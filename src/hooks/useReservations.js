import { useCallback, useEffect, useState } from 'react';
import {
  cancelCustomerReservation,
  createCustomerReservation,
  fetchCustomerReservations,
} from '../services/reservationService';

export function useReservations(userId) {
  const [reservations, setReservations] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    fetchCustomerReservations(userId).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
      } else {
        setReservations(res.data);
        setError(null);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId, reloadToken]);

  const createReservation = useCallback(
    async (input) => {
      const res = await createCustomerReservation(input);
      if (!res.error) reload();
      return res;
    },
    [reload],
  );

  const cancelReservation = useCallback(
    async (reservationId, reason) => {
      const res = await cancelCustomerReservation(reservationId, reason);
      if (!res.error) reload();
      return res;
    },
    [reload],
  );

  return {
    reservations,
    isLoading,
    error,
    reload,
    createReservation,
    cancelReservation,
  };
}
