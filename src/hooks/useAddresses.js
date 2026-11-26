import { useCallback, useEffect, useState } from 'react';
import {
  createUserAddress,
  deleteUserAddress,
  fetchUserAddresses,
  setDefaultUserAddress,
  updateUserAddress,
} from '../services/addressService';

export function useAddresses(userId) {
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    fetchUserAddresses(userId).then((res) => {
      if (!active) return;
      if (res.error) {
        setError(res.error);
      } else {
        setAddresses(res.data);
        setError(null);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId, reloadToken]);

  const addAddress = useCallback(
    async (input) => {
      const res = await createUserAddress(userId, input);
      if (!res.error) reload();
      return res;
    },
    [userId, reload],
  );

  const editAddress = useCallback(
    async (addressId, input) => {
      const res = await updateUserAddress(userId, addressId, input);
      if (!res.error) reload();
      return res;
    },
    [userId, reload],
  );

  const makeDefault = useCallback(
    async (addressId) => {
      const res = await setDefaultUserAddress(userId, addressId);
      if (!res.error) reload();
      return res;
    },
    [userId, reload],
  );

  const removeAddress = useCallback(
    async (addressId) => {
      const res = await deleteUserAddress(userId, addressId);
      if (!res.error) reload();
      return res;
    },
    [userId, reload],
  );

  return {
    addresses,
    isLoading,
    error,
    reload,
    addAddress,
    editAddress,
    makeDefault,
    removeAddress,
  };
}
