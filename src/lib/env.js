import { z } from 'zod';

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const rawEnvSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1).default('FORJA BRAVA — SIGR'),
  VITE_APP_TIMEZONE: z.string().trim().min(1).default('America/Bogota'),
  VITE_SUPABASE_URL: z.string().trim().optional().default(''),
  VITE_SUPABASE_ANON_KEY: z.string().trim().optional().default(''),
});

/**
 * Valida un objeto de variables de entorno sin exponer valores sensibles.
 */
export function validateRuntimeEnv(rawEnv = import.meta.env) {
  const parsed = rawEnvSchema.safeParse(rawEnv ?? {});
  const data = parsed.success
    ? parsed.data
    : {
        VITE_APP_NAME: 'FORJA BRAVA — SIGR',
        VITE_APP_TIMEZONE: 'America/Bogota',
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_ANON_KEY: '',
      };

  const errors = [];

  if (!data.VITE_SUPABASE_URL) {
    errors.push(
      'Falta configurar VITE_SUPABASE_URL en las variables de entorno.',
    );
  } else if (!isValidHttpUrl(data.VITE_SUPABASE_URL)) {
    errors.push(
      'VITE_SUPABASE_URL no tiene un formato de URL válido (debe iniciar con https:// o http://).',
    );
  }

  if (!data.VITE_SUPABASE_ANON_KEY) {
    errors.push(
      'Falta configurar VITE_SUPABASE_ANON_KEY (clave pública/publishable de Supabase).',
    );
  }

  return {
    env: data,
    isSupabaseConfigured: errors.length === 0,
    errors,
  };
}

const runtimeValidation = validateRuntimeEnv(import.meta.env);

export const env = runtimeValidation.env;
export const isSupabaseConfigured = runtimeValidation.isSupabaseConfigured;
export const supabaseConfigErrors = runtimeValidation.errors;

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    const error = new Error(
      supabaseConfigErrors.join(' ') ||
        'La configuración pública de Supabase está incompleta.',
    );
    error.code = 'SUPABASE_CONFIG_MISSING';
    throw error;
  }
}
