import { createClient } from '@supabase/supabase-js';
import {
  assertSupabaseConfigured,
  env,
  isSupabaseConfigured,
} from './env';

let supabaseSingleton = null;

function initSupabaseClient() {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!supabaseSingleton) {
    supabaseSingleton = createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  }

  return supabaseSingleton;
}

export const supabase = initSupabaseClient();

/**
 * Devuelve la instancia única de Supabase o lanza un error técnico claro
 * (sin exponer secretos) cuando faltan las variables de entorno.
 */
export function getSupabaseClient() {
  assertSupabaseConfigured();
  return initSupabaseClient();
}

/**
 * Construye una URL de redirección segura basada en el origen actual de ejecución.
 */
export function getAuthRedirectUrl(internalPath = '/') {
  const safePath =
    typeof internalPath === 'string' &&
    internalPath.startsWith('/') &&
    !internalPath.startsWith('//')
      ? internalPath
      : '/';

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${safePath}`;
  }

  return safePath;
}
