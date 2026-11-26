-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 09 (Aditiva local — Depende de Migraciones 01..08; NO aplicada en remoto):
--   - AUD-01: Validación de horarios con intervalos timestamptz completos en
--             America/Bogota (soporta horarios que cruzan medianoche y elimina
--             el desbordamiento ::time en create_reservation y get_available_reservation_slots).
--   - AUD-02 y AUD-03: Idempotencia transaccional con huella SHA-256 del payload
--             (orders.request_payload_hash) y serialización por pg_advisory_xact_lock.
--   - AUD-04: Consistencia de precios en create_order bloqueando FOR SHARE solo
--             los productos/complementos solicitados en orden determinista y
--             resolviendo snapshots en un único pase.
--   - AUD-06 y AUD-09: Trigger de integridad en restaurant_tables (capacidad vs
--             reservas futuras y bloqueo de desactivación con cuentas abiertas o
--             reservas vigentes) + RPC admin_save_restaurant_table con
--             sync_table_status y auditoría.
-- ============================================================================

-- ============================================================================
-- 1. AUD-02: Columna de huella de payload para idempotencia segura en orders
-- ============================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS request_payload_hash varchar(64);

-- ============================================================================
-- 2. AUD-01: Intervalos completos en America/Bogota (soporta cruce de medianoche)
-- ============================================================================
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
  v_open_local timestamp;
  v_close_local timestamp;
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

  v_open := NULLIF(btrim(v_day_cfg->>'open'), '')::time;
  v_close := NULLIF(btrim(v_day_cfg->>'close'), '')::time;

  IF v_open IS NULL OR v_close IS NULL OR v_open = v_close THEN
    RETURN;
  END IF;

  v_open_local := p_date + v_open;
  -- Si close < open, el turno cruza medianoche hacia el día siguiente
  v_close_local := CASE
    WHEN v_close > v_open THEN p_date + v_close
    ELSE (p_date + 1) + v_close
  END;

  IF (v_open_local + make_interval(mins => v_duration)) > v_close_local THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidate_slots AS (
    SELECT
      gs::time AS s_time,
      (gs AT TIME ZONE 'America/Bogota') AS s_start,
      ((gs + make_interval(mins => v_duration)) AT TIME ZONE 'America/Bogota') AS s_end
    FROM generate_series(
      v_open_local,
      v_close_local - make_interval(mins => v_duration),
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
  ORDER BY cs.s_start ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_reservation_slots(date, integer, varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_reservation_slots(date, integer, varchar)
  TO anon, authenticated;

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
  v_open_local timestamp;
  v_close_local timestamp;
  v_start_local timestamp;
  v_end_local timestamp;
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

  IF p_date IS NULL OR p_time IS NULL THEN
    RAISE EXCEPTION 'INVALID_SCHEDULE: La fecha y hora de reserva son obligatorias.';
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

  v_open := NULLIF(btrim(v_day_cfg->>'open'), '')::time;
  v_close := NULLIF(btrim(v_day_cfg->>'close'), '')::time;

  IF v_open IS NULL OR v_close IS NULL OR v_open = v_close THEN
    RAISE EXCEPTION 'INVALID_HOURS_CONFIG: El horario configurado para este día no es válido.';
  END IF;

  -- Construcción de ventana completa en hora local America/Bogota (sin wrap ::time)
  v_open_local := p_date + v_open;
  IF v_close > v_open THEN
    v_close_local := p_date + v_close;
    v_start_local := p_date + p_time;
  ELSE
    -- Horario que cruza medianoche (ej. 18:00 -> 02:00 del día siguiente)
    v_close_local := (p_date + 1) + v_close;
    IF p_time >= v_open THEN
      v_start_local := p_date + p_time;
    ELSIF p_time < v_close THEN
      v_start_local := (p_date + 1) + p_time;
    ELSE
      RAISE EXCEPTION 'OUT_OF_HOURS: El horario solicitado está fuera del horario de atención configurado.';
    END IF;
  END IF;

  v_end_local := v_start_local + make_interval(mins => v_duration);

  IF v_start_local < v_open_local OR v_end_local > v_close_local THEN
    RAISE EXCEPTION 'OUT_OF_HOURS: El horario solicitado (incluyendo la duración de % min) excede el horario de atención configurado.', v_duration;
  END IF;

  v_start := v_start_local AT TIME ZONE 'America/Bogota';
  v_end := v_end_local AT TIME ZONE 'America/Bogota';

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

-- ============================================================================
-- 3. AUD-02, AUD-03 y AUD-04: create_order con idempotencia por huella SHA-256,
--    serialización transaccional y consistencia de precios en un solo pase
-- ============================================================================
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
  v_canonical_items jsonb;
  v_payload_hash varchar(64);
  v_settings public.restaurant_settings%ROWTYPE;
  v_reservation public.reservations%ROWTYPE;
  v_effective_table_id uuid := p_table_id;
  v_table public.restaurant_tables%ROWTYPE;
  v_account_id uuid;
  v_open_cash_session public.cash_sessions%ROWTYPE;
  v_item jsonb;
  v_resolved_items jsonb := '[]'::jsonb;
  v_resolved_line jsonb;
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

  -- 3. Cálculo de huella determinista del contenido (sin datos sensibles) y
  --    serialización transaccional de reintentos concurrentes (AUD-02, AUD-03)
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_id', lower(COALESCE(elem->>'product_id', '')),
          'quantity', COALESCE(elem->>'quantity', ''),
          'addon_ids', COALESCE(
            (
              SELECT jsonb_agg(lower(a) ORDER BY lower(a))
              FROM jsonb_array_elements_text(
                CASE WHEN jsonb_typeof(elem->'addon_ids') = 'array' THEN elem->'addon_ids' ELSE '[]'::jsonb END
              ) AS t(a)
            ),
            '[]'::jsonb
          ),
          'notes', COALESCE(NULLIF(left(btrim(COALESCE(elem->>'notes', '')), 200), ''), '')
        )
        ORDER BY lower(COALESCE(elem->>'product_id', '')), COALESCE(elem->>'quantity', '')
      ),
      '[]'::jsonb
    )
    INTO v_canonical_items
    FROM jsonb_array_elements(p_items) AS elem;
  ELSE
    v_canonical_items := '[]'::jsonb;
  END IF;

  -- AUD811-01: Usar pg_catalog.sha256 nativo de PostgreSQL 14+ sobre bytes UTF-8
  -- del mismo JSON canónico (no depende de si pgcrypto reside en public o extensions).
  v_payload_hash := encode(
    pg_catalog.sha256(
      convert_to(
        jsonb_build_object(
          'actor', v_actor,
          'modality', COALESCE(p_modality, ''),
          'payment_method', COALESCE(p_payment_method, ''),
          'delivery_address', COALESCE(NULLIF(btrim(p_delivery_address), ''), ''),
          'delivery_neighborhood', COALESCE(NULLIF(btrim(p_delivery_neighborhood), ''), ''),
          'delivery_directions', COALESCE(NULLIF(btrim(p_delivery_directions), ''), ''),
          'pickup_eta', COALESCE(p_pickup_eta::text, ''),
          'table_id', COALESCE(p_table_id::text, ''),
          'reservation_id', COALESCE(p_reservation_id::text, ''),
          'notes', COALESCE(NULLIF(btrim(p_notes), ''), ''),
          'items', v_canonical_items
        )::text,
        'UTF8'
      )
    ),
    'hex'
  );

  IF p_client_request_id IS NOT NULL THEN
    -- Serializa solicitudes simultáneas con la misma clave idempotente
    PERFORM pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0));

    SELECT * INTO v_existing
    FROM public.orders o
    WHERE o.client_request_id = p_client_request_id;

    IF FOUND THEN
      IF NOT (
        v_existing.customer_id IS NOT DISTINCT FROM v_actor
        OR v_existing.waiter_id IS NOT DISTINCT FROM v_actor
        OR v_role = 'administrador'
      ) THEN
        RAISE EXCEPTION 'DUPLICATE_REQUEST_ID: El identificador de solicitud ya fue utilizado.';
      END IF;

      IF v_existing.request_payload_hash IS NOT NULL
         AND v_existing.request_payload_hash <> v_payload_hash THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: La clave de solicitud ya fue utilizada con un contenido diferente.';
      END IF;

      RETURN v_existing;
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
    v_payment_status := 'Pendiente';
  ELSIF p_simulate_payment_failure THEN
    RAISE EXCEPTION 'PAYMENT_SIMULATION_FAILED: La simulación de pago fue rechazada. No se generó cobro.';
  ELSIF p_payment_method = 'Efectivo' THEN
    v_payment_status := 'Pendiente';
  ELSIF p_payment_method IN ('Tarjeta', 'Nequi', 'PSE') THEN
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

  -- 6. AUD-04: Bloqueo compartido (FOR SHARE) en orden determinista SOLO sobre
  --    los productos y complementos involucrados, y resolución en un único pase
  PERFORM 1
  FROM public.products pr
  WHERE pr.id IN (
    SELECT (elem->>'product_id')::uuid
    FROM jsonb_array_elements(p_items) AS elem
    WHERE elem ? 'product_id' AND NULLIF(btrim(elem->>'product_id'), '') IS NOT NULL
    UNION
    SELECT (addon_val)::uuid
    FROM jsonb_array_elements(p_items) AS elem,
         LATERAL jsonb_array_elements_text(
           CASE WHEN jsonb_typeof(elem->'addon_ids') = 'array' THEN elem->'addon_ids' ELSE '[]'::jsonb END
         ) AS t(addon_val)
  )
  ORDER BY pr.id
  FOR SHARE;

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

    v_addons_json := '[]'::jsonb;
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
    v_subtotal := v_subtotal + v_line_total;

    v_resolved_items := v_resolved_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'unit_price', v_product.price,
        'quantity', v_qty,
        'addons_snapshot', v_addons_json,
        'addons_total', v_addons_line_total,
        'line_total', v_line_total,
        'notes', NULLIF(left(btrim(COALESCE(v_item->>'notes', '')), 200), '')
      )
    );
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;
  v_order_number := 'FB-' || to_char(pg_catalog.now() AT TIME ZONE 'America/Bogota', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- 7. Insertar encabezado de pedido con huella de idempotencia
  INSERT INTO public.orders (
    order_number,
    client_request_id,
    request_payload_hash,
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
    v_payload_hash,
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

  -- 8. Insertar snapshots inmutables en order_items desde el pase único ya resuelto
  FOR v_resolved_line IN SELECT * FROM jsonb_array_elements(v_resolved_items)
  LOOP
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
      (v_resolved_line->>'product_id')::uuid,
      v_resolved_line->>'product_name',
      (v_resolved_line->>'unit_price')::numeric(12,2),
      (v_resolved_line->>'quantity')::smallint,
      v_resolved_line->'addons_snapshot',
      (v_resolved_line->>'addons_total')::numeric(12,2),
      (v_resolved_line->>'line_total')::numeric(12,2),
      NULLIF(v_resolved_line->>'notes', '')
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

-- ============================================================================
-- 4. AUD-06 y AUD-09: Integridad de restaurant_tables en PostgreSQL + RPC
--    administrativa con resincronización de estado operativo y auditoría
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_restaurant_table_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conflict_party smallint;
  v_active_res_count integer;
  v_open_acc_count integer;
BEGIN
  -- 4.1. Impedir reducción de capacidad por debajo de reservas futuras vigentes
  IF NEW.capacity < OLD.capacity THEN
    SELECT MAX(r.party_size) INTO v_conflict_party
    FROM public.reservations r
    WHERE r.table_id = OLD.id
      AND r.status IN ('Pendiente', 'Confirmada')
      AND r.end_at > pg_catalog.now()
      AND r.party_size > NEW.capacity;

    IF v_conflict_party IS NOT NULL THEN
      RAISE EXCEPTION 'TABLE_CAPACITY_CONFLICT: No se puede reducir la capacidad de la mesa % a % porque existen reservas futuras vigentes para % personas.',
        OLD.code, NEW.capacity, v_conflict_party;
    END IF;
  END IF;

  -- 4.2. Impedir desactivación / fuera_de_servicio con cuentas abiertas o reservas futuras vigentes
  IF (NEW.is_active = false AND OLD.is_active = true)
     OR (NEW.status = 'fuera_de_servicio' AND OLD.status <> 'fuera_de_servicio') THEN

    SELECT count(*) INTO v_open_acc_count
    FROM public.table_accounts ta
    WHERE ta.table_id = OLD.id
      AND ta.status IN ('open', 'closing_requested');

    IF v_open_acc_count > 0 THEN
      RAISE EXCEPTION 'TABLE_HAS_OPEN_ACCOUNT: No se puede desactivar la mesa % mientras tenga una cuenta de mesa abierta o en cierre.',
        OLD.code;
    END IF;

    SELECT count(*) INTO v_active_res_count
    FROM public.reservations r
    WHERE r.table_id = OLD.id
      AND r.status IN ('Pendiente', 'Confirmada')
      AND r.end_at > pg_catalog.now();

    IF v_active_res_count > 0 THEN
      RAISE EXCEPTION 'TABLE_HAS_ACTIVE_RESERVATIONS: No se puede desactivar la mesa % porque tiene % reserva(s) futura(s) vigente(s). Reasigna o cancela esas reservas primero.',
        OLD.code, v_active_res_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_restaurant_table_integrity()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protect_restaurant_table_integrity ON public.restaurant_tables;
CREATE TRIGGER trg_protect_restaurant_table_integrity
  BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_restaurant_table_integrity();

-- RPC administrativa para crear/editar/reactivar/desactivar mesas con sincronización real
CREATE OR REPLACE FUNCTION public.admin_save_restaurant_table(
  p_table_id uuid DEFAULT NULL,
  p_code varchar DEFAULT NULL,
  p_zone varchar DEFAULT 'Salón',
  p_capacity smallint DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS public.restaurant_tables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old public.restaurant_tables%ROWTYPE;
  v_saved public.restaurant_tables%ROWTYPE;
  v_next_status varchar(25);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede configurar el inventario de mesas.';
  END IF;

  IF NULLIF(btrim(p_code), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_CODE: El código de mesa es obligatorio.';
  END IF;

  IF p_capacity IS NULL OR p_capacity < 1 THEN
    RAISE EXCEPTION 'INVALID_CAPACITY: La capacidad mínima de una mesa es 1 persona.';
  END IF;

  IF p_table_id IS NULL THEN
    INSERT INTO public.restaurant_tables (code, zone, capacity, is_active, status)
    VALUES (
      btrim(p_code),
      COALESCE(NULLIF(btrim(p_zone), ''), 'Salón'),
      p_capacity,
      COALESCE(p_is_active, true),
      CASE WHEN COALESCE(p_is_active, true) THEN 'disponible' ELSE 'fuera_de_servicio' END
    )
    RETURNING * INTO v_saved;

    PERFORM public.log_audit_event('restaurant_tables', v_saved.id, 'ADMIN_CREATE_TABLE', NULL, to_jsonb(v_saved));
    RETURN v_saved;
  END IF;

  SELECT * INTO v_old
  FROM public.restaurant_tables t
  WHERE t.id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TABLE_NOT_FOUND: La mesa indicada no existe.';
  END IF;

  -- Al reactivar (is_active: false -> true), despejar fuera_de_servicio para que
  -- sync_table_status determine el estado operativo real sin sobrescribir ocupada/reservada.
  v_next_status := CASE
    WHEN COALESCE(p_is_active, true) = false THEN 'fuera_de_servicio'
    WHEN v_old.status = 'fuera_de_servicio' THEN 'disponible'
    ELSE v_old.status
  END;

  UPDATE public.restaurant_tables
  SET
    code = btrim(p_code),
    zone = COALESCE(NULLIF(btrim(p_zone), ''), zone),
    capacity = p_capacity,
    is_active = COALESCE(p_is_active, true),
    status = v_next_status
  WHERE id = p_table_id
  RETURNING * INTO v_saved;

  PERFORM public.sync_table_status(v_saved.id);

  SELECT * INTO v_saved
  FROM public.restaurant_tables t
  WHERE t.id = p_table_id;

  PERFORM public.log_audit_event('restaurant_tables', v_saved.id, 'ADMIN_UPDATE_TABLE', to_jsonb(v_old), to_jsonb(v_saved));
  RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_restaurant_table(uuid, varchar, varchar, smallint, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_restaurant_table(uuid, varchar, varchar, smallint, boolean)
  TO authenticated;
