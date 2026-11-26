import { getSupabaseClient } from '../lib/supabase';
import { extractFieldErrors } from '../schemas/authSchemas';
import { restaurantTableSchema } from '../schemas/adminSchemas';

export function mapTableRpcError(error, code = '') {
  const raw = String(error?.message || '');
  if (error?.code === 'PGRST202' || raw.includes('Could not find the function')) {
    return 'La operación transaccional de mesas no está disponible en el servidor. Verifica el despliegue de las migraciones.';
  }
  if (error?.code === '23505' || raw.includes('duplicate')) {
    return code
      ? `Ya existe una mesa con el código "${code}".`
      : 'Ya existe otra mesa con ese código.';
  }
  if (raw.includes('TABLE_CAPACITY_CONFLICT')) {
    return 'No se puede reducir la capacidad porque existen reservas futuras vigentes que superan ese cupo.';
  }
  if (raw.includes('TABLE_HAS_OPEN_ACCOUNT')) {
    return 'No se puede desactivar esta mesa mientras tenga una cuenta de mesa abierta o en cierre.';
  }
  if (raw.includes('TABLE_HAS_ACTIVE_RESERVATIONS')) {
    return 'No se puede desactivar esta mesa porque tiene reservas futuras vigentes. Reasígnalas o cancélalas primero.';
  }
  if (raw.includes('FORBIDDEN_ROLE')) {
    return 'Solo el administrador puede modificar el inventario de mesas.';
  }
  return 'No fue posible guardar los cambios de la mesa.';
}

export async function fetchRestaurantTables() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('restaurant_tables')
      .select('id, code, zone, capacity, status, is_active, created_at, updated_at')
      .order('zone', { ascending: true })
      .order('code', { ascending: true });

    if (error) {
      return {
        data: [],
        error: {
          code: error.code || 'TABLES_FETCH_ERROR',
          message: 'No fue posible consultar el inventario de mesas.',
        },
      };
    }

    return { data: data ?? [], error: null };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'TABLES_FETCH_EXCEPTION',
        message: 'Error de conexión al consultar mesas.',
      },
    };
  }
}

export async function createRestaurantTable(input) {
  const parsed = restaurantTableSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los datos de la mesa.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('admin_save_restaurant_table', {
      p_table_id: null,
      p_code: parsed.data.code,
      p_zone: parsed.data.zone,
      p_capacity: parsed.data.capacity,
      p_is_active: parsed.data.isActive,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'TABLE_CREATE_ERROR',
          message: mapTableRpcError(error, parsed.data.code),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'TABLE_CREATE_EXCEPTION',
        message: 'Error de conexión al crear la mesa.',
      },
    };
  }
}

export async function updateRestaurantTable(tableId, input) {
  const parsed = restaurantTableSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los datos de la mesa.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('admin_save_restaurant_table', {
      p_table_id: tableId,
      p_code: parsed.data.code,
      p_zone: parsed.data.zone,
      p_capacity: parsed.data.capacity,
      p_is_active: parsed.data.isActive,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'TABLE_UPDATE_ERROR',
          message: mapTableRpcError(error, parsed.data.code),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'TABLE_UPDATE_EXCEPTION',
        message: 'Error de conexión al actualizar la mesa.',
      },
    };
  }
}

export async function toggleRestaurantTableActive(table) {
  if (!table?.id) {
    return { data: null, error: { code: 'INVALID_ID', message: 'Mesa no válida.' } };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('admin_save_restaurant_table', {
      p_table_id: table.id,
      p_code: table.code,
      p_zone: table.zone,
      p_capacity: table.capacity,
      p_is_active: !table.is_active,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'TABLE_TOGGLE_ERROR',
          message: mapTableRpcError(error, table.code),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'TABLE_TOGGLE_EXCEPTION',
        message: 'Error de conexión al actualizar la mesa.',
      },
    };
  }
}
