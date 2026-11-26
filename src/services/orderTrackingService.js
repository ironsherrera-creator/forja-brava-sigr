import { supabase } from '../lib/supabase';

/**
 * Suscribe a cambios en tiempo real sobre un pedido específico del cliente.
 * Retorna una función `unsubscribe()` limpia. Si Realtime no está disponible,
 * el consumidor utiliza polling controlado como respaldo.
 */
export function subscribeToCustomerOrder(orderId, onChange) {
  if (!supabase || typeof supabase.channel !== 'function' || !orderId) {
    return () => {};
  }

  const channel = supabase
    .channel(`order-tracking-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      () => {
        onChange?.();
      },
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      // Ignorar errores al desmontar canal
    }
  };
}
