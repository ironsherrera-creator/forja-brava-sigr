import { getSupabaseClient } from '../lib/supabase';
import { extractFieldErrors } from '../schemas/authSchemas';
import { reservationCreateSchema } from '../schemas/clientSchemas';

const RESERVATION_ERROR_MAP = [
  ['SLOT_UNAVAILABLE', 'No hay mesas disponibles para ese horario y número de personas. Selecciona otra franja.'],
  ['RESTAURANT_CLOSED', 'El restaurante no atiende reservas en el día seleccionado.'],
  ['OUT_OF_HOURS', 'El horario seleccionado está fuera del horario de atención configurado.'],
  ['PAST_RESERVATION', 'No es posible reservar en fechas u horarios que ya pasaron.'],
  ['CANCEL_WINDOW_EXPIRED', 'Ya venció el plazo mínimo de anticipación para cancelar en línea.'],
  ['FORBIDDEN_ROLE', 'No cuentas con permisos para realizar esta acción sobre la reserva.'],
  ['INSUFFICIENT_CAPACITY', 'La mesa seleccionada no tiene capacidad suficiente para el número de personas.'],
  ['RESERVATION_CONFLICT', 'La mesa ya tiene una reserva solapada en ese horario.'],
  ['TABLE_UNAVAILABLE', 'La mesa seleccionada no está activa o se encuentra fuera de servicio.'],
  ['INVALID_TRANSITION', 'La transición de estado solicitada no está permitida para esta reserva.'],
  ['INVALID_TABLE_CHANGE', 'No es posible reasignar mesa en el estado actual de la reserva.'],
  ['Could not find the function', 'La operación transaccional de reservas no está disponible en el servidor. Verifica el despliegue de las migraciones.'],
  ['excl_reservations_no_overlap', 'La mesa acaba de ser asignada a otra reserva en ese mismo horario. Intenta con otra franja.'],
];

export function mapReservationError(error) {
  const raw = String(error?.message || '');
  for (const [code, friendly] of RESERVATION_ERROR_MAP) {
    if (raw.includes(code)) return friendly;
  }
  return 'No fue posible procesar la operación de reserva. Intenta nuevamente.';
}

export async function fetchAvailableReservationSlots({ date, partySize, zone = '' }) {
  if (!date || !partySize || Number(partySize) < 1) {
    return { data: [], error: null };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('get_available_reservation_slots', {
      p_date: date,
      p_party_size: Number(partySize),
      p_zone: zone || null,
    });

    if (error) {
      return {
        data: [],
        error: {
          code: error.code || 'SLOTS_FETCH_ERROR',
          message: mapReservationError(error),
        },
      };
    }

    return { data: data ?? [], error: null };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'SLOTS_FETCH_EXCEPTION',
        message: 'Error de conexión al consultar disponibilidad.',
      },
    };
  }
}

export async function createCustomerReservation(input) {
  const parsed = reservationCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los datos de tu reserva.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('create_reservation', {
      p_date: parsed.data.date,
      p_time: parsed.data.time,
      p_party_size: parsed.data.partySize,
      p_zone: parsed.data.zone || null,
      p_notes: parsed.data.notes || null,
      p_customer_id: null,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'CREATE_RESERVATION_ERROR',
          message: mapReservationError(error),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'CREATE_RESERVATION_EXCEPTION',
        message: mapReservationError(err),
      },
    };
  }
}

export async function cancelCustomerReservation(reservationId, reason = '') {
  if (!reservationId) {
    return {
      data: null,
      error: { code: 'INVALID_ID', message: 'Reserva no especificada.' },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('cancel_reservation', {
      p_reservation_id: reservationId,
      p_reason: reason || null,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'CANCEL_RESERVATION_ERROR',
          message: mapReservationError(error),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'CANCEL_RESERVATION_EXCEPTION',
        message: mapReservationError(err),
      },
    };
  }
}

export async function fetchCustomerReservations(userId) {
  if (!userId) return { data: [], error: null };

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('reservations')
      .select(
        'id, reservation_code, customer_id, table_id, customer_name, customer_phone, party_size, reservation_date, start_at, end_at, duration_minutes, notes, status, cancelled_at, cancel_reason, created_at, restaurant_tables ( id, code, zone, capacity )',
      )
      .eq('customer_id', userId)
      .order('start_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error: {
          code: error.code || 'RESERVATIONS_FETCH_ERROR',
          message: 'No fue posible consultar tus reservas.',
        },
      };
    }

    return { data: data ?? [], error: null };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'RESERVATIONS_FETCH_EXCEPTION',
        message: 'Error de conexión al consultar reservas.',
      },
    };
  }
}

export async function fetchAdminReservations({ date = '', status = '', search = '' } = {}) {
  try {
    const client = getSupabaseClient();
    let query = client
      .from('reservations')
      .select(
        'id, reservation_code, customer_id, table_id, customer_name, customer_phone, party_size, reservation_date, start_at, end_at, duration_minutes, notes, status, cancelled_at, cancel_reason, created_at, restaurant_tables ( id, code, zone, capacity )',
      )
      .order('start_at', { ascending: true });

    if (date) {
      query = query.eq('reservation_date', date);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return {
        data: [],
        error: {
          code: error.code || 'ADMIN_RESERVATIONS_ERROR',
          message: 'No fue posible consultar las reservas administrativas.',
        },
      };
    }

    let rows = data ?? [];
    const cleanSearch = String(search || '').trim().toLowerCase();
    if (cleanSearch) {
      rows = rows.filter(
        (r) =>
          String(r.customer_name || '').toLowerCase().includes(cleanSearch) ||
          String(r.reservation_code || '').toLowerCase().includes(cleanSearch) ||
          String(r.customer_phone || '').toLowerCase().includes(cleanSearch),
      );
    }

    return { data: rows, error: null };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'ADMIN_RESERVATIONS_EXCEPTION',
        message: 'Error de conexión al cargar reservas.',
      },
    };
  }
}

export async function adminUpdateReservation({
  reservationId,
  newStatus = null,
  newTableId = null,
  notes = null,
}) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('admin_manage_reservation', {
      p_reservation_id: reservationId,
      p_new_status: newStatus,
      p_new_table_id: newTableId,
      p_notes: notes,
    });

    if (error) {
      const isMissingRpc =
        error.code === 'PGRST202' || String(error.message || '').includes('Could not find the function');
      return {
        data: null,
        error: {
          code: isMissingRpc ? 'RPC_UNAVAILABLE' : error.code || 'ADMIN_RES_RPC_ERROR',
          message: isMissingRpc
            ? 'La operación administrativa de reservas requiere la función transaccional admin_manage_reservation en el servidor.'
            : mapReservationError(error),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'ADMIN_RES_UPDATE_EXCEPTION',
        message: mapReservationError(err),
      },
    };
  }
}
