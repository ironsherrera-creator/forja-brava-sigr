import { getSupabaseClient } from '../lib/supabase';

const USER_RPC_ERROR_MAP = [
  ['LAST_ADMIN_PROTECTED', 'No se puede desactivar ni degradar al único administrador activo del sistema.'],
  ['CANNOT_MODIFY_OWN_PRIVILEGES', 'No puedes cambiar tu propio rol ni desactivar tu cuenta en sesión.'],
  ['FORBIDDEN_ROLE', 'Solo el administrador puede gestionar usuarios y roles.'],
  ['INVALID_ROLE', 'El rol indicado no es válido en el sistema.'],
  ['USER_NOT_FOUND', 'El usuario indicado no existe.'],
  ['Could not find the function', 'La función transaccional admin_update_user_account no está desplegada en el servidor.'],
];

export function mapAdminUserError(error) {
  const raw = String(error?.message || '');
  for (const [code, msg] of USER_RPC_ERROR_MAP) {
    if (raw.includes(code)) return msg;
  }
  return 'No fue posible actualizar la cuenta del usuario.';
}

export async function fetchAdminUsersAndRoles() {
  try {
    const client = getSupabaseClient();
    const [profilesRes, rolesRes, permsRes, rpRes] = await Promise.all([
      client
        .from('profiles')
        .select('id, role_id, full_name, email, phone, is_active, created_at, updated_at, roles ( id, code, name )')
        .order('created_at', { ascending: false }),
      client.from('roles').select('id, code, name, description').order('id', { ascending: true }),
      client.from('permissions').select('id, code, description').order('code', { ascending: true }),
      client.from('role_permissions').select('role_id, permission_id'),
    ]);

    if (profilesRes.error || rolesRes.error) {
      return {
        data: null,
        error: { code: 'USERS_FETCH_ERROR', message: 'No fue posible consultar usuarios y roles.' },
      };
    }

    const users = (profilesRes.data ?? []).map((p) => {
      const roleObj = Array.isArray(p.roles) ? p.roles[0] : p.roles;
      return { ...p, role: roleObj || null };
    });

    return {
      data: {
        users,
        roles: rolesRes.data ?? [],
        permissions: permsRes.data ?? [],
        rolePermissions: rpRes.data ?? [],
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: { code: err.code, message: 'Error de conexión al consultar usuarios y roles.' },
    };
  }
}

export async function adminUpdateUserAccount({ userId, roleCode = null, isActive = null }) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('admin_update_user_account', {
      p_user_id: userId,
      p_role_code: roleCode,
      p_is_active: isActive,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'ADMIN_USER_UPDATE_ERROR',
          message: mapAdminUserError(error),
        },
      };
    }

    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: { code: err.code, message: mapAdminUserError(err) },
    };
  }
}
