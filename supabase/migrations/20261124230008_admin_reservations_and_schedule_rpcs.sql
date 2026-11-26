-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 08 (Local — NUNCA aplicada en remoto; revisada postauditoría):
--   - AUD-13: set_default_customer_address con perfil activo + bloqueo ordenado
--   - AUD-08: save_customer_address atómica (sin doble escritura frontend)
--   - AUD-05: admin_manage_reservation con matriz de transiciones válidas,
--             limpieza de cancelled_at al reactivar y bloqueo determinista
--   - AUD-08: revocación de UPDATE directo sobre public.reservations
--
-- Nota: Aditiva sobre migraciones 01..07. No modifica migraciones 01..07.
-- ============================================================================

-- 1. Cambio atómico de dirección predeterminada del cliente (AUD-13)
CREATE OR REPLACE FUNCTION public.set_default_customer_address(p_address_id uuid)
RETURNS public.customer_addresses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role varchar := public.current_user_role();
  v_target public.customer_addresses%ROWTYPE;
  v_updated public.customer_addresses%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Debes iniciar sesión con una cuenta activa para gestionar tus direcciones.';
  END IF;

  SELECT * INTO v_target
  FROM public.customer_addresses ca
  WHERE ca.id = p_address_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ADDRESS_NOT_FOUND: La dirección indicada no existe.';
  END IF;

  IF v_target.user_id <> v_actor AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ADDRESS: No tienes permisos para modificar esta dirección.';
  END IF;

  -- Bloquear todas las direcciones del usuario en orden determinista por id
  -- para evitar deadlocks y violaciones 23505 en solicitudes concurrentes.
  PERFORM 1
  FROM public.customer_addresses ca
  WHERE ca.user_id = v_target.user_id
  ORDER BY ca.id
  FOR UPDATE;

  UPDATE public.customer_addresses
  SET is_default = false
  WHERE user_id = v_target.user_id
    AND is_default = true
    AND id <> p_address_id;

  UPDATE public.customer_addresses
  SET is_default = true
  WHERE id = p_address_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_customer_address(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_customer_address(uuid)
  TO authenticated;

-- 2. Alta/edición atómica de dirección del cliente (elimina escrituras partidas en frontend, AUD-08)
CREATE OR REPLACE FUNCTION public.save_customer_address(
  p_address_id uuid DEFAULT NULL,
  p_label varchar DEFAULT 'Principal',
  p_address varchar DEFAULT NULL,
  p_neighborhood varchar DEFAULT NULL,
  p_directions text DEFAULT NULL,
  p_is_default boolean DEFAULT false
)
RETURNS public.customer_addresses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role varchar := public.current_user_role();
  v_existing public.customer_addresses%ROWTYPE;
  v_saved public.customer_addresses%ROWTYPE;
  v_owner_id uuid;
BEGIN
  IF v_actor IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Debes iniciar sesión con una cuenta activa para gestionar tus direcciones.';
  END IF;

  IF NULLIF(btrim(p_address), '') IS NULL OR char_length(btrim(p_address)) < 4 THEN
    RAISE EXCEPTION 'INVALID_ADDRESS: La dirección debe tener al menos 4 caracteres.';
  END IF;

  IF NULLIF(btrim(p_neighborhood), '') IS NULL OR char_length(btrim(p_neighborhood)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NEIGHBORHOOD: El barrio debe tener al menos 2 caracteres.';
  END IF;

  IF p_address_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.customer_addresses ca
    WHERE ca.id = p_address_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ADDRESS_NOT_FOUND: La dirección indicada no existe.';
    END IF;

    IF v_existing.user_id <> v_actor AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'FORBIDDEN_ADDRESS: No tienes permisos para modificar esta dirección.';
    END IF;

    v_owner_id := v_existing.user_id;
  ELSE
    v_owner_id := v_actor;
  END IF;

  -- Serializar cambios de dirección predeterminada por propietario en orden determinista
  IF COALESCE(p_is_default, false) THEN
    PERFORM 1
    FROM public.customer_addresses ca
    WHERE ca.user_id = v_owner_id
    ORDER BY ca.id
    FOR UPDATE;

    UPDATE public.customer_addresses
    SET is_default = false
    WHERE user_id = v_owner_id
      AND is_default = true
      AND (p_address_id IS NULL OR id <> p_address_id);
  END IF;

  IF p_address_id IS NULL THEN
    INSERT INTO public.customer_addresses (
      user_id,
      label,
      address,
      neighborhood,
      directions,
      is_default
    )
    VALUES (
      v_owner_id,
      COALESCE(NULLIF(btrim(p_label), ''), 'Principal'),
      btrim(p_address),
      btrim(p_neighborhood),
      NULLIF(btrim(p_directions), ''),
      COALESCE(p_is_default, false)
    )
    RETURNING * INTO v_saved;
  ELSE
    UPDATE public.customer_addresses
    SET
      label = COALESCE(NULLIF(btrim(p_label), ''), label),
      address = btrim(p_address),
      neighborhood = btrim(p_neighborhood),
      directions = NULLIF(btrim(p_directions), ''),
      is_default = COALESCE(p_is_default, false)
    WHERE id = p_address_id
    RETURNING * INTO v_saved;
  END IF;

  RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_customer_address(uuid, varchar, varchar, varchar, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_customer_address(uuid, varchar, varchar, varchar, text, boolean)
  TO authenticated;

-- 3. Gestión administrativa transaccional de reservas (AUD-05)
--    Matriz de transiciones permitidas:
--      Pendiente  -> Pendiente, Confirmada, Cancelada
--      Confirmada -> Confirmada, Atendida, Cancelada
--      Atendida   -> Atendida (solo notas; estado terminal operativo)
--      Cancelada  -> Cancelada, Confirmada (reactivación con validación plena y limpieza de cancelled_at)
CREATE OR REPLACE FUNCTION public.admin_manage_reservation(
  p_reservation_id uuid,
  p_new_status varchar DEFAULT NULL,
  p_new_table_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old public.reservations%ROWTYPE;
  v_new public.reservations%ROWTYPE;
  v_table public.restaurant_tables%ROWTYPE;
  v_effective_status varchar(20);
  v_effective_table_id uuid;
  v_is_reactivation boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede gestionar reservas administrativamente.';
  END IF;

  SELECT * INTO v_old
  FROM public.reservations r
  WHERE r.id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: La reserva no existe.';
  END IF;

  v_effective_status := COALESCE(NULLIF(btrim(p_new_status), ''), v_old.status);
  IF v_effective_status NOT IN ('Pendiente', 'Confirmada', 'Atendida', 'Cancelada') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Estado de reserva no permitido.';
  END IF;

  v_effective_table_id := COALESCE(p_new_table_id, v_old.table_id);

  -- Validar matriz estricta de transiciones de estado
  IF v_effective_status <> v_old.status THEN
    IF v_old.status = 'Pendiente' AND v_effective_status NOT IN ('Confirmada', 'Cancelada') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Una reserva Pendiente solo puede pasar a Confirmada o Cancelada.';
    ELSIF v_old.status = 'Confirmada' AND v_effective_status NOT IN ('Atendida', 'Cancelada') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Una reserva Confirmada solo puede pasar a Atendida o Cancelada.';
    ELSIF v_old.status = 'Atendida' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Una reserva Atendida es definitiva y no puede cambiar de estado.';
    ELSIF v_old.status = 'Cancelada' AND v_effective_status <> 'Confirmada' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: Una reserva Cancelada solo puede reactivarse a Confirmada.';
    END IF;
  END IF;

  -- Impedir reasignación de mesa en reservas terminales (Atendida o Cancelada sin reactivar)
  IF v_effective_table_id <> v_old.table_id AND v_effective_status IN ('Atendida', 'Cancelada') THEN
    RAISE EXCEPTION 'INVALID_TABLE_CHANGE: No se puede reasignar mesa a una reserva en estado %.', v_effective_status;
  END IF;

  v_is_reactivation := (v_old.status = 'Cancelada' AND v_effective_status = 'Confirmada');

  -- Bloqueo determinista (ORDER BY id) de las mesas involucradas para prevenir deadlocks
  -- en reasignaciones cruzadas simultáneas (A->B y B->A).
  PERFORM 1
  FROM public.restaurant_tables t
  WHERE t.id IN (v_old.table_id, v_effective_table_id)
  ORDER BY t.id
  FOR UPDATE;

  -- Validar mesa activa, capacidad y ausencia de solapamientos al reasignar o reactivar
  IF v_effective_table_id <> v_old.table_id OR v_is_reactivation THEN
    SELECT * INTO v_table
    FROM public.restaurant_tables t
    WHERE t.id = v_effective_table_id;

    IF NOT FOUND OR v_table.is_active = false OR v_table.status = 'fuera_de_servicio' THEN
      RAISE EXCEPTION 'TABLE_UNAVAILABLE: La mesa seleccionada no está activa o está fuera de servicio.';
    END IF;

    IF v_table.capacity < v_old.party_size THEN
      RAISE EXCEPTION 'INSUFFICIENT_CAPACITY: La mesa % tiene capacidad para % personas (reserva de %).',
        v_table.code, v_table.capacity, v_old.party_size;
    END IF;

    IF v_effective_status IN ('Pendiente', 'Confirmada') AND EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.table_id = v_effective_table_id
        AND r.id <> v_old.id
        AND r.status IN ('Pendiente', 'Confirmada')
        AND tstzrange(r.start_at, r.end_at, '[)') && tstzrange(v_old.start_at, v_old.end_at, '[)')
    ) THEN
      RAISE EXCEPTION 'RESERVATION_CONFLICT: La mesa % ya tiene una reserva solapada en ese horario.', v_table.code;
    END IF;
  END IF;

  UPDATE public.reservations
  SET
    status = v_effective_status,
    table_id = v_effective_table_id,
    notes = CASE
      WHEN p_notes IS NULL THEN notes
      ELSE NULLIF(btrim(p_notes), '')
    END,
    cancelled_at = CASE
      WHEN v_effective_status = 'Cancelada' THEN COALESCE(cancelled_at, pg_catalog.now())
      WHEN v_is_reactivation THEN NULL
      ELSE cancelled_at
    END,
    cancel_reason = CASE
      WHEN v_is_reactivation THEN NULL
      ELSE cancel_reason
    END
  WHERE id = v_old.id
  RETURNING * INTO v_new;

  PERFORM public.sync_table_status(v_old.table_id);
  IF v_new.table_id <> v_old.table_id THEN
    PERFORM public.sync_table_status(v_new.table_id);
  END IF;

  PERFORM public.log_audit_event(
    'reservations',
    v_new.id,
    'ADMIN_MANAGE_RESERVATION',
    to_jsonb(v_old),
    to_jsonb(v_new)
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_reservation(uuid, varchar, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_reservation(uuid, varchar, uuid, text)
  TO authenticated;

-- 4. Endurecimiento RLS/GRANT (AUD-08): canalizar toda mutación de reservas
--    exclusivamente mediante RPCs transaccionales (sin UPDATE directo desde PostgREST)
DROP POLICY IF EXISTS reservations_admin_write ON public.reservations;
REVOKE UPDATE ON TABLE public.reservations FROM authenticated;
