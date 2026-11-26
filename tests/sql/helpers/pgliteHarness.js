/**
 * Arnés de pruebas SQL aisladas para FORJA BRAVA — SIGR.
 *
 * Usa PGlite (PostgreSQL 17 compilado a WebAssembly, en memoria, sin red ni
 * acceso a Supabase remoto) para aplicar las migraciones reales del
 * repositorio sobre una base de datos efímera.
 *
 * Supabase se emula con el mínimo indispensable:
 * - Roles `anon` y `authenticated` (NOLOGIN).
 * - `auth.users` y `auth.uid()` leyendo `request.jwt.claim.sub` (igual que PostgREST).
 * - `storage.buckets` / `storage.objects` para la migración 04.
 *
 * LIMITACIÓN: PGlite expone una única conexión. Estas pruebas validan
 * lógica, restricciones, RLS y permisos de forma real en PostgreSQL, pero NO
 * ejecutan transacciones paralelas. La concurrencia real se cubre con
 * `tests/sql/concurrency.pg.test.js` cuando existe `SIGR_TEST_DATABASE_URL`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

export const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');

export const SUPABASE_BOOTSTRAP_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text,
  public boolean,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
`;

export function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Crea una base efímera y aplica todas las migraciones locales en orden.
 */
export async function createMigratedDb({ upTo } = {}) {
  const db = await PGlite.create({ extensions: { btree_gist, pgcrypto } });
  await db.exec(SUPABASE_BOOTSTRAP_SQL);

  for (const file of listMigrationFiles()) {
    if (upTo && file > upTo) break;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (err) {
      err.message = `[${file}] ${err.message}`;
      throw err;
    }
  }
  return db;
}

/** Ejecuta como superusuario (dueño de las funciones) sin identidad JWT. */
export async function asSystem(db) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`);
}

/** Emula una petición PostgREST autenticada con el JWT del usuario indicado. */
export async function asUser(db, userId) {
  await db.exec(`RESET ROLE;`);
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  await db.exec(`SET ROLE authenticated;`);
}

/** Emula una petición PostgREST anónima. */
export async function asAnon(db) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false); SET ROLE anon;`);
}

let userCounter = 0;

/**
 * Crea un usuario de Auth (el trigger `handle_new_auth_user` genera su perfil
 * con rol `cliente`) y opcionalmente lo promueve al rol indicado.
 */
export async function createUser(db, { role = 'cliente', name, phone = '+57 300 111 2222' } = {}) {
  await asSystem(db);
  userCounter += 1;
  const res = await db.query(`SELECT gen_random_uuid() AS id`);
  const id = res.rows[0].id;
  const email = `${role}-${userCounter}-${id.slice(0, 6)}@forjabrava.test`;
  await db.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)`,
    [id, email, JSON.stringify({ full_name: name || `Usuario ${role} ${userCounter}`, phone })],
  );
  if (role !== 'cliente') {
    await db.query(
      `UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE code = $2) WHERE id = $1`,
      [id, role],
    );
  }
  return id;
}

/**
 * Configura horario semanal homogéneo para que las pruebas no dependan del
 * día de la semana en que se ejecutan.
 */
export async function setUniformHours(db, { open, close, duration = 90, cutoff = 60 }) {
  await asSystem(db);
  const day = { open, close, closed: false };
  const hours = {
    monday: day,
    tuesday: day,
    wednesday: day,
    thursday: day,
    friday: day,
    saturday: day,
    sunday: day,
  };
  await db.query(
    `UPDATE public.restaurant_settings
       SET business_hours = $1::jsonb,
           reservation_duration_minutes = $2,
           reservation_cancel_cutoff_minutes = $3
     WHERE id = 1`,
    [JSON.stringify(hours), duration, cutoff],
  );
}

/** Fecha futura (YYYY-MM-DD en America/Bogota) a N días de hoy. */
export async function futureDate(db, days = 10) {
  const res = await db.query(
    `SELECT to_char(((now() AT TIME ZONE 'America/Bogota')::date + $1::int), 'YYYY-MM-DD') AS d`,
    [days],
  );
  return res.rows[0].d;
}

/** Ejecuta una consulta esperando un error y devuelve su mensaje. */
export async function expectSqlError(promise) {
  try {
    await promise;
  } catch (err) {
    return String(err.message || err);
  }
  throw new Error('Se esperaba un error SQL y la operación fue exitosa.');
}
