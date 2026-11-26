-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 10 (Aditiva local — Depende de Migraciones 01..09; NO aplicada en remoto):
--   - Etapa 8 (§3.7 / AUD-10): Bloquear nuevos pedidos sobre cuentas de mesa
--     con cierre solicitado (`closing_requested`), cerradas o canceladas.
--   - Etapa 9 (§4.6): RPC segura `admin_update_user_account` para activar/desactivar
--     perfiles y asignar roles oficiales con protección del último administrador,
--     bloqueo de automodificación de privilegios y registro en `audit_logs`.
--   - Etapa 9 (§4.2, §4.7): Auditoría automática en `audit_logs` para cambios
--     administrativos en `products`, `categories` y `restaurant_settings`.
-- ============================================================================

-- 1. Protección de cuentas de mesa con solicitud de cierre (D-04 / Etapa 8)
CREATE OR REPLACE FUNCTION public.block_orders_on_closing_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_acc_status varchar(25);
BEGIN
  IF NEW.table_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ta.status INTO v_acc_status
  FROM public.table_accounts ta
  WHERE ta.id = NEW.table_account_id;

  IF v_acc_status = 'closing_requested' THEN
    RAISE EXCEPTION 'ACCOUNT_CLOSING_REQUESTED: Esta cuenta ya tiene solicitud de cierre pendiente y no admite nuevos pedidos.';
  END IF;

  IF v_acc_status IN ('closed', 'cancelled') THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_OPEN: La cuenta de mesa ya se encuentra cerrada o cancelada.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_orders_on_closing_account()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_block_orders_on_closing_account ON public.orders;
CREATE TRIGGER trg_block_orders_on_closing_account
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.block_orders_on_closing_account();

-- 2. Gestión administrativa auditable de usuarios y roles (Etapa 9 §4.6 + AUD811-05)
CREATE OR REPLACE FUNCTION public.admin_update_user_account(
  p_user_id uuid,
  p_role_code varchar DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_admin_role_id smallint;
  v_actor_profile public.profiles%ROWTYPE;
  v_old public.profiles%ROWTYPE;
  v_new public.profiles%ROWTYPE;
  v_target_role_id smallint;
  v_effective_active boolean;
  v_clean_role varchar(30);
  v_remaining_admins integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede gestionar usuarios y roles.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER: Debes indicar el usuario a actualizar.';
  END IF;

  -- AUD811-05: Serialización transaccional global de cambios de privilegios + bloqueo
  -- determinista (ORDER BY id) de todos los administradores activos y del usuario objetivo
  -- para impedir desactivación o degradación mutua concurrente (TOCTOU) y deadlocks.
  PERFORM pg_advisory_xact_lock(hashtextextended('sigr_admin_privilege_guard', 0));

  SELECT r.id INTO v_admin_role_id
  FROM public.roles r
  WHERE r.code = 'administrador';

  PERFORM 1
  FROM public.profiles p
  WHERE (p.role_id = v_admin_role_id AND p.is_active = true)
     OR p.id IN (v_actor, p_user_id)
  ORDER BY p.id
  FOR UPDATE;

  -- Revalidar que el actor sigue siendo un administrador activo DESPUÉS de obtener el bloqueo
  SELECT * INTO v_actor_profile
  FROM public.profiles p
  WHERE p.id = v_actor
    AND p.role_id = v_admin_role_id
    AND p.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo un administrador con cuenta activa puede gestionar usuarios y roles.';
  END IF;

  SELECT * INTO v_old
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: El perfil de usuario no existe.';
  END IF;

  v_target_role_id := v_old.role_id;
  v_clean_role := NULLIF(btrim(lower(COALESCE(p_role_code, ''))), '');

  IF v_clean_role IS NOT NULL THEN
    SELECT r.id INTO v_target_role_id
    FROM public.roles r
    WHERE r.code = v_clean_role;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_ROLE: El rol indicado (%) no existe en el sistema.', v_clean_role;
    END IF;
  END IF;

  v_effective_active := COALESCE(p_is_active, v_old.is_active);

  -- Evitar que un administrador se quite su propio rol o se desactive accidentalmente
  IF p_user_id = v_actor AND (
    v_target_role_id <> v_old.role_id
    OR v_effective_active = false
  ) THEN
    RAISE EXCEPTION 'CANNOT_MODIFY_OWN_PRIVILEGES: No puedes cambiar tu propio rol ni desactivar tu cuenta en sesión.';
  END IF;

  -- Verificación explícita bajo bloqueo: si el objetivo era administrador activo y deja de serlo,
  -- debe permanecer al menos 1 administrador activo adicional.
  IF v_old.role_id = v_admin_role_id AND v_old.is_active = true
     AND (v_target_role_id <> v_admin_role_id OR v_effective_active = false) THEN
    SELECT count(*) INTO v_remaining_admins
    FROM public.profiles p
    WHERE p.role_id = v_admin_role_id
      AND p.is_active = true
      AND p.id <> p_user_id;

    IF v_remaining_admins < 1 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTED: No se puede desactivar ni degradar al único administrador activo.';
    END IF;
  END IF;

  UPDATE public.profiles
  SET
    role_id = v_target_role_id,
    is_active = v_effective_active
  WHERE id = p_user_id
  RETURNING * INTO v_new;

  PERFORM public.log_audit_event(
    'profiles',
    v_new.id,
    'ADMIN_UPDATE_USER_ACCOUNT',
    to_jsonb(v_old),
    to_jsonb(v_new)
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_account(uuid, varchar, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_account(uuid, varchar, boolean)
  TO authenticated;

-- 3. Auditoría automática para catálogo (products, categories) y configuración (restaurant_settings)
CREATE OR REPLACE FUNCTION public.audit_admin_table_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity_id uuid;
  v_action varchar(60);
BEGIN
  -- Solo registrar cuando exista un actor autenticado (evita ruido en semillas/migraciones)
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_action := upper('ADMIN_' || TG_OP || '_' || TG_TABLE_NAME);

  IF TG_TABLE_NAME IN ('products', 'categories') THEN
    v_entity_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  ELSE
    v_entity_id := NULL;
  END IF;

  PERFORM public.log_audit_event(
    TG_TABLE_NAME::varchar,
    v_entity_id,
    v_action,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_admin_table_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_admin_table_change();

DROP TRIGGER IF EXISTS trg_audit_categories ON public.categories;
CREATE TRIGGER trg_audit_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_admin_table_change();

DROP TRIGGER IF EXISTS trg_audit_restaurant_settings ON public.restaurant_settings;
CREATE TRIGGER trg_audit_restaurant_settings
  AFTER UPDATE ON public.restaurant_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_admin_table_change();
