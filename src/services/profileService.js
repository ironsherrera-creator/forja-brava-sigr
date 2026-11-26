import { getSupabaseClient } from '../lib/supabase';
import { extractFieldErrors } from '../schemas/authSchemas';
import { emailChangeSchema } from '../schemas/clientSchemas';
import { mapSupabaseAuthError } from './authService';

/**
 * Solicita cambio de correo electrónico usando el flujo oficial de Supabase Auth
 * (requiere confirmación por enlace enviado al nuevo correo).
 */
export async function requestEmailChange(input) {
  const parsed = emailChangeSchema.safeParse(input);
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
    const { data, error } = await client.auth.updateUser({
      email: parsed.data.email,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'EMAIL_CHANGE_ERROR',
          message: mapSupabaseAuthError(error),
        },
      };
    }

    return {
      data: {
        user: data?.user ?? null,
        message:
          'Solicitud registrada. Revisa tu bandeja de entrada para confirmar el cambio de correo electrónico.',
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'EMAIL_CHANGE_EXCEPTION',
        message: mapSupabaseAuthError(err),
      },
    };
  }
}
