import { getSupabaseClient } from '../lib/supabase';
import { extractFieldErrors } from '../schemas/authSchemas';
import { addressSchema } from '../schemas/clientSchemas';

export async function fetchUserAddresses(userId) {
  if (!userId) return { data: [], error: null };

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('customer_addresses')
      .select('id, user_id, label, address, neighborhood, directions, is_default, created_at, updated_at')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return {
        data: [],
        error: {
          code: error.code || 'ADDRESSES_FETCH_ERROR',
          message: 'No fue posible cargar tus direcciones guardadas.',
        },
      };
    }

    return { data: data ?? [], error: null };
  } catch (err) {
    return {
      data: [],
      error: {
        code: err.code || 'ADDRESSES_FETCH_EXCEPTION',
        message: 'Error de conexión al consultar direcciones.',
      },
    };
  }
}

function mapAddressRpcError(error, fallbackMsg) {
  const raw = String(error?.message || '');
  if (error?.code === 'PGRST202' || raw.includes('Could not find the function')) {
    return 'La operación transaccional de direcciones no está disponible en el servidor. Verifica el despliegue de las migraciones.';
  }
  if (raw.includes('AUTH_REQUIRED')) return 'Debes iniciar sesión con una cuenta activa.';
  if (raw.includes('FORBIDDEN_ADDRESS')) return 'No tienes permisos para modificar esta dirección.';
  if (raw.includes('ADDRESS_NOT_FOUND')) return 'La dirección indicada no existe.';
  return fallbackMsg;
}

export async function createUserAddress(userId, input) {
  if (!userId) {
    return {
      data: null,
      error: { code: 'AUTH_REQUIRED', message: 'Debes iniciar sesión.' },
    };
  }

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los campos de la dirección.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('save_customer_address', {
      p_address_id: null,
      p_label: parsed.data.label,
      p_address: parsed.data.address,
      p_neighborhood: parsed.data.neighborhood,
      p_directions: parsed.data.directions || null,
      p_is_default: Boolean(parsed.data.isDefault),
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'ADDRESS_CREATE_ERROR',
          message: mapAddressRpcError(error, 'No fue posible guardar la dirección.'),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'ADDRESS_CREATE_EXCEPTION',
        message: 'Error de conexión al guardar la dirección.',
      },
    };
  }
}

export async function updateUserAddress(userId, addressId, input) {
  if (!userId || !addressId) {
    return {
      data: null,
      error: { code: 'INVALID_INPUT', message: 'Dirección no identificada.' },
    };
  }

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los campos de la dirección.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('save_customer_address', {
      p_address_id: addressId,
      p_label: parsed.data.label,
      p_address: parsed.data.address,
      p_neighborhood: parsed.data.neighborhood,
      p_directions: parsed.data.directions || null,
      p_is_default: Boolean(parsed.data.isDefault),
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'ADDRESS_UPDATE_ERROR',
          message: mapAddressRpcError(error, 'No fue posible actualizar la dirección.'),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'ADDRESS_UPDATE_EXCEPTION',
        message: 'Error de conexión al actualizar la dirección.',
      },
    };
  }
}

export async function setDefaultUserAddress(userId, addressId) {
  if (!userId || !addressId) {
    return {
      data: null,
      error: { code: 'INVALID_INPUT', message: 'Dirección no identificada.' },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('set_default_customer_address', {
      p_address_id: addressId,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'ADDRESS_DEFAULT_ERROR',
          message: mapAddressRpcError(error, 'No fue posible actualizar tu dirección principal.'),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'ADDRESS_DEFAULT_EXCEPTION',
        message: 'Error de conexión al definir dirección predeterminada.',
      },
    };
  }
}

export async function deleteUserAddress(userId, addressId) {
  if (!userId || !addressId) {
    return { error: { code: 'INVALID_INPUT', message: 'Dirección no identificada.' } };
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('customer_addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', userId);

    if (error) {
      return {
        error: {
          code: error.code || 'ADDRESS_DELETE_ERROR',
          message: 'No fue posible eliminar la dirección.',
        },
      };
    }

    return { error: null };
  } catch (err) {
    return {
      error: {
        code: err.code || 'ADDRESS_DELETE_EXCEPTION',
        message: 'Error de conexión al eliminar la dirección.',
      },
    };
  }
}
