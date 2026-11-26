import { getSupabaseClient } from '../lib/supabase';

const ADMIN_ORDER_TRANSITIONS = {
  Pendiente: ['Confirmado', 'Cancelado'],
  Confirmado: ['En preparación', 'Cancelado'],
  'En preparación': ['Listo', 'Cancelado'],
  Listo: ['Despachado', 'Entregado', 'Cancelado'],
  Despachado: ['Entregado', 'Cancelado'],
  Entregado: [],
  Cancelado: [],
};

const REFUND_RPC_ERROR_MAP = [
  ['INSUFFICIENT_CASH_FOR_REFUND', 'Efectivo físico insuficiente en la sesión de caja activa para cubrir este reembolso.'],
  ['CASH_CLOSED', 'Debes tener una sesión de caja abierta para contabilizar el reembolso en los movimientos de caja.'],
  ['ALREADY_REFUNDED', 'Este pago ya tiene un reembolso registrado y no admite reembolsos duplicados.'],
  ['NO_CONFIRMED_PAYMENT', 'El pedido no tiene un pago confirmado susceptible de reembolso.'],
  ['ORDER_NOT_CANCELLED', 'El pedido debe encontrarse en estado Cancelado antes de gestionar un reembolso.'],
  ['UNSUPPORTED_TABLE_REFUND', 'Los pedidos de mesa no tienen pagos individuales; gestiona el ajuste a nivel de cuenta.'],
  ['FORBIDDEN_ROLE', 'Solo el administrador puede ejecutar reembolsos de pedidos.'],
];

function mapRefundRpcError(error) {
  const raw = String(error?.message || '');
  for (const [code, friendly] of REFUND_RPC_ERROR_MAP) {
    if (raw.includes(code)) return friendly;
  }
  return error?.message || 'No fue posible procesar el reembolso del pedido.';
}

export function getAllowedAdminNextStatuses(order) {
  if (!order) return [];
  const base = ADMIN_ORDER_TRANSITIONS[order.status] ?? [];
  return base.filter((st) => !(st === 'Despachado' && order.modality !== 'domicilio'));
}

export function getOrderRefundSummary(order) {
  const payments = Array.isArray(order?.payments) ? order.payments : [];
  const confirmedPayment = payments.find((p) => p.status === 'Confirmación simulada') || null;
  const refundedPayments = payments.filter((p) => p.status === 'Reembolsado');

  const fallbackPaid =
    !confirmedPayment &&
    refundedPayments.length === 0 &&
    order?.payment_status === 'Confirmación simulada'
      ? Number(order?.total) || 0
      : 0;

  const paidAmount = confirmedPayment
    ? Number(confirmedPayment.amount) || 0
    : refundedPayments.length > 0
      ? Number(refundedPayments[0]?.amount) || 0
      : fallbackPaid;

  const refundedAmount = refundedPayments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  );

  const hasConfirmed =
    Boolean(confirmedPayment) ||
    (payments.length === 0 && order?.payment_status === 'Confirmación simulada');

  const refundableBalance =
    hasConfirmed && refundedPayments.length === 0
      ? Math.max(0, paidAmount - refundedAmount)
      : 0;

  const paymentMethod =
    confirmedPayment?.method || refundedPayments[0]?.method || 'Efectivo';

  const canRefund =
    order?.status === 'Cancelado' &&
    order?.modality !== 'mesa' &&
    hasConfirmed &&
    refundableBalance > 0;

  return {
    confirmedPayment,
    refundedPayments,
    paidAmount,
    refundedAmount,
    refundableBalance,
    paymentMethod,
    paymentStatus: order?.payment_status || confirmedPayment?.status || 'Pendiente',
    transactionRef:
      confirmedPayment?.transaction_ref || refundedPayments[0]?.transaction_ref || '—',
    canRefund,
  };
}

export async function fetchAdminOrders({ status = 'all', modality = 'all' } = {}) {
  try {
    const client = getSupabaseClient();
    let query = client
      .from('orders')
      .select(
        'id, order_number, customer_id, waiter_id, table_id, table_account_id, modality, customer_name, customer_phone, delivery_address, delivery_neighborhood, subtotal, delivery_fee, total, status, payment_status, notes, created_at, updated_at, payments ( id, method, status, amount, transaction_ref, is_simulated, paid_at, created_at ), order_items ( id, product_name_snapshot, unit_price_snapshot, quantity, addons_snapshot, addons_total, line_total, notes ), order_status_history ( id, previous_status, new_status, reason, changed_at )',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (status && status !== 'all') query = query.eq('status', status);
    if (modality && modality !== 'all') query = query.eq('modality', modality);

    const { data, error } = await query;
    if (error) {
      return { data: [], error: { code: error.code, message: 'No fue posible consultar los pedidos.' } };
    }

    const rows = (data ?? []).map((o) => ({
      ...o,
      subtotal: Number(o.subtotal) || 0,
      delivery_fee: Number(o.delivery_fee) || 0,
      total: Number(o.total) || 0,
      payments: (o.payments ?? []).map((p) => ({
        ...p,
        amount: Number(p.amount) || 0,
      })),
    }));

    return { data: rows, error: null };
  } catch (err) {
    return { data: [], error: { code: err.code, message: 'Error de conexión al consultar pedidos.' } };
  }
}

export async function adminTransitionOrderStatus(orderId, newStatus, reason = '') {
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
          code: error.code || 'ADMIN_ORDER_STATUS_ERROR',
          message: error.message || 'No fue posible actualizar el estado del pedido.',
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: { code: err.code, message: 'Error de conexión al actualizar el pedido.' } };
  }
}

export async function adminRefundOrderPayment(orderId, reason) {
  const cleanReason = String(reason || '').trim();
  if (!orderId) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Debes indicar el pedido a reembolsar.' },
    };
  }
  if (cleanReason.length < 4) {
    return {
      data: null,
      error: {
        code: 'REASON_REQUIRED',
        message: 'Ingresa un motivo obligatorio (mínimo 4 caracteres) para auditar el reembolso.',
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('refund_order_payment', {
      p_order_id: orderId,
      p_reason: cleanReason,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'ADMIN_REFUND_ERROR',
          message: mapRefundRpcError(error),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'ADMIN_REFUND_EXCEPTION',
        message: mapRefundRpcError(err),
      },
    };
  }
}
