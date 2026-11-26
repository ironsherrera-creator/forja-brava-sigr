-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 01: Extensiones base, Roles, Permisos, Perfiles y Direcciones
-- Nota: Aditiva y no destructiva (sin DROP TABLE).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Función utilitaria de trigger para mantener updated_at actualizado
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 1.1. Catálogo de roles oficiales
CREATE TABLE IF NOT EXISTS public.roles (
  id smallserial PRIMARY KEY,
  code varchar(30) NOT NULL UNIQUE CHECK (code IN ('cliente', 'mesero', 'administrador')),
  name varchar(60) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.2. Catálogo de permisos y asignación por rol
CREATE TABLE IF NOT EXISTS public.permissions (
  id smallserial PRIMARY KEY,
  code varchar(80) NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id smallint NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id smallint NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 1.3. Perfiles vinculados 1:1 con Supabase Auth (auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id smallint NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  full_name varchar(120) NOT NULL CHECK (char_length(btrim(full_name)) >= 2),
  email varchar(180) NOT NULL,
  phone varchar(30),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_active
  ON public.profiles (role_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles (lower(email));

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 1.4. Libreta de direcciones de entrega del cliente
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label varchar(60) NOT NULL DEFAULT 'Principal',
  address varchar(200) NOT NULL CHECK (char_length(btrim(address)) >= 4),
  neighborhood varchar(100) NOT NULL CHECK (char_length(btrim(neighborhood)) >= 2),
  directions text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_user
  ON public.customer_addresses (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_one_default
  ON public.customer_addresses (user_id)
  WHERE is_default = true;

DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- Funciones auxiliares de autorización (solo lectura sobre auth.uid())
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS varchar
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.code
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid()
    AND p.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_user_role() = 'administrador', false);
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_waiter()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_user_role() = 'mesero', false);
$$;

REVOKE ALL ON FUNCTION public.is_waiter() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_waiter() TO anon, authenticated;

-- ============================================================================
-- Triggers de seguridad en identidad y roles
-- ============================================================================

-- Creación automática de perfil con rol fijo 'cliente' al registrarse en Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_role_id smallint;
  v_full_name varchar(120);
  v_phone varchar(30);
BEGIN
  SELECT r.id INTO v_client_role_id
  FROM public.roles r
  WHERE r.code = 'cliente'
  LIMIT 1;

  IF v_client_role_id IS NULL THEN
    INSERT INTO public.roles (code, name, description)
    VALUES ('cliente', 'Cliente', 'Cliente registrado de FORJA BRAVA')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_client_role_id;
  END IF;

  v_full_name := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, 'Cliente'), '@', 1)
  );

  IF char_length(v_full_name) < 2 THEN
    v_full_name := 'Cliente Forja Brava';
  END IF;

  v_phone := NULLIF(btrim(NEW.raw_user_meta_data->>'phone'), '');

  INSERT INTO public.profiles (id, role_id, full_name, email, phone, is_active)
  VALUES (NEW.id, v_client_role_id, left(v_full_name, 120), COALESCE(NEW.email, ''), v_phone, true)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Protección anti-escalamiento de rol y protección del último administrador activo
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_role_id smallint;
  v_remaining_admins integer;
BEGIN
  SELECT r.id INTO v_admin_role_id
  FROM public.roles r
  WHERE r.code = 'administrador';

  IF TG_OP = 'DELETE' THEN
    IF OLD.role_id = v_admin_role_id AND OLD.is_active = true THEN
      SELECT count(*) INTO v_remaining_admins
      FROM public.profiles p
      WHERE p.role_id = v_admin_role_id
        AND p.is_active = true
        AND p.id <> OLD.id;

      IF v_remaining_admins < 1 THEN
        RAISE EXCEPTION 'LAST_ADMIN_PROTECTED: No se puede eliminar al único administrador activo.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  -- En UPDATE: bloquear cambio de rol, estado o email por usuarios no administradores
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'FORBIDDEN_ID_CHANGE: No se puede alterar el identificador del perfil.';
    END IF;
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE_CHANGE: No tienes permisos para modificar el rol.';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'FORBIDDEN_STATUS_CHANGE: No tienes permisos para cambiar el estado de la cuenta.';
    END IF;
    IF lower(NEW.email) IS DISTINCT FROM lower(OLD.email) THEN
      RAISE EXCEPTION 'FORBIDDEN_EMAIL_CHANGE: El correo debe actualizarse mediante autenticación.';
    END IF;
  END IF;

  -- Impedir desactivar o quitar el rol al último administrador activo
  IF OLD.role_id = v_admin_role_id AND OLD.is_active = true
     AND (NEW.role_id <> v_admin_role_id OR NEW.is_active = false) THEN
    SELECT count(*) INTO v_remaining_admins
    FROM public.profiles p
    WHERE p.role_id = v_admin_role_id
      AND p.is_active = true
      AND p.id <> OLD.id;

    IF v_remaining_admins < 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTED: No se puede desactivar ni degradar al único administrador activo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_privileged_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_fields
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_fields();
