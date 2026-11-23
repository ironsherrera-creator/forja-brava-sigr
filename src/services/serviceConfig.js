import { env, isSupabaseConfigured } from '../lib/env';

/**
 * Configuración base de la capa de servicios.
 * En etapas posteriores aquí se inicializará el cliente de Supabase
 * y los repositorios por dominio (catalog, orders, tables, reservations, cash).
 */
export const serviceStatus = {
  appName: env.VITE_APP_NAME,
  timezone: env.VITE_APP_TIMEZONE,
  backendConnected: false,
  supabaseEnvPresent: isSupabaseConfigured,
};
