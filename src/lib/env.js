import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_NAME: z.string().min(1).default('FORJA BRAVA — SIGR'),
  VITE_APP_TIMEZONE: z.string().min(1).default('America/Bogota'),
  VITE_SUPABASE_URL: z.string().optional().default(''),
  VITE_SUPABASE_ANON_KEY: z.string().optional().default(''),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

export const env = parsedEnv.success
  ? parsedEnv.data
  : {
      VITE_APP_NAME: 'FORJA BRAVA — SIGR',
      VITE_APP_TIMEZONE: 'America/Bogota',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    };

export const isSupabaseConfigured = Boolean(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY,
);
