import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isSupabaseConfigured } from '../lib/env';
import {
  clearPersistedCart,
  loadPersistedCart,
  savePersistedCart,
  syncCartWithSupabase,
} from '../services/cartService';
import {
  calculateCartTotals,
  mergeCartItem,
  removeCartItem,
  updateCartItemQuantity,
} from '../utils/cartUtils';
import { CartContext } from './cartContextInstance';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => loadPersistedCart());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [syncError, setSyncError] = useState('');
  const [lastAddedFeedback, setLastAddedFeedback] = useState('');

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
    savePersistedCart(items);
  }, [items]);

  const syncWithCatalog = useCallback(async () => {
    const current = itemsRef.current;
    if (!isSupabaseConfigured || current.length === 0) {
      return { priceChangesCount: 0, unavailableDetected: 0, error: null };
    }

    setIsSyncing(true);
    setSyncError('');
    try {
      const result = await syncCartWithSupabase(current);
      if (result.error) {
        setSyncError(result.error.message);
        return result;
      }

      setItems(result.items);

      if (result.priceChangesCount > 0 && result.unavailableDetected > 0) {
        setSyncNotice(
          'Actualizamos precios vigentes desde la carta y marcamos productos que dejaron de estar disponibles.',
        );
      } else if (result.priceChangesCount > 0) {
        setSyncNotice(
          'Uno o más precios fueron actualizados al valor vigente de la carta.',
        );
      } else if (result.unavailableDetected > 0) {
        setSyncNotice(
          'Uno o más productos de tu carrito ya no están disponibles. Retíralos para continuar.',
        );
      } else {
        setSyncNotice('');
      }

      return result;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Revalidar automáticamente el carrito recuperado de localStorage al iniciar la app
  useEffect(() => {
    if (!isSupabaseConfigured || itemsRef.current.length === 0) {
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        syncWithCatalog();
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [syncWithCatalog]);

  const addItem = useCallback((incomingItem, { openCartDrawer = false } = {}) => {
    if (!incomingItem?.productId) return;
    setItems((prev) => mergeCartItem(prev, incomingItem));
    setLastAddedFeedback(`${incomingItem.name} agregado al carrito.`);
    if (openCartDrawer) {
      setIsDrawerOpen(true);
    }
  }, []);

  const removeItem = useCallback((lineKey) => {
    setItems((prev) => removeCartItem(prev, lineKey));
  }, []);

  const setItemQuantity = useCallback((lineKey, quantity) => {
    setItems((prev) => updateCartItemQuantity(prev, lineKey, quantity));
  }, []);

  const incrementItem = useCallback((lineKey) => {
    setItems((prev) => {
      const target = prev.find((item) => item.lineKey === lineKey);
      if (!target) return prev;
      return updateCartItemQuantity(prev, lineKey, target.quantity + 1);
    });
  }, []);

  const decrementItem = useCallback((lineKey) => {
    setItems((prev) => {
      const target = prev.find((item) => item.lineKey === lineKey);
      if (!target) return prev;
      return updateCartItemQuantity(prev, lineKey, target.quantity - 1);
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setSyncNotice('');
    setSyncError('');
    setLastAddedFeedback('');
    clearPersistedCart();
  }, []);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), []);
  const dismissSyncNotice = useCallback(() => setSyncNotice(''), []);
  const clearFeedback = useCallback(() => setLastAddedFeedback(''), []);

  const totals = useMemo(() => calculateCartTotals(items), [items]);

  const value = useMemo(
    () => ({
      items,
      ...totals,
      isDrawerOpen,
      isSyncing,
      syncNotice,
      syncError,
      lastAddedFeedback,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      addItem,
      removeItem,
      incrementItem,
      decrementItem,
      setItemQuantity,
      clearCart,
      syncWithCatalog,
      dismissSyncNotice,
      clearFeedback,
    }),
    [
      items,
      totals,
      isDrawerOpen,
      isSyncing,
      syncNotice,
      syncError,
      lastAddedFeedback,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      addItem,
      removeItem,
      incrementItem,
      decrementItem,
      setItemQuantity,
      clearCart,
      syncWithCatalog,
      dismissSyncNotice,
      clearFeedback,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
