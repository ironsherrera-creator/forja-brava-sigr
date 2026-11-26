import { env, isSupabaseConfigured } from '../lib/env';
import { supabase } from '../lib/supabase';

export const serviceStatus = {
  appName: env.VITE_APP_NAME,
  timezone: env.VITE_APP_TIMEZONE,
  backendConnected: Boolean(supabase),
  supabaseEnvPresent: isSupabaseConfigured,
};
