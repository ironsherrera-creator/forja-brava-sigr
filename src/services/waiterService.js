import { getSupabaseClient, supabase } from '../lib/supabase';
import { waiterCreateOrderSchema } from '../schemas/waiterSchemas';

const WAITER_RPC_ERROR_MAP = [
  ['ACCOUNT_CLOSING_REQUESTED', 'Esta cuenta ya tiene solicitud de cierre pendiente y no admite nuevos pedidos.'],
  ['TABLE_UNAVAILABLE', 'La mesa seleccionada no está activa o se encuentra fuera de servicio.'],
  ['TABLE_RESERVED_NOW', 'La mesa tiene una reserva confirmada en este bloque horario.'],
  ['OUT_OF_STOCK', 'Uno de los productos seleccionados ya no está disponible en la carta.'],
  ['INVALID_ADDON_RELATION', 'Uno de los complementos seleccionados no corresponde al producto o no está disponible.'],
  ['FORBIDDEN_CANCEL', 'Solo puedes cancelar pedidos recién registrados que sigan en estado Pendiente.'],
  ['INVALID_TRANSITION', 'Esta transición de estado no está permitida para el pedido actual.'],
  ['FORBIDDEN_ROLE', 'No cuentas con permisos para ejecutar esta acción operativa (D-05).'],
  ['IDEMPOTENCY_CONFLICT', 'Esta comanda ya fue procesada con un contenido diferente. Genera una nueva comanda.'],
  ['INVALID_ACCOUNT_STATE', 'La cuenta de mesa no se encuentra abierta para solicitar cierre.'],
  ['EMPTY_CART', 'Agrega al menos un producto antes de confirmar la comanda.'],
];

export function mapWaiterRpcError(error, fallback = 'No fue posible completar la operación de salón.') {
  const raw = String(error?.message || '');
  for (const [code, friendly] of WAITER_RPC_ERROR_MAP) {
    if (raw.includes(code)) return friendly;
  }
  return fallback;
}

export function generateWaiterRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Carga estado completo del salón en vivo: mesas, cuentas activas y pedidos de mesa.
 */
export async function fetchWaiterSalonSnapshot() {
  try {
    const client = getSupabaseClient();
    const staffPromise =
      typeof client.rpc === 'function'
        ? Promise.resolve(client.rpc('get_salon_staff_directory')).catch(() => ({
            data: [],
            error: null,
          }))
        : Promise.resolve({ data: [], error: null });

    const [tablesRes, accountsRes, ordersRes, staffRes] = await Promise.all([
      client
        .from('restaurant_tables')
        .select('id, code, zone, capacity, status, is_active, updated_at')
        .order('zone', { ascending: true })
        .order('code', { ascending: true }),
      client
        .from('table_accounts')
        .select('id, table_id, opened_by, status, total_amount, notes, opened_at, closing_requested_at')
        .in('status', ['open', 'closing_requested'])
        .order('opened_at', { ascending: false }),
      client
        .from('orders')
        .select(
          'id, order_number, table_id, table_account_id, waiter_id, customer_name, modality, subtotal, total, status, payment_status, notes, created_at, updated_at, order_items ( id, product_id, product_name_snapshot, unit_price_snapshot, quantity, addons_snapshot, addons_total, line_total, notes )',
        )
        .eq('modality', 'mesa')
        .order('created_at', { ascending: false })
        .limit(200),
      staffPromise,
    ]);

    if (tablesRes.error || accountsRes.error || ordersRes.error) {
      return {
        data: null,
        error: {
          code: 'WAITER_SNAPSHOT_ERROR',
          message: 'No fue posible cargar la información operativa del salón.',
        },
      };
    }

    const tables = tablesRes.data ?? [];
    const accounts = (accountsRes.data ?? []).map((a) => ({
      ...a,
      total_amount: Number(a.total_amount) || 0,
    }));
    const orders = (ordersRes.data ?? []).map((o) => ({
      ...o,
      subtotal: Number(o.subtotal) || 0,
      total: Number(o.total) || 0,
      order_items: (o.order_items ?? []).map((i) => ({
        ...i,
        unit_price_snapshot: Number(i.unit_price_snapshot) || 0,
        addons_total: Number(i.addons_total) || 0,
        line_total: Number(i.line_total) || 0,
      })),
    }));
    const staffDirectory = Array.isArray(staffRes?.data)
      ? staffRes.data.map((s) => ({
          staff_id: s.staff_id,
          visible_name: s.visible_name,
          role_code: s.role_code,
          active_table_codes: Array.isArray(s.active_table_codes) ? s.active_table_codes : [],
        }))
      : [];

    return {
      data: { tables, accounts, orders, staffDirectory },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'WAITER_SNAPSHOT_EXCEPTION',
        message: 'Error de conexión al consultar el salón.',
      },
    };
  }
}

/**
 * Registra una comanda en mesa de forma atómica e idempotente mediante `create_table_order`.
 * Nunca envía precios ni totales desde el navegador.
 */
export async function submitWaiterTableOrder({
  tableId,
  items,
  notes = '',
  clientRequestId,
  reservationId = null,
}) {
  const parsed = waiterCreateOrderSchema.safeParse({ tableId, items, notes });
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Revisa los datos de la comanda.',
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const rpcItems = parsed.data.items.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
      addon_ids: line.addonIds,
      notes: line.notes || null,
    }));

    const { data, error } = await client.rpc('create_table_order', {
      p_table_id: parsed.data.tableId,
      p_items: rpcItems,
      p_notes: parsed.data.notes || null,
      p_client_request_id: clientRequestId || generateWaiterRequestId(),
      p_reservation_id: reservationId || null,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'CREATE_TABLE_ORDER_ERROR',
          message: mapWaiterRpcError(error, 'No fue posible registrar la comanda en la mesa.'),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'CREATE_TABLE_ORDER_EXCEPTION',
        message: mapWaiterRpcError(err, 'Error de conexión al registrar la comanda.'),
      },
    };
  }
}

/**
 * Actualiza estado de pedido de mesa conforme a D-05:
 * - Solo `Entregado` (desde `Listo`) o `Cancelado` (desde `Pendiente`).
 */
export async function updateWaiterOrderStatus(orderId, newStatus, reason = '') {
  if (!orderId || !['Entregado', 'Cancelado'].includes(newStatus)) {
    return {
      data: null,
      error: {
        code: 'FORBIDDEN_STATUS',
        message: 'El mesero únicamente puede marcar pedidos como Entregado o cancelar pedidos Pendientes (D-05).',
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_reason: reason || null,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'UPDATE_ORDER_STATUS_ERROR',
          message: mapWaiterRpcError(error, 'No fue posible actualizar el estado del pedido.'),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'UPDATE_ORDER_STATUS_EXCEPTION',
        message: mapWaiterRpcError(err),
      },
    };
  }
}

/**
 * Solicita el cierre de una cuenta acumulada abierta (D-04).
 * No cobra ni cierra definitivamente la cuenta (eso pertenece a Caja administrativa).
 */
export async function requestTableAccountClose(tableAccountId) {
  if (!tableAccountId) {
    return {
      data: null,
      error: { code: 'INVALID_ACCOUNT', message: 'Cuenta de mesa no especificada.' },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('request_table_account_close', {
      p_table_account_id: tableAccountId,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'REQUEST_CLOSE_ERROR',
          message: mapWaiterRpcError(error, 'No fue posible solicitar el cierre de la cuenta.'),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'REQUEST_CLOSE_EXCEPTION',
        message: mapWaiterRpcError(err),
      },
    };
  }
}

/**
 * Suscripción Realtime al salón (mesas, cuentas y pedidos) con limpieza segura.
 */
export function subscribeToWaiterSalon(onChange) {
  if (!supabase || typeof supabase.channel !== 'function') {
    return () => {};
  }

  const channel = supabase
    .channel('waiter-salon-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'table_accounts' }, () => onChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => onChange?.())
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      // Ignorar errores al cerrar canal
    }
  };
}
