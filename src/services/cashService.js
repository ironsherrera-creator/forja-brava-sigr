import { getSupabaseClient } from '../lib/supabase';
import {
  cashMovementSchema,
  closeCashSessionSchema,
  openCashSessionSchema,
} from '../schemas/cashSchemas';
import { validateCashReceived } from '../utils/cashCalculations';

const CASH_ERROR_MAP = [
  ['CASH_ALREADY_OPEN', 'Ya existe una sesión de caja abierta. Cierra el turno actual antes de abrir uno nuevo.'],
  ['CASH_CLOSED', 'No hay una sesión de caja abierta. Abre un turno de caja primero.'],
  ['SESSION_NOT_OPEN', 'La sesión de caja indicada ya se encuentra cerrada o no existe.'],
  ['PENDING_ORDERS_IN_ACCOUNT', 'Existen comandas en preparación o sin entregar en esta mesa. Entrégalas o cancélalas antes de cobrar.'],
  ['ACCOUNT_NOT_OPEN', 'Esta cuenta de mesa ya fue cerrada o no existe.'],
  ['ALREADY_PAID', 'El pago de este pedido ya fue confirmado anteriormente.'],
  ['ALREADY_ACCOUNTED', 'Este pago ya se encuentra contabilizado en caja.'],
  ['INSUFFICIENT_CASH_FOR_REFUND', 'Efectivo físico insuficiente en caja para realizar este reembolso.'],
  ['INSUFFICIENT_CASH_RECEIVED', 'El efectivo recibido es inferior al saldo pendiente a cobrar.'],
  ['RECEIVED_AMOUNT_ONLY_FOR_CASH', 'El monto recibido en efectivo no aplica para pagos digitales.'],
  ['INVALID_RECEIVED_AMOUNT', 'El monto recibido no tiene una precisión monetaria válida.'],
  ['FORBIDDEN_ROLE', 'Solo el administrador está autorizado para operar Caja.'],
  ['INVALID_AMOUNT', 'El importe ingresado no es válido.'],
  ['INVALID_CONCEPT', 'El concepto del movimiento es obligatorio.'],
];

export function mapCashRpcError(error, fallback = 'No fue posible completar la operación de caja.') {
  const raw = String(error?.message || '');
  for (const [code, msg] of CASH_ERROR_MAP) {
    if (raw.includes(code)) return msg;
  }
  return fallback;
}

/**
 * Carga estado completo de Caja: sesión activa, historial de sesiones, movimientos,
 * cuentas de mesa abiertas/por cerrar y pedidos individuales pendientes de pago.
 */
export async function fetchCashSnapshot() {
  try {
    const client = getSupabaseClient();
    const [sessionsRes, movementsRes, accountsRes, pendingOrdersRes, tablesRes] =
      await Promise.all([
        client
          .from('cash_sessions')
          .select('*')
          .order('opened_at', { ascending: false })
          .limit(50),
        client
          .from('cash_movements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        client
          .from('table_accounts')
          .select('id, table_id, status, total_amount, opened_at, closing_requested_at')
          .in('status', ['open', 'closing_requested'])
          .order('closing_requested_at', { ascending: false, nullsFirst: false }),
        client
          .from('orders')
          .select('id, order_number, modality, customer_name, total, status, payment_status, created_at')
          .in('modality', ['domicilio', 'recoger'])
          .eq('payment_status', 'Pendiente')
          .neq('status', 'Cancelado')
          .order('created_at', { ascending: false }),
        client.from('restaurant_tables').select('id, code, zone'),
      ]);

    if (sessionsRes.error || movementsRes.error) {
      return {
        data: null,
        error: { code: 'CASH_SNAPSHOT_ERROR', message: 'No fue posible cargar la información de caja.' },
      };
    }

    const sessions = sessionsRes.data ?? [];
    const activeSession = sessions.find((s) => s.status === 'open') || null;
    const movements = (movementsRes.data ?? []).map((m) => ({
      ...m,
      amount: Number(m.amount) || 0,
    }));
    const activeMovements = activeSession
      ? movements.filter((m) => m.cash_session_id === activeSession.id)
      : [];

    const tableMap = new Map((tablesRes.data ?? []).map((t) => [t.id, t]));
    const openAccounts = (accountsRes.data ?? []).map((a) => ({
      ...a,
      total_amount: Number(a.total_amount) || 0,
      table: tableMap.get(a.table_id) || null,
    }));

    const pendingOrders = (pendingOrdersRes.data ?? []).map((o) => ({
      ...o,
      total: Number(o.total) || 0,
    }));

    return {
      data: {
        activeSession,
        sessions,
        movements,
        activeMovements,
        openAccounts,
        pendingOrders,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: { code: err.code || 'CASH_SNAPSHOT_EXCEPTION', message: 'Error de conexión al consultar caja.' },
    };
  }
}

export async function openCashSession(input) {
  const parsed = openCashSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Datos inválidos.' },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('open_cash_session', {
      p_opening_balance: parsed.data.openingBalance,
      p_notes: parsed.data.notes || null,
    });
    if (error) {
      return { data: null, error: { code: error.code, message: mapCashRpcError(error) } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: { code: err.code, message: mapCashRpcError(err) } };
  }
}

export async function registerManualCashMovement(input) {
  const parsed = cashMovementSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Datos inválidos.' },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('register_cash_movement', {
      p_movement_type: parsed.data.movementType,
      p_payment_method: parsed.data.paymentMethod,
      p_amount: parsed.data.amount,
      p_concept: parsed.data.concept,
    });
    if (error) {
      return { data: null, error: { code: error.code, message: mapCashRpcError(error) } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: { code: err.code, message: mapCashRpcError(err) } };
  }
}

export async function settleTableAccountPayment(
  tableAccountId,
  paymentMethod,
  receivedAmount = null,
  amountDue = 0,
) {
  const cashVal = validateCashReceived({
    method: paymentMethod,
    receivedInput: receivedAmount ?? '',
    amountDue,
  });
  if (!cashVal.valid) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: cashVal.error },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('settle_table_account', {
      p_table_account_id: tableAccountId,
      p_payment_method: paymentMethod,
      p_received_amount: cashVal.receivedAmount,
    });
    if (error) {
      return { data: null, error: { code: error.code, message: mapCashRpcError(error) } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: { code: err.code, message: mapCashRpcError(err) } };
  }
}

export async function confirmIndividualOrderPayment(
  orderId,
  paymentMethod,
  receivedAmount = null,
  amountDue = 0,
) {
  const cashVal = validateCashReceived({
    method: paymentMethod,
    receivedInput: receivedAmount ?? '',
    amountDue,
  });
  if (!cashVal.valid) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: cashVal.error },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('confirm_order_payment', {
      p_order_id: orderId,
      p_payment_method: paymentMethod,
      p_received_amount: cashVal.receivedAmount,
    });
    if (error) {
      return { data: null, error: { code: error.code, message: mapCashRpcError(error) } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: { code: err.code, message: mapCashRpcError(err) } };
  }
}

export async function closeActiveCashSession(cashSessionId, input) {
  const parsed = closeCashSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Datos inválidos.' },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('close_cash_session', {
      p_cash_session_id: cashSessionId,
      p_counted_cash: parsed.data.countedCash,
      p_notes: parsed.data.notes || null,
    });
    if (error) {
      return { data: null, error: { code: error.code, message: mapCashRpcError(error) } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: { code: err.code, message: mapCashRpcError(err) } };
  }
}
