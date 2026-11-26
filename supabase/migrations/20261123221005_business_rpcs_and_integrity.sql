-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 05: Funciones SQL / RPCs Transaccionales Blindadas y Reglas D-01..D-06
-- ============================================================================

-- Eliminar firmas previas si difieren en argumentos (seguro sobre funciones)
DROP FUNCTION IF EXISTS public.create_order(varchar, jsonb, varchar, boolean, uuid, varchar, varchar, text, time, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.create_table_order(uuid, jsonb, text, uuid);

-- ============================================================================
-- A. FUNCIONES INTERNAS PRIVADAS (Ejecución revocada para PUBLIC, anon y authenticated)
-- ============================================================================

-- A.1. Registro interno inmutable en audit_logs
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_entity_name varchar,
  p_entity_id uuid,
  p_action varchar,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    entity_name,
    entity_id,
    action,
    old_data,
    new_data
  )
  VALUES (
    auth.uid(),
    public.current_user_role(),
    p_entity_name,
    p_entity_id,
    p_action,
    p_old_data,
    p_new_data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(varchar, uuid, varchar, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

-- A.2. Recalcular el total acumulado de una cuenta de mesa excluyendo cancelados (D-04)
CREATE OR REPLACE FUNCTION public.recalculate_table_account_total(p_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total numeric(12,2);
BEGIN
  SELECT COALESCE(SUM(o.total), 0)
  INTO v_total
  FROM public.orders o
  WHERE o.table_account_id = p_account_id
    AND o.status <> 'Cancelado';

  UPDATE public.table_accounts ta
  SET total_amount = v_total
  WHERE ta.id = p_account_id;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_table_account_total(uuid)
  FROM PUBLIC, anon, authenticated;

-- A.3. Sincronización coherente de estado de mesa respetando fuera_de_servicio,
--      cuentas activas y reservas vigentes/inminentes
CREATE OR REPLACE FUNCTION public.sync_table_status(p_table_id uuid)
RETURNS varchar
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table public.restaurant_tables%ROWTYPE;
  v_duration smallint;
  v_has_open_account boolean;
  v_has_imminent_reservation boolean;
  v_next_status varchar(25);
BEGIN
  SELECT * INTO v_table
  FROM public.restaurant_tables t
  WHERE t.id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Respetar inhabilitación administrativa explícita
  IF v_table.is_active = false OR v_table.status = 'fuera_de_servicio' THEN
    IF v_table.status <> 'fuera_de_servicio' THEN
      UPDATE public.restaurant_tables
      SET status = 'fuera_de_servicio'
      WHERE id = p_table_id;
    END IF;
    RETURN 'fuera_de_servicio';
  END IF;

  -- Prioridad 1: Cuenta de mesa abierta o en solicitud de cierre
  SELECT EXISTS (
    SELECT 1
    FROM public.table_accounts ta
    WHERE ta.table_id = p_table_id
      AND ta.status IN ('open', 'closing_requested')
  ) INTO v_has_open_account;

  IF v_has_open_account THEN
    v_next_status := 'ocupada';
  ELSE
    -- Prioridad 2: Reserva activa en curso o inminente dentro de la ventana de turno
    SELECT COALESCE(rs.reservation_duration_minutes, 90)
    INTO v_duration
    FROM public.restaurant_settings rs
    WHERE rs.id = 1;

    v_duration := COALESCE(v_duration, 90);

    SELECT EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.table_id = p_table_id
        AND r.status IN ('Pendiente', 'Confirmada')
        AND r.end_at > pg_catalog.now()
        AND r.start_at <= (pg_catalog.now() + make_interval(mins => v_duration))
    ) INTO v_has_imminent_reservation;

    IF v_has_imminent_reservation THEN
      v_next_status := 'reservada';
    ELSE
      v_next_status := 'disponible';
    END IF;
  END IF;

  IF v_table.status IS DISTINCT FROM v_next_status THEN
    UPDATE public.restaurant_tables
    SET status = v_next_status
    WHERE id = p_table_id;
  END IF;

  RETURN v_next_status;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_table_status(uuid)
  FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- B. FUNCIONES PÚBLICAS / RPC DE RESERVAS (D-01, D-02, D-06)
-- ============================================================================

-- B.1. Consulta de franjas disponibles de reserva (D-01, D-02)
CREATE OR REPLACE FUNCTION public.get_available_reservation_slots(
  p_date date,
  p_party_size integer,
  p_zone varchar DEFAULT NULL
)
RETURNS TABLE (
  slot_time time,
  start_at timestamptz,
  end_at timestamptz,
  available_tables integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today_bogota date := (pg_catalog.now() AT TIME ZONE 'America/Bogota')::date;
  v_duration smallint;
  v_hours jsonb;
  v_day_key text;
  v_day_cfg jsonb;
  v_open time;
  v_close time;
BEGIN
  IF p_date IS NULL OR p_party_size IS NULL OR p_date < v_today_bogota OR p_party_size < 1 THEN
    RETURN;
  END IF;

  SELECT rs.reservation_duration_minutes, rs.business_hours
  INTO v_duration, v_hours
  FROM public.restaurant_settings rs
  WHERE rs.id = 1;

  v_duration := COALESCE(v_duration, 90);
  v_day_key := btrim(lower(to_char(p_date, 'FMday')));
  v_day_cfg := v_hours -> v_day_key;

  IF v_day_cfg IS NULL OR COALESCE((v_day_cfg->>'closed')::boolean, false) THEN
    RETURN;
  END IF;

  v_open := (v_day_cfg->>'open')::time;
  v_close := (v_day_cfg->>'close')::time;

  RETURN QUERY
  WITH candidate_slots AS (
    SELECT
      gs::time AS s_time,
      ((p_date::text || ' ' || (gs::time)::text)::timestamp AT TIME ZONE 'America/Bogota') AS s_start,
      (((p_date::text || ' ' || (gs::time)::text)::timestamp + make_interval(mins => v_duration)) AT TIME ZONE 'America/Bogota') AS s_end
    FROM generate_series(
      (p_date::text || ' ' || v_open::text)::timestamp,
      (p_date::text || ' ' || v_close::text)::timestamp - make_interval(mins => v_duration),
      interval '30 minutes'
    ) AS gs
  )
  SELECT
    cs.s_time,
    cs.s_start,
    cs.s_end,
    count(t.id)::integer AS available_tables
  FROM candidate_slots cs
  JOIN public.restaurant_tables t
    ON t.is_active = true
   AND t.status <> 'fuera_de_servicio'
   AND t.capacity >= p_party_size
   AND (p_zone IS NULL OR btrim(p_zone) = '' OR t.zone = p_zone)
  WHERE cs.s_start > pg_catalog.now()
    AND NOT EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.table_id = t.id
        AND r.status IN ('Pendiente', 'Confirmada')
        AND tstzrange(r.start_at, r.end_at, '[)') && tstzrange(cs.s_start, cs.s_end, '[)')
    )
  GROUP BY cs.s_time, cs.s_start, cs.s_end
  HAVING count(t.id) > 0
  ORDER BY cs.s_time ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_reservation_slots(date, integer, varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_reservation_slots(date, integer, varchar)
  TO anon, authenticated;

-- B.2. Creación atómica de reserva con confirmación automática (D-01, D-02, D-06)
CREATE OR REPLACE FUNCTION public.create_reservation(
  p_date date,
  p_time time,
  p_party_size smallint,
  p_zone varchar DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role varchar := public.current_user_role();
  v_target_customer uuid;
  v_profile public.profiles%ROWTYPE;
  v_duration smallint;
  v_hours jsonb;
  v_day_cfg jsonb;
  v_open time;
  v_close time;
  v_start timestamptz;
  v_end timestamptz;
  v_table_id uuid;
  v_code varchar(30);
  v_res public.reservations%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Debes iniciar sesión con una cuenta activa para realizar una reserva.';
  END IF;

  IF v_role = 'mesero' THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Los meseros no registran reservas; esta operación corresponde al cliente o administrador.';
  END IF;

  IF p_customer_id IS NOT NULL AND p_customer_id <> v_actor AND v_role <> 'administrador' THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: No puedes crear reservas en nombre de otro usuario.';
  END IF;

  v_target_customer := COALESCE(p_customer_id, v_actor);

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_target_customer
    AND p.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: El perfil del cliente no existe o está inactivo.';
  END IF;

  IF p_party_size IS NULL OR p_party_size < 1 THEN
    RAISE EXCEPTION 'INVALID_PARTY_SIZE: El número de personas debe ser al menos 1.';
  END IF;

  SELECT COALESCE(rs.reservation_duration_minutes, 90), rs.business_hours
  INTO v_duration, v_hours
  FROM public.restaurant_settings rs
  WHERE rs.id = 1;

  v_day_cfg := v_hours -> btrim(lower(to_char(p_date, 'FMday')));
  IF v_day_cfg IS NULL OR COALESCE((v_day_cfg->>'closed')::boolean, false) THEN
    RAISE EXCEPTION 'RESTAURANT_CLOSED: El restaurante no atiende reservas en el día seleccionado.';
  END IF;

  v_open := (v_day_cfg->>'open')::time;
  v_close := (v_day_cfg->>'close')::time;

  IF p_time < v_open OR (p_time + make_interval(mins => v_duration))::time > v_close THEN
    RAISE EXCEPTION 'OUT_OF_HOURS: El horario solicitado está fuera del horario de atención configurado.';
  END IF;

  v_start := ((p_date::text || ' ' || p_time::text)::timestamp AT TIME ZONE 'America/Bogota');
  v_end := v_start + make_interval(mins => v_duration);

  IF v_start <= pg_catalog.now() AND v_role <> 'administrador' THEN
    RAISE EXCEPTION 'PAST_RESERVATION: La fecha y hora seleccionadas ya pasaron.';
  END IF;

  SELECT t.id INTO v_table_id
  FROM public.restaurant_tables t
  WHERE t.is_active = true
    AND t.status <> 'fuera_de_servicio'
    AND t.capacity >= p_party_size
    AND (p_zone IS NULL OR btrim(p_zone) = '' OR t.zone = p_zone)
    AND NOT EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.table_id = t.id
        AND r.status IN ('Pendiente', 'Confirmada')
        AND tstzrange(r.start_at, r.end_at, '[)') && tstzrange(v_start, v_end, '[)')
    )
  ORDER BY t.capacity ASC, t.code ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE: No hay mesas disponibles para ese horario y cantidad de personas.';
  END IF;

  v_code := 'RS-' || to_char(p_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.reservations (
    reservation_code,
    customer_id,
    table_id,
    customer_name,
    customer_phone,
    party_size,
    reservation_date,
    start_at,
    end_at,
    duration_minutes,
    notes,
    status
  )
  VALUES (
    v_code,
    v_profile.id,
    v_table_id,
    v_profile.full_name,
    COALESCE(NULLIF(btrim(v_profile.phone), ''), 'Sin teléfono'),
    p_party_size,
    p_date,
    v_start,
    v_end,
    v_duration,
    NULLIF(btrim(p_notes), ''),
    'Confirmada'
  )
  RETURNING * INTO v_res;

  PERFORM public.sync_table_status(v_table_id);
  PERFORM public.log_audit_event('reservations', v_res.id, 'CREATE_RESERVATION', NULL, to_jsonb(v_res));
  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation(date, time, smallint, varchar, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_reservation(date, time, smallint, varchar, text, uuid)
  TO authenticated;

-- B.3. Cancelación controlada de reserva y resincronización de mesa
CREATE OR REPLACE FUNCTION public.cancel_reservation(
  p_reservation_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role varchar := public.current_user_role();
  v_cutoff smallint;
  v_old public.reservations%ROWTYPE;
  v_new public.reservations%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Inicia sesión para gestionar tu reserva.';
  END IF;

  SELECT * INTO v_old
  FROM public.reservations r
  WHERE r.id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: La reserva no existe.';
  END IF;

  IF v_old.customer_id <> v_actor AND v_role <> 'administrador' THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: No tienes permiso para cancelar esta reserva.';
  END IF;

  IF v_old.status NOT IN ('Pendiente', 'Confirmada') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Solo se pueden cancelar reservas pendientes o confirmadas.';
  END IF;

  IF v_role <> 'administrador' THEN
    SELECT COALESCE(rs.reservation_cancel_cutoff_minutes, 60)
    INTO v_cutoff
    FROM public.restaurant_settings rs
    WHERE rs.id = 1;

    IF v_old.start_at - make_interval(mins => v_cutoff) < pg_catalog.now() THEN
      RAISE EXCEPTION 'CANCEL_WINDOW_EXPIRED: Ya venció el plazo mínimo de anticipación para cancelar en línea.';
    END IF;
  END IF;

  UPDATE public.reservations
  SET
    status = 'Cancelada',
    cancelled_at = pg_catalog.now(),
    cancel_reason = NULLIF(btrim(p_reason), '')
  WHERE id = p_reservation_id
  RETURNING * INTO v_new;

  PERFORM public.sync_table_status(v_new.table_id);
  PERFORM public.log_audit_event('reservations', v_new.id, 'CANCEL_RESERVATION', to_jsonb(v_old), to_jsonb(v_new));
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_reservation(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid, text)
  TO authenticated;

-- ============================================================================
-- C. FUNCIONES RPC DE PEDIDOS Y COMANDAS (D-03, D-04, D-05, D-06)
-- ============================================================================

-- C.1. Creación transaccional de pedido con:
--      - Control estricto rol × modalidad (sin ocupación arbitraria de mesas por clientes)
--      - Validación íntegra de reservas asociadas (propiedad, estado, vigencia y mesa)
--      - Validación de complementos contra product_complements y rechazo de duplicados
--      - Recálculo de precios en servidor + snapshots históricos
--      - Asentamiento atómico en sesión de caja abierta para cobros digitales inmediatos
CREATE OR REPLACE FUNCTION public.create_order(
  p_modality varchar,
  p_items jsonb,
  p_payment_method varchar DEFAULT 'Efectivo',
  p_simulate_payment_failure boolean DEFAULT false,
  p_client_request_id uuid DEFAULT NULL,
  p_delivery_address varchar DEFAULT NULL,
  p_delivery_neighborhood varchar DEFAULT NULL,
  p_delivery_directions text DEFAULT NULL,
  p_pickup_eta time DEFAULT NULL,
  p_table_id uuid DEFAULT NULL,
  p_reservation_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role varchar := public.current_user_role();
  v_actor_profile public.profiles%ROWTYPE;
  v_customer_profile public.profiles%ROWTYPE;
  v_effective_customer_id uuid;
  v_existing public.orders%ROWTYPE;
  v_settings public.restaurant_settings%ROWTYPE;
  v_reservation public.reservations%ROWTYPE;
  v_effective_table_id uuid := p_table_id;
  v_table public.restaurant_tables%ROWTYPE;
  v_account_id uuid;
  v_open_cash_session public.cash_sessions%ROWTYPE;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_addon public.products%ROWTYPE;
  v_addon_id uuid;
  v_total_addons_count integer;
  v_distinct_addons_count integer;
  v_qty smallint;
  v_addons_json jsonb;
  v_addons_unit_sum numeric(12,2);
  v_addons_line_total numeric(12,2);
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_payment_status varchar(30);
  v_order_number varchar(30);
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
BEGIN
  -- 1. Autenticación y perfil activo obligatorio (D-06)
  IF v_actor IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Debes iniciar sesión con una cuenta activa para realizar un pedido.';
  END IF;

  SELECT * INTO v_actor_profile
  FROM public.profiles p
  WHERE p.id = v_actor
    AND p.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_INACTIVE: Tu perfil no se encuentra activo.';
  END IF;

  -- 2. Protección contra suplantación de usuario
  IF p_customer_id IS NOT NULL AND p_customer_id <> v_actor AND v_role <> 'administrador' THEN
    RAISE EXCEPTION 'FORBIDDEN_IMPERSONATION: No puedes registrar pedidos en nombre de otro usuario.';
  END IF;

  -- 3. Idempotencia segura (verificando que el reintento pertenezca al mismo actor o admin)
  IF p_client_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.orders o
    WHERE o.client_request_id = p_client_request_id;

    IF FOUND THEN
      IF v_existing.customer_id = v_actor OR v_existing.waiter_id = v_actor OR v_role = 'administrador' THEN
        RETURN v_existing;
      ELSE
        RAISE EXCEPTION 'DUPLICATE_REQUEST_ID: El identificador de solicitud ya fue utilizado.';
      END IF;
    END IF;
  END IF;

  -- 4. Validación de modalidad y autorización por rol
  IF p_modality NOT IN ('domicilio', 'recoger', 'mesa') THEN
    RAISE EXCEPTION 'INVALID_MODALITY: Modalidad no válida.';
  END IF;

  SELECT * INTO v_settings FROM public.restaurant_settings rs WHERE rs.id = 1;

  IF p_modality IN ('domicilio', 'recoger') THEN
    IF v_role = 'mesero' THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE: El perfil mesero solo está autorizado para registrar pedidos en mesa.';
    END IF;

    IF p_reservation_id IS NOT NULL OR p_table_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_RESERVATION_MODALITY: No se puede asociar mesa ni reserva a pedidos de domicilio o recoger.';
    END IF;

    v_effective_customer_id := COALESCE(p_customer_id, v_actor);
    SELECT * INTO v_customer_profile
    FROM public.profiles p
    WHERE p.id = v_effective_customer_id AND p.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CUSTOMER_NOT_FOUND: El perfil del cliente destinatario no existe o está inactivo.';
    END IF;

    IF p_modality = 'domicilio' THEN
      IF NULLIF(btrim(p_delivery_address), '') IS NULL OR NULLIF(btrim(p_delivery_neighborhood), '') IS NULL THEN
        RAISE EXCEPTION 'MISSING_ADDRESS: Dirección y barrio son obligatorios para domicilio.';
      END IF;
      v_delivery_fee := COALESCE(v_settings.fixed_delivery_fee, 0);
    END IF;

  ELSIF p_modality = 'mesa' THEN
    -- Validación de reserva asociada cuando se proporciona p_reservation_id
    IF p_reservation_id IS NOT NULL THEN
      SELECT * INTO v_reservation
      FROM public.reservations r
      WHERE r.id = p_reservation_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'RESERVATION_NOT_FOUND: La reserva indicada no existe.';
      END IF;

      IF v_role = 'cliente' AND v_reservation.customer_id <> v_actor THEN
        RAISE EXCEPTION 'FORBIDDEN_RESERVATION: No puedes asociar una reserva que pertenece a otro cliente.';
      END IF;

      IF v_reservation.status NOT IN ('Confirmada', 'Atendida') THEN
        RAISE EXCEPTION 'INVALID_RESERVATION_STATUS: La reserva debe estar Confirmada o en atención vigente.';
      END IF;

      IF v_role <> 'administrador' AND (
        pg_catalog.now() < (v_reservation.start_at - interval '30 minutes')
        OR pg_catalog.now() > v_reservation.end_at
      ) THEN
        RAISE EXCEPTION 'RESERVATION_NOT_ACTIVE_NOW: La reserva no se encuentra dentro de su horario de atención vigente.';
      END IF;

      IF v_effective_table_id IS NOT NULL AND v_effective_table_id <> v_reservation.table_id THEN
        RAISE EXCEPTION 'RESERVATION_TABLE_MISMATCH: La mesa indicada no coincide con la mesa asignada a la reserva.';
      END IF;

      v_effective_table_id := v_reservation.table_id;

      -- Impedir reutilizar la misma reserva en otra mesa o en una cuenta ya cerrada
      IF EXISTS (
        SELECT 1
        FROM public.orders o
        JOIN public.table_accounts ta ON ta.id = o.table_account_id
        WHERE o.reservation_id = p_reservation_id
          AND o.status <> 'Cancelado'
          AND (o.table_id <> v_effective_table_id OR ta.status IN ('closed', 'cancelled'))
      ) THEN
        RAISE EXCEPTION 'RESERVATION_ALREADY_USED: Esta reserva ya fue utilizada en una cuenta cerrada o incompatible.';
      END IF;
    END IF;

    -- Regla crítica: Un cliente NO puede ocupar mesas arbitrariamente.
    -- Solo puede pedir en mesa si allow_client_table_orders = true (decisión P-05) Y tiene reserva vigente propia.
    IF v_role = 'cliente' THEN
      IF NOT COALESCE(v_settings.allow_client_table_orders, false) THEN
        RAISE EXCEPTION 'CLIENT_TABLE_ORDERS_DISABLED: Los pedidos en mesa son registrados por el mesero del salón.';
      END IF;
      IF p_reservation_id IS NULL THEN
        RAISE EXCEPTION 'RESERVATION_REQUIRED_FOR_CLIENT_TABLE: Para pedir en mesa desde tu cuenta debes tener una reserva confirmada y vigente.';
      END IF;
      v_effective_customer_id := v_actor;
      v_customer_profile := v_actor_profile;
    ELSE
      -- Mesero o Administrador
      IF p_customer_id IS NOT NULL THEN
        SELECT * INTO v_customer_profile FROM public.profiles p WHERE p.id = p_customer_id AND p.is_active = true;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'CUSTOMER_NOT_FOUND: El cliente asociado no existe o está inactivo.';
        END IF;
        v_effective_customer_id := v_customer_profile.id;
      ELSIF p_reservation_id IS NOT NULL THEN
        SELECT * INTO v_customer_profile FROM public.profiles p WHERE p.id = v_reservation.customer_id;
        v_effective_customer_id := v_reservation.customer_id;
      ELSE
        v_effective_customer_id := NULL;
        v_customer_profile := v_actor_profile;
      END IF;
    END IF;

    IF v_effective_table_id IS NULL THEN
      RAISE EXCEPTION 'MISSING_TABLE: Debes seleccionar una mesa válida.';
    END IF;

    SELECT * INTO v_table
    FROM public.restaurant_tables t
    WHERE t.id = v_effective_table_id
      AND t.is_active = true
      AND t.status <> 'fuera_de_servicio'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'TABLE_UNAVAILABLE: La mesa seleccionada no está activa o está fuera de servicio.';
    END IF;

    -- Proteger mesas reservadas para otro cliente en este instante si no se aporta esa reserva
    IF p_reservation_id IS NULL AND EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.table_id = v_effective_table_id
        AND r.status = 'Confirmada'
        AND pg_catalog.now() >= (r.start_at - interval '30 minutes')
        AND pg_catalog.now() < r.end_at
    ) AND v_role <> 'administrador' THEN
      RAISE EXCEPTION 'TABLE_RESERVED_NOW: La mesa tiene una reserva confirmada en este bloque horario; asocia la reserva correspondiente.';
    END IF;

    -- Obtener o abrir la cuenta acumulada única de la mesa (D-04)
    SELECT ta.id INTO v_account_id
    FROM public.table_accounts ta
    WHERE ta.table_id = v_effective_table_id
      AND ta.status IN ('open', 'closing_requested')
    LIMIT 1
    FOR UPDATE;

    IF v_account_id IS NULL THEN
      INSERT INTO public.table_accounts (table_id, opened_by, status, total_amount)
      VALUES (v_effective_table_id, v_actor, 'open', 0)
      RETURNING id INTO v_account_id;
    ELSE
      -- Si se aporta reserva y ya hay cuenta abierta con otra reserva distinta, rechazar conflicto
      IF p_reservation_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.table_account_id = v_account_id
          AND o.status <> 'Cancelado'
          AND o.reservation_id IS NOT NULL
          AND o.reservation_id <> p_reservation_id
      ) THEN
        RAISE EXCEPTION 'RESERVATION_CONFLICT_ON_ACCOUNT: La cuenta activa de esta mesa ya pertenece a otra reserva.';
      END IF;
    END IF;

    IF p_reservation_id IS NOT NULL AND v_reservation.status = 'Confirmada' THEN
      UPDATE public.reservations
      SET status = 'Atendida'
      WHERE id = p_reservation_id;
    END IF;
  END IF;

  -- 5. Validación de carrito no vacío y estado de pago + sesión de caja
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'EMPTY_CART: El pedido debe incluir al menos un producto.';
  END IF;

  IF p_modality = 'mesa' THEN
    v_payment_status := 'Pendiente'; -- D-04: pago diferido al cierre de cuenta
  ELSIF p_simulate_payment_failure THEN
    RAISE EXCEPTION 'PAYMENT_SIMULATION_FAILED: La simulación de pago fue rechazada. No se generó cobro.';
  ELSIF p_payment_method = 'Efectivo' THEN
    v_payment_status := 'Pendiente'; -- Se confirma y asienta en caja abierta mediante confirm_order_payment
  ELSIF p_payment_method IN ('Tarjeta', 'Nequi', 'PSE') THEN
    -- Impedir registrar ventas cobradas sin sesión de caja abierta
    SELECT * INTO v_open_cash_session
    FROM public.cash_sessions cs
    WHERE cs.status = 'open'
    LIMIT 1
    FOR KEY SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CASH_CLOSED: No hay una sesión de caja abierta para procesar pagos confirmados en este momento.';
    END IF;

    v_payment_status := 'Confirmación simulada';
  ELSE
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: Medio de pago no soportado.';
  END IF;

  -- 6. Primer pase: validar productos, complementos en product_complements, duplicados y precios
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::smallint, 0);
    IF v_qty < 1 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: La cantidad de cada línea debe ser mayor o igual a 1.';
    END IF;

    SELECT * INTO v_product
    FROM public.products pr
    WHERE pr.id = (v_item->>'product_id')::uuid
      AND pr.is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: Uno de los productos seleccionados no existe o no está disponible.';
    END IF;

    v_addons_unit_sum := 0;

    IF v_item ? 'addon_ids' AND v_item->'addon_ids' IS NOT NULL AND jsonb_typeof(v_item->'addon_ids') <> 'null' THEN
      IF jsonb_typeof(v_item->'addon_ids') <> 'array' THEN
        RAISE EXCEPTION 'INVALID_ADDONS_FORMAT: addon_ids debe ser un arreglo JSON.';
      END IF;

      SELECT count(*), count(DISTINCT val)
      INTO v_total_addons_count, v_distinct_addons_count
      FROM jsonb_array_elements_text(v_item->'addon_ids') AS t(val);

      IF v_total_addons_count <> v_distinct_addons_count THEN
        RAISE EXCEPTION 'DUPLICATE_ADDON: No se permiten identificadores de complementos repetidos en una misma línea.';
      END IF;

      FOR v_addon_id IN
        SELECT (val)::uuid FROM jsonb_array_elements_text(v_item->'addon_ids') AS t(val)
      LOOP
        SELECT pr.* INTO v_addon
        FROM public.products pr
        JOIN public.product_complements pc
          ON pc.complement_id = pr.id
         AND pc.product_id = v_product.id
        WHERE pr.id = v_addon_id
          AND pr.is_addon = true
          AND pr.is_available = true;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'INVALID_ADDON_RELATION: El complemento % no está habilitado para el producto % o no está disponible.', v_addon_id, v_product.name;
        END IF;

        v_addons_unit_sum := v_addons_unit_sum + v_addon.price;
      END LOOP;
    END IF;

    v_subtotal := v_subtotal + ((v_product.price + v_addons_unit_sum) * v_qty);
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;
  v_order_number := 'FB-' || to_char(pg_catalog.now() AT TIME ZONE 'America/Bogota', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- 7. Insertar encabezado de pedido
  INSERT INTO public.orders (
    order_number,
    client_request_id,
    customer_id,
    waiter_id,
    table_id,
    table_account_id,
    reservation_id,
    modality,
    customer_name,
    customer_email,
    customer_phone,
    delivery_address,
    delivery_neighborhood,
    delivery_directions,
    pickup_eta,
    notes,
    subtotal,
    delivery_fee,
    total,
    status,
    payment_status
  )
  VALUES (
    v_order_number,
    p_client_request_id,
    v_effective_customer_id,
    CASE WHEN v_role = 'mesero' THEN v_actor ELSE NULL END,
    v_effective_table_id,
    v_account_id,
    p_reservation_id,
    p_modality,
    CASE
      WHEN p_modality = 'mesa' AND v_effective_customer_id IS NULL THEN 'Servicio en ' || v_table.code
      ELSE v_customer_profile.full_name
    END,
    CASE WHEN v_effective_customer_id IS NOT NULL THEN v_customer_profile.email ELSE NULL END,
    CASE WHEN v_effective_customer_id IS NOT NULL THEN v_customer_profile.phone ELSE NULL END,
    CASE WHEN p_modality = 'domicilio' THEN NULLIF(btrim(p_delivery_address), '') ELSE NULL END,
    CASE WHEN p_modality = 'domicilio' THEN NULLIF(btrim(p_delivery_neighborhood), '') ELSE NULL END,
    CASE WHEN p_modality = 'domicilio' THEN NULLIF(btrim(p_delivery_directions), '') ELSE NULL END,
    CASE WHEN p_modality = 'recoger' THEN p_pickup_eta ELSE NULL END,
    NULLIF(btrim(p_notes), ''),
    v_subtotal,
    v_delivery_fee,
    v_total,
    'Pendiente',
    v_payment_status
  )
  RETURNING * INTO v_order;

  -- 8. Insertar snapshots inmutables en order_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::smallint;
    SELECT * INTO v_product FROM public.products pr WHERE pr.id = (v_item->>'product_id')::uuid;

    v_addons_json := '[]'::jsonb;
    v_addons_unit_sum := 0;

    IF v_item ? 'addon_ids' AND jsonb_typeof(v_item->'addon_ids') = 'array' THEN
      FOR v_addon_id IN
        SELECT (val)::uuid FROM jsonb_array_elements_text(v_item->'addon_ids') AS t(val)
      LOOP
        SELECT * INTO v_addon FROM public.products pr WHERE pr.id = v_addon_id;
        v_addons_unit_sum := v_addons_unit_sum + v_addon.price;
        v_addons_json := v_addons_json || jsonb_build_array(
          jsonb_build_object(
            'id', v_addon.id,
            'name', v_addon.name,
            'price', v_addon.price
          )
        );
      END LOOP;
    END IF;

    v_addons_line_total := v_addons_unit_sum * v_qty;
    v_line_total := (v_product.price * v_qty) + v_addons_line_total;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name_snapshot,
      unit_price_snapshot,
      quantity,
      addons_snapshot,
      addons_total,
      line_total,
      notes
    )
    VALUES (
      v_order.id,
      v_product.id,
      v_product.name,
      v_product.price,
      v_qty,
      v_addons_json,
      v_addons_line_total,
      v_line_total,
      NULLIF(left(btrim(COALESCE(v_item->>'notes', '')), 200), '')
    );
  END LOOP;

  -- 9. Trazabilidad inicial de estado
  INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, reason)
  VALUES (v_order.id, NULL, 'Pendiente', v_actor, 'Creación de pedido');

  -- 10. Gestión de pagos y sincronización de caja / mesa
  IF p_modality IN ('domicilio', 'recoger') THEN
    INSERT INTO public.payments (
      order_id,
      method,
      status,
      amount,
      transaction_ref,
      is_simulated,
      paid_at
    )
    VALUES (
      v_order.id,
      p_payment_method,
      v_payment_status,
      v_total,
      'DEMO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      true,
      CASE WHEN v_payment_status = 'Confirmación simulada' THEN pg_catalog.now() ELSE NULL END
    )
    RETURNING * INTO v_payment;

    -- Si el pago digital simulado quedó confirmado, registrarlo atómicamente en el turno abierto de caja
    IF v_payment_status = 'Confirmación simulada' AND v_total > 0 THEN
      INSERT INTO public.cash_movements (
        cash_session_id,
        payment_id,
        movement_type,
        payment_method,
        amount,
        concept,
        created_by
      )
      VALUES (
        v_open_cash_session.id,
        v_payment.id,
        'sale',
        p_payment_method,
        v_total,
        'Venta pedido ' || v_order.order_number || ' (' || p_modality || ')',
        v_actor
      );
    END IF;

  ELSIF p_modality = 'mesa' THEN
    PERFORM public.recalculate_table_account_total(v_account_id);
    PERFORM public.sync_table_status(v_effective_table_id);
  END IF;

  PERFORM public.log_audit_event('orders', v_order.id, 'CREATE_ORDER', NULL, to_jsonb(v_order));
  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(varchar, jsonb, varchar, boolean, uuid, varchar, varchar, text, time, uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(varchar, jsonb, varchar, boolean, uuid, varchar, varchar, text, time, uuid, uuid, text, uuid)
  TO authenticated;

-- C.2. Toma de comanda en salón por Mesero o Administrador
CREATE OR REPLACE FUNCTION public.create_table_order(
  p_table_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_client_request_id uuid DEFAULT NULL,
  p_reservation_id uuid DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.is_waiter() OR public.is_admin()) THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo meseros o administradores pueden registrar comandas de salón.';
  END IF;

  RETURN public.create_order(
    p_modality => 'mesa',
    p_items => p_items,
    p_payment_method => 'Efectivo',
    p_simulate_payment_failure => false,
    p_client_request_id => p_client_request_id,
    p_table_id => p_table_id,
    p_reservation_id => p_reservation_id,
    p_notes => p_notes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_table_order(uuid, jsonb, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_table_order(uuid, jsonb, text, uuid, uuid)
  TO authenticated;

-- C.3. Actualización controlada de estado de pedido (Regla D-05 Mesero vs Admin)
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status varchar,
  p_reason text DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_is_waiter boolean := public.is_waiter();
  v_old public.orders%ROWTYPE;
  v_new public.orders%ROWTYPE;
BEGIN
  IF NOT (v_is_admin OR v_is_waiter) THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: No tienes permisos para actualizar estados de pedidos.';
  END IF;

  SELECT * INTO v_old
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: El pedido no existe.';
  END IF;

  IF p_new_status NOT IN ('Pendiente', 'Confirmado', 'En preparación', 'Listo', 'Despachado', 'Entregado', 'Cancelado') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Estado de pedido no válido.';
  END IF;

  IF v_old.status IN ('Entregado', 'Cancelado') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: El pedido ya se encuentra en un estado finalizado (%).', v_old.status;
  END IF;

  IF p_new_status = 'Despachado' AND v_old.modality <> 'domicilio' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: El estado Despachado solo aplica para pedidos a domicilio.';
  END IF;

  -- Validación estricta D-05 para Mesero
  IF v_is_waiter AND NOT v_is_admin THEN
    IF v_old.modality <> 'mesa' THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE: El mesero solo puede gestionar pedidos en mesa.';
    END IF;

    IF p_new_status = 'Cancelado' AND v_old.status <> 'Pendiente' THEN
      RAISE EXCEPTION 'FORBIDDEN_CANCEL: El mesero solo puede cancelar pedidos recién registrados (Pendiente).';
    END IF;

    IF p_new_status = 'Entregado' AND v_old.status <> 'Listo' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION: El pedido debe estar Listo antes de marcarlo como Entregado.';
    END IF;

    IF p_new_status NOT IN ('Entregado', 'Cancelado') THEN
      RAISE EXCEPTION 'FORBIDDEN_ROLE: Los estados de preparación son gestionados exclusivamente por el administrador.';
    END IF;
  END IF;

  UPDATE public.orders
  SET status = p_new_status
  WHERE id = p_order_id
  RETURNING * INTO v_new;

  INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, reason)
  VALUES (v_new.id, v_old.status, p_new_status, v_actor, NULLIF(btrim(p_reason), ''));

  IF v_new.table_account_id IS NOT NULL AND p_new_status = 'Cancelado' THEN
    PERFORM public.recalculate_table_account_total(v_new.table_account_id);
  END IF;

  PERFORM public.log_audit_event('orders', v_new.id, 'UPDATE_ORDER_STATUS', to_jsonb(v_old), to_jsonb(v_new));
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status(uuid, varchar, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, varchar, text)
  TO authenticated;

-- ============================================================================
-- D. FUNCIONES RPC DE CAJA, PAGOS INDIVIDUALES Y CUENTAS DE MESA (D-04)
-- ============================================================================

-- D.1. Apertura de turno de Caja (Exclusivo Administrador)
CREATE OR REPLACE FUNCTION public.open_cash_session(
  p_opening_balance numeric,
  p_notes text DEFAULT NULL
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session public.cash_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede abrir un turno de caja.';
  END IF;

  IF p_opening_balance IS NULL OR p_opening_balance < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: La base inicial debe ser mayor o igual a 0.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.cash_sessions cs WHERE cs.status = 'open') THEN
    RAISE EXCEPTION 'CASH_ALREADY_OPEN: Ya existe una sesión de caja abierta.';
  END IF;

  INSERT INTO public.cash_sessions (
    opened_by,
    status,
    opening_balance,
    notes
  )
  VALUES (
    v_actor,
    'open',
    p_opening_balance,
    NULLIF(btrim(p_notes), '')
  )
  RETURNING * INTO v_session;

  PERFORM public.log_audit_event('cash_sessions', v_session.id, 'OPEN_CASH_SESSION', NULL, to_jsonb(v_session));
  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.open_cash_session(numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_cash_session(numeric, text)
  TO authenticated;

-- D.2. Registro de ingreso o egreso manual en Caja abierta (Exclusivo Administrador)
CREATE OR REPLACE FUNCTION public.register_cash_movement(
  p_movement_type varchar,
  p_payment_method varchar,
  p_amount numeric,
  p_concept varchar
)
RETURNS public.cash_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session public.cash_sessions%ROWTYPE;
  v_movement public.cash_movements%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede registrar movimientos manuales de caja.';
  END IF;

  IF p_movement_type NOT IN ('manual_income', 'manual_expense') THEN
    RAISE EXCEPTION 'INVALID_MOVEMENT_TYPE: Solo se permiten ingresos o egresos manuales por esta vía.';
  END IF;

  IF p_payment_method NOT IN ('Efectivo', 'Tarjeta', 'Nequi', 'PSE') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: Medio de pago no válido.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: El monto del movimiento debe ser mayor que 0.';
  END IF;

  IF NULLIF(btrim(p_concept), '') IS NULL OR char_length(btrim(p_concept)) < 2 THEN
    RAISE EXCEPTION 'INVALID_CONCEPT: El concepto del movimiento es obligatorio.';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.status = 'open'
  LIMIT 1
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASH_CLOSED: No hay una sesión de caja abierta.';
  END IF;

  INSERT INTO public.cash_movements (
    cash_session_id,
    payment_id,
    movement_type,
    payment_method,
    amount,
    concept,
    created_by
  )
  VALUES (
    v_session.id,
    NULL,
    p_movement_type,
    p_payment_method,
    p_amount,
    btrim(p_concept),
    v_actor
  )
  RETURNING * INTO v_movement;

  PERFORM public.log_audit_event('cash_movements', v_movement.id, 'REGISTER_CASH_MOVEMENT', NULL, to_jsonb(v_movement));
  RETURN v_movement;
END;
$$;

REVOKE ALL ON FUNCTION public.register_cash_movement(varchar, varchar, numeric, varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_cash_movement(varchar, varchar, numeric, varchar)
  TO authenticated;

-- D.3. Confirmación de pago pendiente de pedido individual (Domicilio / Recoger)
--      y asentamiento único en sesión de caja abierta (Exclusivo Administrador)
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
  p_order_id uuid,
  p_payment_method varchar DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session public.cash_sessions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_final_method varchar(25);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede confirmar cobros de pedidos en caja.';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.status = 'open'
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASH_CLOSED: Debes abrir un turno de caja antes de confirmar cobros.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: El pedido indicado no existe.';
  END IF;

  IF v_order.modality = 'mesa' THEN
    RAISE EXCEPTION 'USE_TABLE_SETTLEMENT: Los pedidos en mesa se cobran al cerrar la cuenta de mesa (D-04).';
  END IF;

  IF v_order.status = 'Cancelado' THEN
    RAISE EXCEPTION 'ORDER_CANCELLED: No se puede confirmar el cobro de un pedido cancelado.';
  END IF;

  IF v_order.payment_status = 'Confirmación simulada' THEN
    RAISE EXCEPTION 'ALREADY_PAID: El pago de este pedido ya fue confirmado previamente.';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments p
  WHERE p.order_id = v_order.id
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  v_final_method := COALESCE(NULLIF(btrim(p_payment_method), ''), v_payment.method, 'Efectivo');
  IF v_final_method NOT IN ('Efectivo', 'Tarjeta', 'Nequi', 'PSE') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: Medio de pago no válido.';
  END IF;

  IF v_payment.id IS NOT NULL THEN
    IF v_payment.status IN ('Confirmación simulada', 'Reembolsado') OR EXISTS (
      SELECT 1 FROM public.cash_movements cm WHERE cm.payment_id = v_payment.id
    ) THEN
      RAISE EXCEPTION 'ALREADY_ACCOUNTED: Este pago ya se encuentra contabilizado en caja.';
    END IF;

    UPDATE public.payments
    SET
      method = v_final_method,
      status = 'Confirmación simulada',
      amount = v_order.total,
      paid_at = pg_catalog.now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  ELSE
    INSERT INTO public.payments (
      order_id,
      method,
      status,
      amount,
      transaction_ref,
      is_simulated,
      paid_at
    )
    VALUES (
      v_order.id,
      v_final_method,
      'Confirmación simulada',
      v_order.total,
      'DEMO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      true,
      pg_catalog.now()
    )
    RETURNING * INTO v_payment;
  END IF;

  UPDATE public.orders
  SET payment_status = 'Confirmación simulada'
  WHERE id = v_order.id;

  IF v_order.total > 0 THEN
    INSERT INTO public.cash_movements (
      cash_session_id,
      payment_id,
      movement_type,
      payment_method,
      amount,
      concept,
      created_by
    )
    VALUES (
      v_session.id,
      v_payment.id,
      'sale',
      v_final_method,
      v_order.total,
      'Cobro pedido ' || v_order.order_number || ' (' || v_order.modality || ')',
      v_actor
    );
  END IF;

  PERFORM public.log_audit_event('payments', v_payment.id, 'CONFIRM_ORDER_PAYMENT', NULL, to_jsonb(v_payment));
  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, varchar)
  TO authenticated;

-- D.4. Reembolso simulado controlado de un pedido cancelado con trazabilidad en Caja
--      (Exclusivo Administrador; distingue efectivo vs digital; evita duplicación)
CREATE OR REPLACE FUNCTION public.refund_order_payment(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_old_payment public.payments%ROWTYPE;
  v_new_payment public.payments%ROWTYPE;
  v_session public.cash_sessions%ROWTYPE;
  v_refund_movement public.cash_movements%ROWTYPE;
  v_refund_channel varchar(20);
  v_available_cash numeric(12,2);
  v_clean_reason text := NULLIF(btrim(p_reason), '');
  v_concept varchar(200);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede registrar reembolsos simulados.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: El pedido no existe.';
  END IF;

  IF v_order.modality = 'mesa' THEN
    RAISE EXCEPTION 'UNSUPPORTED_TABLE_REFUND: Los pedidos de mesa no tienen pagos individuales; gestiona el ajuste a nivel de cuenta.';
  END IF;

  IF v_order.status <> 'Cancelado' THEN
    RAISE EXCEPTION 'ORDER_NOT_CANCELLED: El pedido debe estar Cancelado antes de reembolsar su pago.';
  END IF;

  -- Evitar reembolsos duplicados verificando tanto el estado del pago como cash_movements
  IF EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.order_id = v_order.id
      AND p.status = 'Reembolsado'
  ) THEN
    RAISE EXCEPTION 'ALREADY_REFUNDED: El pago de este pedido ya fue reembolsado previamente.';
  END IF;

  SELECT * INTO v_old_payment
  FROM public.payments p
  WHERE p.order_id = v_order.id
    AND p.status = 'Confirmación simulada'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CONFIRMED_PAYMENT: El pedido no tiene un pago confirmado susceptible de reembolso.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cash_movements cm
    WHERE cm.payment_id = v_old_payment.id
      AND cm.movement_type = 'refund'
  ) THEN
    RAISE EXCEPTION 'ALREADY_REFUNDED: Ya existe un movimiento de reembolso registrado para este pago.';
  END IF;

  v_refund_channel := CASE
    WHEN v_old_payment.method = 'Efectivo' THEN 'cash'
    ELSE 'digital'
  END;

  -- Validar sesión de caja abierta para registrar el movimiento de reembolso
  -- y disponibilidad real de efectivo físico cuando el método original sea 'Efectivo'
  IF v_old_payment.amount > 0 THEN
    SELECT * INTO v_session
    FROM public.cash_sessions cs
    WHERE cs.status = 'open'
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      IF v_old_payment.method = 'Efectivo' THEN
        RAISE EXCEPTION 'CASH_CLOSED: Se requiere una sesión de caja abierta para registrar un reembolso en efectivo.';
      ELSE
        RAISE EXCEPTION 'CASH_CLOSED: Debes abrir una sesión de caja para contabilizar el reembolso digital en los movimientos de caja.';
      END IF;
    END IF;

    -- Restricción de liquidez física aplicada exclusivamente a reembolsos en Efectivo (no digitales)
    IF v_old_payment.method = 'Efectivo' THEN
      SELECT
        v_session.opening_balance
        + COALESCE(SUM(CASE WHEN cm.movement_type IN ('sale', 'manual_income') THEN cm.amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN cm.movement_type IN ('manual_expense', 'refund') THEN cm.amount ELSE 0 END), 0)
      INTO v_available_cash
      FROM public.cash_movements cm
      WHERE cm.cash_session_id = v_session.id
        AND cm.payment_method = 'Efectivo';

      IF v_available_cash < v_old_payment.amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_CASH_FOR_REFUND: Efectivo disponible insuficiente en caja (% < %).',
          v_available_cash, v_old_payment.amount;
      END IF;
    END IF;
  END IF;

  -- Actualizar únicamente el pago original y el payment_status de ESTE pedido (sin alterar totales de pedidos)
  UPDATE public.payments
  SET status = 'Reembolsado'
  WHERE id = v_old_payment.id
  RETURNING * INTO v_new_payment;

  UPDATE public.orders
  SET payment_status = 'Reembolsado'
  WHERE id = v_order.id;

  IF v_old_payment.amount > 0 THEN
    v_concept := left(
      CASE
        WHEN v_old_payment.method = 'Efectivo'
          THEN 'Reembolso en efectivo pedido ' || v_order.order_number
        ELSE 'Reembolso digital (' || v_old_payment.method || ') pedido ' || v_order.order_number
      END || COALESCE(' · ' || v_clean_reason, ''),
      200
    );

    INSERT INTO public.cash_movements (
      cash_session_id,
      payment_id,
      movement_type,
      payment_method,
      amount,
      concept,
      created_by
    )
    VALUES (
      v_session.id,
      v_old_payment.id,
      'refund',
      v_old_payment.method,
      v_old_payment.amount,
      v_concept,
      v_actor
    )
    RETURNING * INTO v_refund_movement;
  END IF;

  PERFORM public.log_audit_event(
    'payments',
    v_new_payment.id,
    'REFUND_ORDER_PAYMENT',
    to_jsonb(v_old_payment),
    jsonb_build_object(
      'payment', to_jsonb(v_new_payment),
      'refund_channel', v_refund_channel,
      'available_cash_before', v_available_cash,
      'cash_movement_id', v_refund_movement.id,
      'cash_session_id', v_session.id,
      'reason', v_clean_reason
    )
  );

  RETURN v_new_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_order_payment(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_order_payment(uuid, text)
  TO authenticated;

-- D.5. Solicitud de cierre de cuenta de mesa por Mesero o Administrador (D-04)
CREATE OR REPLACE FUNCTION public.request_table_account_close(p_table_account_id uuid)
RETURNS public.table_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_acc public.table_accounts%ROWTYPE;
BEGIN
  IF NOT (public.is_waiter() OR public.is_admin()) THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo personal autorizado puede solicitar el cierre de cuenta.';
  END IF;

  PERFORM public.recalculate_table_account_total(p_table_account_id);

  UPDATE public.table_accounts
  SET
    status = 'closing_requested',
    closing_requested_at = pg_catalog.now()
  WHERE id = p_table_account_id
    AND status = 'open'
  RETURNING * INTO v_acc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_ACCOUNT_STATE: La cuenta de mesa no está abierta o no existe.';
  END IF;

  PERFORM public.log_audit_event('table_accounts', v_acc.id, 'REQUEST_ACCOUNT_CLOSE', NULL, to_jsonb(v_acc));
  RETURN v_acc;
END;
$$;

REVOKE ALL ON FUNCTION public.request_table_account_close(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_table_account_close(uuid)
  TO authenticated;

-- D.6. Cobro consolidado de cuenta de mesa y liberación coherente de mesa/reservas (D-04)
CREATE OR REPLACE FUNCTION public.settle_table_account(
  p_table_account_id uuid,
  p_payment_method varchar
)
RETURNS public.table_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session public.cash_sessions%ROWTYPE;
  v_acc public.table_accounts%ROWTYPE;
  v_payment public.payments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador en Caja puede registrar el cobro definitivo de la mesa.';
  END IF;

  IF p_payment_method NOT IN ('Efectivo', 'Tarjeta', 'Nequi', 'PSE') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD: Medio de pago no válido.';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.status = 'open'
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASH_CLOSED: Debes abrir un turno de caja antes de cobrar cuentas de mesa.';
  END IF;

  SELECT * INTO v_acc
  FROM public.table_accounts ta
  WHERE ta.id = p_table_account_id
    AND ta.status IN ('open', 'closing_requested')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_OPEN: La cuenta ya fue cerrada o no existe.';
  END IF;

  -- Impedir cerrar la cuenta dejando comandas sin entregar ni cancelar
  IF EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.table_account_id = v_acc.id
      AND o.status NOT IN ('Entregado', 'Cancelado')
  ) THEN
    RAISE EXCEPTION 'PENDING_ORDERS_IN_ACCOUNT: Existen comandas en preparación o sin entregar en esta mesa.';
  END IF;

  PERFORM public.recalculate_table_account_total(v_acc.id);
  SELECT * INTO v_acc FROM public.table_accounts ta WHERE ta.id = v_acc.id;

  IF v_acc.total_amount > 0 THEN
    INSERT INTO public.payments (
      table_account_id,
      method,
      status,
      amount,
      transaction_ref,
      is_simulated,
      paid_at
    )
    VALUES (
      v_acc.id,
      p_payment_method,
      'Confirmación simulada',
      v_acc.total_amount,
      'DEMO-MESA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      true,
      pg_catalog.now()
    )
    RETURNING * INTO v_payment;

    INSERT INTO public.cash_movements (
      cash_session_id,
      payment_id,
      movement_type,
      payment_method,
      amount,
      concept,
      created_by
    )
    VALUES (
      v_session.id,
      v_payment.id,
      'sale',
      p_payment_method,
      v_acc.total_amount,
      'Cierre de cuenta de mesa',
      v_actor
    );
  END IF;

  UPDATE public.orders
  SET payment_status = 'Confirmación simulada'
  WHERE table_account_id = v_acc.id
    AND status <> 'Cancelado';

  -- Marcar como Atendida cualquier reserva vinculada a los pedidos de esta cuenta
  UPDATE public.reservations r
  SET status = 'Atendida'
  FROM public.orders o
  WHERE o.table_account_id = v_acc.id
    AND o.reservation_id = r.id
    AND r.status IN ('Pendiente', 'Confirmada');

  UPDATE public.table_accounts
  SET
    status = 'closed',
    closed_at = pg_catalog.now(),
    closed_by = v_actor
  WHERE id = v_acc.id
  RETURNING * INTO v_acc;

  -- Liberar la mesa evaluando si tiene una reserva próxima/vigente o si está fuera de servicio
  PERFORM public.sync_table_status(v_acc.table_id);

  PERFORM public.log_audit_event('table_accounts', v_acc.id, 'SETTLE_TABLE_ACCOUNT', NULL, to_jsonb(v_acc));
  RETURN v_acc;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_table_account(uuid, varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_table_account(uuid, varchar)
  TO authenticated;

-- D.7. Arqueo y cierre de sesión de Caja
--      Contabiliza ventas brutas y reembolsos por canal (efectivo vs digital) sin doble resta
CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_cash_session_id uuid,
  p_counted_cash numeric,
  p_notes text DEFAULT NULL
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_session public.cash_sessions%ROWTYPE;
  v_cash_sales numeric(12,2);
  v_cash_refunds numeric(12,2);
  v_digital_sales numeric(12,2);
  v_digital_refunds numeric(12,2);
  v_net_digital_sales numeric(12,2);
  v_manual_in numeric(12,2);
  v_manual_out numeric(12,2);
  v_expected_cash numeric(12,2);
  v_closed public.cash_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede cerrar caja.';
  END IF;

  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: El efectivo contado debe ser mayor o igual a 0.';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.id = p_cash_session_id
    AND cs.status = 'open'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_OPEN: El turno de caja no existe o ya fue cerrado.';
  END IF;

  -- Ventas brutas y reembolsos en efectivo del turno
  SELECT COALESCE(SUM(cm.amount), 0) INTO v_cash_sales
  FROM public.cash_movements cm
  WHERE cm.cash_session_id = v_session.id
    AND cm.movement_type = 'sale'
    AND cm.payment_method = 'Efectivo';

  SELECT COALESCE(SUM(cm.amount), 0) INTO v_cash_refunds
  FROM public.cash_movements cm
  WHERE cm.cash_session_id = v_session.id
    AND cm.movement_type = 'refund'
    AND cm.payment_method = 'Efectivo';

  -- Ventas brutas y reembolsos digitales del turno (separados del efectivo físico)
  SELECT COALESCE(SUM(cm.amount), 0) INTO v_digital_sales
  FROM public.cash_movements cm
  WHERE cm.cash_session_id = v_session.id
    AND cm.movement_type = 'sale'
    AND cm.payment_method IN ('Tarjeta', 'Nequi', 'PSE');

  SELECT COALESCE(SUM(cm.amount), 0) INTO v_digital_refunds
  FROM public.cash_movements cm
  WHERE cm.cash_session_id = v_session.id
    AND cm.movement_type = 'refund'
    AND cm.payment_method IN ('Tarjeta', 'Nequi', 'PSE');

  SELECT COALESCE(SUM(cm.amount), 0) INTO v_manual_in
  FROM public.cash_movements cm
  WHERE cm.cash_session_id = v_session.id
    AND cm.movement_type = 'manual_income'
    AND cm.payment_method = 'Efectivo';

  SELECT COALESCE(SUM(cm.amount), 0) INTO v_manual_out
  FROM public.cash_movements cm
  WHERE cm.cash_session_id = v_session.id
    AND cm.movement_type = 'manual_expense'
    AND cm.payment_method = 'Efectivo';

  v_net_digital_sales := v_digital_sales - v_digital_refunds;
  v_expected_cash := v_session.opening_balance + v_cash_sales - v_cash_refunds + v_manual_in - v_manual_out;

  UPDATE public.cash_sessions
  SET
    status = 'closed',
    closed_by = v_actor,
    closed_at = pg_catalog.now(),
    total_cash_sales = v_cash_sales,
    total_cash_refunds = v_cash_refunds,
    total_digital_sales = v_digital_sales,
    total_digital_refunds = v_digital_refunds,
    net_digital_sales = v_net_digital_sales,
    expected_cash = v_expected_cash,
    counted_cash = p_counted_cash,
    difference = p_counted_cash - v_expected_cash,
    notes = NULLIF(btrim(p_notes), '')
  WHERE id = v_session.id
  RETURNING * INTO v_closed;

  PERFORM public.log_audit_event('cash_sessions', v_closed.id, 'CLOSE_CASH_SESSION', to_jsonb(v_session), to_jsonb(v_closed));
  RETURN v_closed;
END;
$$;

REVOKE ALL ON FUNCTION public.close_cash_session(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric, text)
  TO authenticated;
