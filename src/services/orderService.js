import { getSupabaseClient } from '../lib/supabase';

const RPC_ERROR_MAP = [
  ['IDEMPOTENCY_CONFLICT', 'Esta solicitud ya fue procesada con datos distintos. Recarga el checkout para confirmar un nuevo pedido.'],
  ['DUPLICATE_REQUEST_ID', 'El identificador de solicitud ya fue utilizado.'],
  ['PAYMENT_SIMULATION_FAILED', 'El pago simulado fue rechazado. No se generó ningún pedido ni cobro.'],
  ['CASH_CLOSED', 'En este momento no hay un turno de caja abierto para procesar pagos digitales simulados. Puedes elegir pago en Efectivo o intentar más tarde.'],
  ['OUT_OF_STOCK', 'Uno de los productos de tu carrito dejó de estar disponible. Actualiza tu carrito antes de continuar.'],
  ['INVALID_ADDON_RELATION', 'Uno de los complementos seleccionados no está habilitado para ese producto.'],
  ['CLIENT_TABLE_ORDERS_DISABLED', 'Los pedidos en mesa son registrados únicamente por el mesero del salón.'],
  ['MISSING_ADDRESS', 'Dirección y barrio son obligatorios para pedidos a domicilio.'],
  ['PROFILE_INACTIVE', 'Tu cuenta no se encuentra activa para realizar pedidos.'],
  ['AUTH_REQUIRED', 'Debes iniciar sesión para confirmar un pedido.'],
  ['EMPTY_CART', 'Tu carrito debe incluir al menos un producto.'],
];

export function mapOrderRpcError(error) {
  const raw = String(error?.message || '');
  for (const [code, friendly] of RPC_ERROR_MAP) {
    if (raw.includes(code)) {
      return friendly;
    }
  }
  return 'No fue posible registrar el pedido. Verifica tus datos e intenta nuevamente.';
}

/**
 * Construye el payload estricto esperado por la RPC `public.create_order`.
 * Nunca envía precios ni totales (PostgreSQL los calcula desde la carta vigente).
 */
export function buildOrderRpcPayload({
  modality,
  items = [],
  paymentMethod = 'Efectivo',
  simulatePaymentFailure = false,
  clientRequestId,
  deliveryAddress = '',
  deliveryNeighborhood = '',
  deliveryDirections = '',
  pickupEta = '',
  notes = '',
}) {
  return {
    p_modality: modality,
    p_items: items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      addon_ids: (item.addons || []).map((a) => a.id),
    })),
    p_payment_method: paymentMethod,
    p_simulate_payment_failure: Boolean(simulatePaymentFailure),
    p_client_request_id: clientRequestId,
    p_delivery_address: modality === 'domicilio' ? deliveryAddress || null : null,
    p_delivery_neighborhood: modality === 'domicilio' ? deliveryNeighborhood || null : null,
    p_delivery_directions: modality === 'domicilio' ? deliveryDirections || null : null,
    p_pickup_eta: modality === 'recoger' && pickupEta ? pickupEta : null,
    p_table_id: null,
    p_reservation_id: null,
    p_notes: notes || null,
    p_customer_id: null,
  };
}

/**
 * Crea un pedido de forma atómica e idempotente mediante la RPC `create_order`.
 */
export async function createTransactionalOrder(params) {
  try {
    const client = getSupabaseClient();
    const rpcPayload = buildOrderRpcPayload(params);

    const { data, error } = await client.rpc('create_order', rpcPayload);

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'CREATE_ORDER_ERROR',
          message: mapOrderRpcError(error),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'CREATE_ORDER_EXCEPTION',
        message: mapOrderRpcError(err),
      },
    };
  }
}

export async function fetchCustomerOrders(userId, { statusFilter = 'all' } = {}) {
  if (!userId) return { data: [], error: null };

  try {
    const client = getSupabaseClient();
    let query = client
      .from('orders')
      .select(
        'id, order_number, modality, customer_name, delivery_address, delivery_neighborhood, subtotal, delivery_fee, total, status, payment_status, notes, created_at, updated_at',
      )
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (statusFilter === 'pendientes') {
      query = query.eq('status', 'Pendiente');
    } else if (statusFilter === 'en_curso') {
      query = query.in('status', ['Confirmado', 'En preparación', 'Listo', 'Despachado']);
    } else if (statusFilter === 'entregados') {
      query = query.eq('status', 'Entregado');
    } else if (statusFilter === 'cancelados') {
      query = query.eq('status', 'Cancelado');
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: [],
        error: {
          code: error.code || 'ORDERS_FETCH_ERROR',
          message: 'No fue posible consultar tus pedidos.',
        },
      };
    }

    return {
      data: (data ?? []).map((o) => ({
        ...o,
        subtotal: Number(o.subtotal) || 0,
        delivery_fee: Number(o.delivery_fee) || 0,
        total: Number(o.total) || 0,
      })),
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'ORDERS_FETCH_EXCEPTION',
        message: 'Error de conexión al consultar pedidos.',
      },
    };
  }
}

export async function fetchCustomerOrderDetail(orderId) {
  if (!orderId) {
    return {
      data: null,
      error: { code: 'INVALID_ID', message: 'Pedido no especificado.' },
    };
  }

  try {
    const client = getSupabaseClient();
    const [orderRes, itemsRes, historyRes, paymentsRes] = await Promise.all([
      client
        .from('orders')
        .select(
          'id, order_number, customer_id, modality, customer_name, customer_email, customer_phone, delivery_address, delivery_neighborhood, delivery_directions, pickup_eta, notes, subtotal, delivery_fee, total, status, payment_status, created_at, updated_at',
        )
        .eq('id', orderId)
        .maybeSingle(),
      client
        .from('order_items')
        .select(
          'id, product_id, product_name_snapshot, unit_price_snapshot, quantity, addons_snapshot, addons_total, line_total, notes',
        )
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
      client
        .from('order_status_history')
        .select('id, previous_status, new_status, reason, changed_at')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: true }),
      client
        .from('payments')
        .select('id, method, status, amount, transaction_ref, is_simulated, disclaimer, paid_at, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false }),
    ]);

    if (orderRes.error) {
      return {
        data: null,
        error: {
          code: orderRes.error.code || 'ORDER_DETAIL_ERROR',
          message: 'No fue posible consultar el detalle del pedido.',
        },
      };
    }

    if (!orderRes.data) {
      return {
        data: null,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'No tienes acceso a este pedido o no existe.',
        },
      };
    }

    return {
      data: {
        ...orderRes.data,
        subtotal: Number(orderRes.data.subtotal) || 0,
        delivery_fee: Number(orderRes.data.delivery_fee) || 0,
        total: Number(orderRes.data.total) || 0,
        items: (itemsRes.data ?? []).map((item) => ({
          ...item,
          unit_price_snapshot: Number(item.unit_price_snapshot) || 0,
          addons_total: Number(item.addons_total) || 0,
          line_total: Number(item.line_total) || 0,
        })),
        history: historyRes.data ?? [],
        payments: (paymentsRes.data ?? []).map((p) => ({
          ...p,
          amount: Number(p.amount) || 0,
        })),
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'ORDER_DETAIL_EXCEPTION',
        message: 'Error de conexión al consultar el detalle del pedido.',
      },
    };
  }
}
