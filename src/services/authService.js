import { getAuthRedirectUrl, getSupabaseClient } from '../lib/supabase';
import {
  extractFieldErrors,
  forgotPasswordSchema,
  loginSchema,
  profileUpdateSchema,
  registerSchema,
  resetPasswordSchema,
} from '../schemas/authSchemas';
import { isValidRole } from '../utils/rbac';

/**
 * Traduce errores de Supabase/red a mensajes comprensibles sin filtrar detalles internos.
 */
export function mapSupabaseAuthError(error) {
  if (!error) {
    return 'Ocurrió un error inesperado de autenticación.';
  }

  if (error.code === 'SUPABASE_CONFIG_MISSING') {
    return error.message;
  }

  const msg = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toLowerCase();

  if (
    code === 'invalid_credentials' ||
    msg.includes('invalid login credentials')
  ) {
    return 'El correo electrónico o la contraseña no son correctos.';
  }

  if (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed')
  ) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.';
  }

  if (
    code === 'user_already_exists' ||
    msg.includes('user already registered')
  ) {
    return 'No fue posible completar el registro con ese correo. Si ya tienes cuenta, inicia sesión o recupera tu contraseña.';
  }

  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    msg.includes('rate limit')
  ) {
    return 'Has realizado demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.';
  }

  if (
    code === 'same_password' ||
    msg.includes('different from the old password')
  ) {
    return 'La nueva contraseña debe ser diferente a la contraseña anterior.';
  }

  if (
    code === 'otp_expired' ||
    msg.includes('expired') ||
    msg.includes('invalid token') ||
    msg.includes('auth session missing')
  ) {
    return 'El enlace de recuperación es inválido o ha expirado. Solicita un nuevo enlace.';
  }

  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'No fue posible conectar con el servidor de autenticación. Verifica tu conexión a internet.';
  }

  return 'No se pudo completar la operación de autenticación. Intenta nuevamente.';
}

function normalizeProfileRecord(rawProfile) {
  if (!rawProfile || typeof rawProfile !== 'object') {
    return { profile: null, role: null };
  }

  const relatedRole = Array.isArray(rawProfile.roles)
    ? rawProfile.roles[0]
    : rawProfile.roles;
  const roleCode = relatedRole?.code ?? null;

  if (!isValidRole(roleCode)) {
    return { profile: null, role: null };
  }

  const profile = {
    id: rawProfile.id,
    role_id: rawProfile.role_id,
    full_name: rawProfile.full_name,
    email: rawProfile.email,
    phone: rawProfile.phone ?? '',
    is_active: Boolean(rawProfile.is_active),
    created_at: rawProfile.created_at,
    updated_at: rawProfile.updated_at,
    role_name: relatedRole?.name ?? roleCode,
  };

  return { profile, role: roleCode };
}

/**
 * Consulta el perfil autenticado y su rol real desde PostgreSQL (`profiles` -> `roles`).
 * Política de denegación por defecto: ante error o rol inválido retorna null.
 */
export async function fetchAuthenticatedProfile(userId) {
  if (!userId) {
    return {
      profile: null,
      role: null,
      error: { code: 'MISSING_USER_ID', message: 'Identificador de usuario no disponible.' },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .select(
        'id, role_id, full_name, email, phone, is_active, created_at, updated_at, roles ( id, code, name )',
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return {
        profile: null,
        role: null,
        error: {
          code: 'PROFILE_QUERY_ERROR',
          message: 'No fue posible verificar tu perfil de acceso.',
        },
      };
    }

    if (!data) {
      return {
        profile: null,
        role: null,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'No se encontró un perfil asociado a esta cuenta.',
        },
      };
    }

    // Si la cuenta está desactivada, devolvemos is_active: false explícitamente
    // incluso si roles no se resolvió, para activar el protocolo de bloqueo.
    if (data.is_active === false) {
      return {
        profile: {
          id: data.id,
          full_name: data.full_name,
          email: data.email,
          is_active: false,
        },
        role: null,
        error: {
          code: 'ACCOUNT_DISABLED',
          message:
            'Tu cuenta se encuentra desactivada. Comunícate con la administración de FORJA BRAVA.',
        },
      };
    }

    const normalized = normalizeProfileRecord(data);
    if (!normalized.profile || !normalized.role) {
      return {
        profile: null,
        role: null,
        error: {
          code: 'INVALID_ROLE',
          message: 'No fue posible validar el rol asignado a tu cuenta.',
        },
      };
    }

    return {
      profile: normalized.profile,
      role: normalized.role,
      error: null,
    };
  } catch (err) {
    return {
      profile: null,
      role: null,
      error: {
        code: err.code || 'UNEXPECTED_PROFILE_ERROR',
        message: mapSupabaseAuthError(err),
      },
    };
  }
}

/**
 * Registro de clientes.
 * NUNCA envía rol desde el frontend; PostgreSQL asigna `cliente` vía trigger `on_auth_user_created`.
 */
export async function registerClientAccount(input) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los campos marcados en el formulario.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { fullName, email, phone, password } = parsed.data;

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl('/login'),
        data: {
          full_name: fullName,
          phone: phone || '',
        },
      },
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'SIGNUP_ERROR',
          message: mapSupabaseAuthError(error),
        },
      };
    }

    // Supabase devuelve identities vacío cuando el correo ya existe y email confirmation está activo
    if (
      data?.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      return {
        data: {
          user: null,
          session: null,
          requiresEmailConfirmation: true,
        },
        error: null,
      };
    }

    const requiresEmailConfirmation = Boolean(data?.user && !data?.session);

    return {
      data: {
        user: data?.user ?? null,
        session: data?.session ?? null,
        requiresEmailConfirmation,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'SIGNUP_EXCEPTION',
        message: mapSupabaseAuthError(err),
      },
    };
  }
}

/**
 * Inicio de sesión con verificación inmediata de perfil activo y rol en PostgreSQL.
 */
export async function signInWithEmailPassword(input) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Ingresa un correo válido y tu contraseña.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { email, password } = parsed.data;

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user || !data?.session) {
      return {
        data: null,
        error: {
          code: error?.code || 'SIGNIN_ERROR',
          message: mapSupabaseAuthError(error),
        },
      };
    }

    const profileResult = await fetchAuthenticatedProfile(data.user.id);

    // Denegación por defecto si la cuenta está inactiva o el perfil no pudo verificarse
    if (
      profileResult.error ||
      !profileResult.profile ||
      !profileResult.role ||
      profileResult.profile.is_active === false
    ) {
      await client.auth.signOut();
      return {
        data: null,
        error: profileResult.error || {
          code: 'AUTHORIZATION_FAILED',
          message: 'No fue posible verificar los permisos de tu cuenta.',
        },
      };
    }

    return {
      data: {
        user: data.user,
        session: data.session,
        profile: profileResult.profile,
        role: profileResult.role,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'SIGNIN_EXCEPTION',
        message: mapSupabaseAuthError(err),
      },
    };
  }
}

export async function signOutCurrentUser() {
  try {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) {
      return {
        error: {
          code: error.code || 'SIGNOUT_ERROR',
          message: mapSupabaseAuthError(error),
        },
      };
    }
    return { error: null };
  } catch (err) {
    return {
      error: {
        code: err.code || 'SIGNOUT_EXCEPTION',
        message: mapSupabaseAuthError(err),
      },
    };
  }
}

/**
 * Solicita correo de recuperación. Retorna respuesta neutral contra enumeración de usuarios.
 */
export async function requestPasswordResetEmail(input) {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Ingresa un correo electrónico válido.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: getAuthRedirectUrl('/actualizar-contrasena'),
      },
    );

    if (error) {
      const code = String(error.code || '').toLowerCase();
      const msg = String(error.message || '').toLowerCase();
      // Solo reportar errores operativos de red o rate-limit; nunca si el usuario existe o no
      if (
        code.includes('rate_limit') ||
        msg.includes('rate limit') ||
        msg.includes('failed to fetch') ||
        msg.includes('network')
      ) {
        return {
          data: null,
          error: {
            code: error.code || 'RECOVERY_ERROR',
            message: mapSupabaseAuthError(error),
          },
        };
      }
    }

    return {
      data: {
        neutralMessage:
          'Si el correo está asociado a una cuenta activa, recibirás un enlace para restablecer tu contraseña en los próximos minutos.',
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'RECOVERY_EXCEPTION',
        message: mapSupabaseAuthError(err),
      },
    };
  }
}

/**
 * Verifica parámetros de recuperación en URL (`token_hash` o `code`) cuando no vienen por hash implícito.
 */
export async function verifyRecoverySessionFromUrl(searchString = '') {
  try {
    const client = getSupabaseClient();
    const params = new URLSearchParams(searchString);
    const errorDescription = params.get('error_description') || params.get('error');

    if (errorDescription) {
      return {
        session: null,
        error: {
          code: 'RECOVERY_LINK_INVALID',
          message:
            'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.',
        },
      };
    }

    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (tokenHash && type === 'recovery') {
      const { data, error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      });

      if (error || !data?.session) {
        return {
          session: null,
          error: {
            code: error?.code || 'OTP_EXPIRED',
            message: mapSupabaseAuthError(error || { code: 'otp_expired' }),
          },
        };
      }

      return { session: data.session, error: null };
    }

    const code = params.get('code');
    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data?.session) {
        return {
          session: null,
          error: {
            code: error?.code || 'CODE_EXCHANGE_FAILED',
            message: mapSupabaseAuthError(error || { code: 'otp_expired' }),
          },
        };
      }
      return { session: data.session, error: null };
    }

    const { data, error } = await client.auth.getSession();
    if (error || !data?.session) {
      return {
        session: null,
        error: {
          code: 'NO_RECOVERY_SESSION',
          message:
            'No se detectó una sesión de recuperación activa. Abre el enlace enviado a tu correo o solicita uno nuevo.',
        },
      };
    }

    return { session: data.session, error: null };
  } catch (err) {
    return {
      session: null,
      error: {
        code: err.code || 'RECOVERY_VERIFY_EXCEPTION',
        message: mapSupabaseAuthError(err),
      },
    };
  }
}

export async function updateAuthenticatedPassword(input) {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los requisitos de la nueva contraseña.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();

    if (!sessionData?.session) {
      return {
        data: null,
        error: {
          code: 'NO_ACTIVE_SESSION',
          message:
            'Tu sesión de recuperación expiró. Solicita un nuevo enlace para cambiar tu contraseña.',
        },
      };
    }

    const { data, error } = await client.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'PASSWORD_UPDATE_ERROR',
          message: mapSupabaseAuthError(error),
        },
      };
    }

    return { data: { user: data?.user ?? null }, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'PASSWORD_UPDATE_EXCEPTION',
        message: mapSupabaseAuthError(err),
      },
    };
  }
}

export async function updateOwnBasicProfile(userId, input) {
  if (!userId) {
    return {
      data: null,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Debes iniciar sesión para actualizar tu perfil.',
      },
    };
  }

  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revisa los datos ingresados.',
        fieldErrors: extractFieldErrors(parsed.error),
      },
    };
  }

  try {
    const client = getSupabaseClient();
    const { error } = await client
      .from('profiles')
      .update({
        full_name: parsed.data.fullName,
        phone: parsed.data.phone || null,
      })
      .eq('id', userId);

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'PROFILE_UPDATE_ERROR',
          message: 'No se pudieron guardar los cambios en tu perfil.',
        },
      };
    }

    return await fetchAuthenticatedProfile(userId);
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'PROFILE_UPDATE_EXCEPTION',
        message: mapSupabaseAuthError(err),
      },
    };
  }
}
