-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 11 (Aditiva local — Depende de Migraciones 01..10; NO aplicada en remoto):
--   - AUD811-02: RPC transaccional `admin_save_product` para crear/actualizar
--             productos y sincronizar `product_complements` en una única transacción
--             con validación de complementos, rollback total y auditoría.
--   - AUD811-04: RPC agregada `get_admin_reports_summary` en PostgreSQL para
--             reportes financieros y operativos en `America/Bogota` con 7 filtros,
--             cero truncamiento por límite de filas y cero duplicación por joins.
--   - AUD811-06: RPC de privilegio mínimo `get_salon_staff_directory` que expone
--             únicamente id, nombre visible y mesas activas a mesero/admin (sin PII).
--   - AUD811-07: Validación transaccional de monto recibido en efectivo
--             (`p_received_amount`) en `settle_table_account` y `confirm_order_payment`.
-- ============================================================================

-- ============================================================================
-- 1. AUD811-02: Guardado atómico de producto y sincronización de complementos
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_save_product(
  p_product_id uuid DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_name varchar DEFAULT NULL,
  p_slug varchar DEFAULT NULL,
  p_description text DEFAULT '',
  p_ingredients text DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_tag varchar DEFAULT NULL,
  p_is_addon boolean DEFAULT false,
  p_is_available boolean DEFAULT true,
  p_complement_ids uuid[] DEFAULT NULL,
  p_sync_complements boolean DEFAULT false
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_saved public.products%ROWTYPE;
  v_clean_name varchar(120) := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_clean_slug varchar(100) := NULLIF(btrim(lower(COALESCE(p_slug, ''))), '');
  v_cid uuid;
  v_addon public.products%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede gestionar productos y complementos.';
  END IF;

  IF v_clean_name IS NULL OR char_length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'INVALID_PRODUCT_NAME: El nombre del producto debe tener al menos 2 caracteres.';
  END IF;

  IF v_clean_slug IS NULL OR v_clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'INVALID_PRODUCT_SLUG: El identificador (slug) del producto no es válido.';
  END IF;

  IF p_category_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p_category_id) THEN
    RAISE EXCEPTION 'CATEGORY_NOT_FOUND: La categoría seleccionada no existe.';
  END IF;

  IF p_price IS NULL OR p_price < 0 OR round(p_price, 2) <> p_price THEN
    RAISE EXCEPTION 'INVALID_PRICE: El precio debe ser mayor o igual a 0 con precisión monetaria válida.';
  END IF;

  IF p_product_id IS NULL THEN
    INSERT INTO public.products (
      category_id,
      slug,
      name,
      description,
      ingredients,
      price,
      image_url,
      tag,
      is_addon,
      is_available
    )
    VALUES (
      p_category_id,
      v_clean_slug,
      v_clean_name,
      COALESCE(btrim(p_description), ''),
      NULLIF(btrim(COALESCE(p_ingredients, '')), ''),
      p_price,
      NULLIF(btrim(COALESCE(p_image_url, '')), ''),
      NULLIF(btrim(COALESCE(p_tag, '')), ''),
      COALESCE(p_is_addon, false),
      COALESCE(p_is_available, true)
    )
    RETURNING * INTO v_saved;
  ELSE
    UPDATE public.products
    SET
      category_id = p_category_id,
      slug = v_clean_slug,
      name = v_clean_name,
      description = COALESCE(btrim(p_description), ''),
      ingredients = NULLIF(btrim(COALESCE(p_ingredients, '')), ''),
      price = p_price,
      image_url = NULLIF(btrim(COALESCE(p_image_url, '')), ''),
      tag = NULLIF(btrim(COALESCE(p_tag, '')), ''),
      is_addon = COALESCE(p_is_addon, false),
      is_available = COALESCE(p_is_available, true)
    WHERE id = p_product_id
    RETURNING * INTO v_saved;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND: El producto indicado no existe.';
    END IF;
  END IF;

  -- Sincronización atómica de product_complements (rollback completo si algún complemento es inválido)
  IF COALESCE(p_sync_complements, false) THEN
    DELETE FROM public.product_complements
    WHERE product_id = v_saved.id;

    IF COALESCE(p_is_addon, false) = false AND p_complement_ids IS NOT NULL AND cardinality(p_complement_ids) > 0 THEN
      FOR v_cid IN
        SELECT DISTINCT u.cid
        FROM unnest(p_complement_ids) AS u(cid)
        WHERE u.cid IS NOT NULL
      LOOP
        IF v_cid = v_saved.id THEN
          RAISE EXCEPTION 'INVALID_COMPLEMENT_SELF: Un producto no puede ser complemento de sí mismo.';
        END IF;

        SELECT * INTO v_addon
        FROM public.products pr
        WHERE pr.id = v_cid
          AND pr.is_addon = true;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'INVALID_COMPLEMENT: El complemento % no existe o no está marcado como adición.', v_cid;
        END IF;

        INSERT INTO public.product_complements (product_id, complement_id)
        VALUES (v_saved.id, v_cid);
      END LOOP;
    END IF;

    PERFORM public.log_audit_event(
      'product_complements',
      v_saved.id,
      'ADMIN_SYNC_PRODUCT_COMPLEMENTS',
      NULL,
      jsonb_build_object(
        'product_id', v_saved.id,
        'complement_ids', COALESCE(to_jsonb(p_complement_ids), '[]'::jsonb)
      )
    );
  END IF;

  RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_product(uuid, uuid, varchar, varchar, text, text, numeric, text, varchar, boolean, boolean, uuid[], boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_product(uuid, uuid, varchar, varchar, text, text, numeric, text, varchar, boolean, boolean, uuid[], boolean)
  TO authenticated;

-- ============================================================================
-- 2. AUD811-06: Directorio operativo mínimo de personal de salón (sin PII)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_salon_staff_directory()
RETURNS TABLE (
  staff_id uuid,
  visible_name varchar,
  role_code varchar,
  active_table_codes text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.is_waiter() OR public.is_admin()) THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Acceso restringido al personal operativo autorizado.';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS staff_id,
    p.full_name AS visible_name,
    r.code AS role_code,
    COALESCE(
      ARRAY(
        SELECT DISTINCT rt.code::text
        FROM public.table_accounts ta
        JOIN public.restaurant_tables rt ON rt.id = ta.table_id
        WHERE ta.opened_by = p.id
          AND ta.status IN ('open', 'closing_requested')
        ORDER BY rt.code::text
      ),
      ARRAY[]::text[]
    ) AS active_table_codes
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.is_active = true
    AND r.code IN ('mesero', 'administrador')
  ORDER BY p.full_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_salon_staff_directory()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_salon_staff_directory()
  TO authenticated;

-- ============================================================================
-- 3. AUD811-07: Validación transaccional de efectivo recibido en cobros
-- ============================================================================
DROP FUNCTION IF EXISTS public.confirm_order_payment(uuid, varchar);

CREATE OR REPLACE FUNCTION public.confirm_order_payment(
  p_order_id uuid,
  p_payment_method varchar DEFAULT NULL,
  p_received_amount numeric DEFAULT NULL
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

  -- AUD811-07: Validar monto recibido en efectivo vs medios digitales
  IF p_received_amount IS NOT NULL THEN
    IF v_final_method <> 'Efectivo' THEN
      RAISE EXCEPTION 'RECEIVED_AMOUNT_ONLY_FOR_CASH: El monto recibido en efectivo no aplica para medios digitales (%).', v_final_method;
    END IF;
    IF p_received_amount < 0 OR round(p_received_amount, 2) <> p_received_amount THEN
      RAISE EXCEPTION 'INVALID_RECEIVED_AMOUNT: El importe recibido no tiene una precisión monetaria válida.';
    END IF;
    IF p_received_amount < v_order.total THEN
      RAISE EXCEPTION 'INSUFFICIENT_CASH_RECEIVED: El efectivo recibido (%) es inferior al saldo pendiente (%).',
        p_received_amount, v_order.total;
    END IF;
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

  PERFORM public.log_audit_event(
    'payments',
    v_payment.id,
    'CONFIRM_ORDER_PAYMENT',
    NULL,
    jsonb_build_object(
      'payment', to_jsonb(v_payment),
      'received_amount', p_received_amount,
      'change_amount', CASE WHEN p_received_amount IS NOT NULL THEN p_received_amount - v_order.total ELSE NULL END
    )
  );
  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid, varchar, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, varchar, numeric)
  TO authenticated;

DROP FUNCTION IF EXISTS public.settle_table_account(uuid, varchar);

CREATE OR REPLACE FUNCTION public.settle_table_account(
  p_table_account_id uuid,
  p_payment_method varchar,
  p_received_amount numeric DEFAULT NULL
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

  -- AUD811-07: Validar monto recibido en efectivo vs medios digitales
  IF p_received_amount IS NOT NULL THEN
    IF p_payment_method <> 'Efectivo' THEN
      RAISE EXCEPTION 'RECEIVED_AMOUNT_ONLY_FOR_CASH: El monto recibido en efectivo no aplica para medios digitales (%).', p_payment_method;
    END IF;
    IF p_received_amount < 0 OR round(p_received_amount, 2) <> p_received_amount THEN
      RAISE EXCEPTION 'INVALID_RECEIVED_AMOUNT: El importe recibido no tiene una precisión monetaria válida.';
    END IF;
    IF p_received_amount < v_acc.total_amount THEN
      RAISE EXCEPTION 'INSUFFICIENT_CASH_RECEIVED: El efectivo recibido (%) es inferior al saldo pendiente de la cuenta (%).',
        p_received_amount, v_acc.total_amount;
    END IF;
  END IF;

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

  PERFORM public.sync_table_status(v_acc.table_id);

  PERFORM public.log_audit_event(
    'table_accounts',
    v_acc.id,
    'SETTLE_TABLE_ACCOUNT',
    NULL,
    jsonb_build_object(
      'account', to_jsonb(v_acc),
      'received_amount', p_received_amount,
      'change_amount', CASE WHEN p_received_amount IS NOT NULL THEN p_received_amount - v_acc.total_amount ELSE NULL END
    )
  );
  RETURN v_acc;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_table_account(uuid, varchar, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_table_account(uuid, varchar, numeric)
  TO authenticated;

-- ============================================================================
-- 4. AUD811-04: Reportes financieros y operativos agregados en PostgreSQL
--    (sin límite de 1.000/3.000 filas, sin duplicación por joins, zona America/Bogota)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_reports_summary(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_status varchar DEFAULT NULL,
  p_modality varchar DEFAULT NULL,
  p_payment_method varchar DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_status varchar := NULLIF(btrim(COALESCE(p_status, '')), '');
  v_clean_mod varchar := NULLIF(btrim(COALESCE(p_modality, '')), '');
  v_clean_method varchar := NULLIF(btrim(COALESCE(p_payment_method, '')), '');
  v_sales jsonb;
  v_sales_by_day jsonb;
  v_payments jsonb;
  v_cash_movs jsonb;
  v_top_products jsonb;
  v_by_category jsonb;
  v_orders_by_status jsonb;
  v_orders_by_modality jsonb;
  v_res_count integer;
  v_tables_used integer;
  v_open_acc integer;
  v_closed_acc integer;
  v_sessions jsonb;
  v_total_diff numeric(12,2);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Solo el administrador puede consultar los reportes financieros y operativos.';
  END IF;

  IF v_clean_status = 'all' THEN v_clean_status := NULL; END IF;
  IF v_clean_mod = 'all' THEN v_clean_mod := NULL; END IF;
  IF v_clean_method = 'all' THEN v_clean_method := NULL; END IF;

  -- 1. Agregación de pedidos (sin joins a order_items ni payments para evitar multiplicar importes)
  WITH filtered_orders AS (
    SELECT o.*
    FROM public.orders o
    WHERE (p_date_from IS NULL OR (o.created_at AT TIME ZONE 'America/Bogota')::date >= p_date_from)
      AND (p_date_to IS NULL OR (o.created_at AT TIME ZONE 'America/Bogota')::date <= p_date_to)
      AND (v_clean_status IS NULL OR o.status = v_clean_status)
      AND (v_clean_mod IS NULL OR o.modality = v_clean_mod)
      AND (
        p_product_id IS NULL
        OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.product_id = p_product_id)
      )
      AND (
        p_category_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.order_items oi
          JOIN public.products pr ON pr.id = oi.product_id
          WHERE oi.order_id = o.id AND pr.category_id = p_category_id
        )
      )
      AND (
        v_clean_method IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.payments py
          WHERE (py.order_id = o.id OR (o.table_account_id IS NOT NULL AND py.table_account_id = o.table_account_id))
            AND py.method = v_clean_method
        )
      )
  )
  SELECT
    jsonb_build_object(
      'totalOrders', count(*),
      'validOrdersCount', count(*) FILTER (WHERE status <> 'Cancelado'),
      'cancelledOrdersCount', count(*) FILTER (WHERE status = 'Cancelado'),
      'totalSales', COALESCE(SUM(total) FILTER (WHERE status <> 'Cancelado'), 0),
      'avgTicket', CASE
        WHEN count(*) FILTER (WHERE status <> 'Cancelado') > 0
          THEN round(COALESCE(SUM(total) FILTER (WHERE status <> 'Cancelado'), 0) / (count(*) FILTER (WHERE status <> 'Cancelado')))
        ELSE 0
      END
    ),
    COALESCE(
      (
        SELECT jsonb_agg(day_row ORDER BY day_row->>'date' ASC)
        FROM (
          SELECT jsonb_build_object(
            'date', to_char((fo.created_at AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD'),
            'ordersCount', count(*),
            'total', COALESCE(SUM(fo.total), 0)
          ) AS day_row
          FROM filtered_orders fo
          WHERE fo.status <> 'Cancelado'
          GROUP BY (fo.created_at AT TIME ZONE 'America/Bogota')::date
        ) d
      ),
      '[]'::jsonb
    ),
    COALESCE(
      (
        SELECT jsonb_object_agg(st, cnt)
        FROM (
          SELECT fo.status AS st, count(*) AS cnt
          FROM filtered_orders fo
          GROUP BY fo.status
        ) s
      ),
      '{}'::jsonb
    ),
    jsonb_build_object(
      'domicilio', count(*) FILTER (WHERE modality = 'domicilio'),
      'recoger', count(*) FILTER (WHERE modality = 'recoger'),
      'mesa', count(*) FILTER (WHERE modality = 'mesa')
    ),
    count(DISTINCT table_id) FILTER (WHERE table_id IS NOT NULL AND status <> 'Cancelado')
  INTO v_sales, v_sales_by_day, v_orders_by_status, v_orders_by_modality, v_tables_used
  FROM filtered_orders;

  v_sales := v_sales || jsonb_build_object('salesByDay', v_sales_by_day);

  -- 2. Agregación independiente de pagos recibidos vs reembolsos (sin joins con líneas)
  SELECT jsonb_build_object(
    'totalPaid', COALESCE(SUM(py.amount) FILTER (WHERE py.status = 'Confirmación simulada'), 0),
    'count', count(*) FILTER (WHERE py.status = 'Confirmación simulada'),
    'refundedTotal', COALESCE(SUM(py.amount) FILTER (WHERE py.status = 'Reembolsado'), 0),
    'refundedCount', count(*) FILTER (WHERE py.status = 'Reembolsado'),
    'byMethod', jsonb_build_object(
      'Efectivo', COALESCE(SUM(py.amount) FILTER (WHERE py.status = 'Confirmación simulada' AND py.method = 'Efectivo'), 0),
      'Tarjeta', COALESCE(SUM(py.amount) FILTER (WHERE py.status = 'Confirmación simulada' AND py.method = 'Tarjeta'), 0),
      'Nequi', COALESCE(SUM(py.amount) FILTER (WHERE py.status = 'Confirmación simulada' AND py.method = 'Nequi'), 0),
      'PSE', COALESCE(SUM(py.amount) FILTER (WHERE py.status = 'Confirmación simulada' AND py.method = 'PSE'), 0)
    )
  )
  INTO v_payments
  FROM public.payments py
  WHERE (p_date_from IS NULL OR (COALESCE(py.paid_at, py.created_at) AT TIME ZONE 'America/Bogota')::date >= p_date_from)
    AND (p_date_to IS NULL OR (COALESCE(py.paid_at, py.created_at) AT TIME ZONE 'America/Bogota')::date <= p_date_to)
    AND (v_clean_method IS NULL OR py.method = v_clean_method);

  -- 3. Ingresos, egresos y reembolsos contables en cash_movements
  SELECT jsonb_build_object(
    'manualIncomeTotal', COALESCE(SUM(cm.amount) FILTER (WHERE cm.movement_type = 'manual_income'), 0),
    'manualExpenseTotal', COALESCE(SUM(cm.amount) FILTER (WHERE cm.movement_type = 'manual_expense'), 0),
    'refundMovementsTotal', COALESCE(SUM(cm.amount) FILTER (WHERE cm.movement_type = 'refund'), 0)
  )
  INTO v_cash_movs
  FROM public.cash_movements cm
  WHERE (p_date_from IS NULL OR (cm.created_at AT TIME ZONE 'America/Bogota')::date >= p_date_from)
    AND (p_date_to IS NULL OR (cm.created_at AT TIME ZONE 'America/Bogota')::date <= p_date_to)
    AND (v_clean_method IS NULL OR cm.payment_method = v_clean_method);

  -- 4. Rendimiento de productos y categorías (solo pedidos válidos no cancelados)
  SELECT COALESCE(
    jsonb_agg(prod_row ORDER BY (prod_row->>'revenue')::numeric DESC, prod_row->>'name' ASC),
    '[]'::jsonb
  )
  INTO v_top_products
  FROM (
    SELECT jsonb_build_object(
      'productId', oi.product_id,
      'name', MAX(oi.product_name_snapshot),
      'quantity', COALESCE(SUM(oi.quantity), 0),
      'revenue', COALESCE(SUM(oi.line_total), 0)
    ) AS prod_row
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.products pr ON pr.id = oi.product_id
    WHERE o.status <> 'Cancelado'
      AND (p_date_from IS NULL OR (o.created_at AT TIME ZONE 'America/Bogota')::date >= p_date_from)
      AND (p_date_to IS NULL OR (o.created_at AT TIME ZONE 'America/Bogota')::date <= p_date_to)
      AND (v_clean_status IS NULL OR o.status = v_clean_status)
      AND (v_clean_mod IS NULL OR o.modality = v_clean_mod)
      AND (p_category_id IS NULL OR pr.category_id = p_category_id)
      AND (p_product_id IS NULL OR oi.product_id = p_product_id)
    GROUP BY oi.product_id
  ) p;

  SELECT COALESCE(
    jsonb_agg(cat_row ORDER BY (cat_row->>'revenue')::numeric DESC),
    '[]'::jsonb
  )
  INTO v_by_category
  FROM (
    SELECT jsonb_build_object(
      'category', COALESCE(c.name, 'Sin categoría'),
      'quantity', COALESCE(SUM(oi.quantity), 0),
      'revenue', COALESCE(SUM(oi.line_total), 0)
    ) AS cat_row
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.products pr ON pr.id = oi.product_id
    LEFT JOIN public.categories c ON c.id = pr.category_id
    WHERE o.status <> 'Cancelado'
      AND (p_date_from IS NULL OR (o.created_at AT TIME ZONE 'America/Bogota')::date >= p_date_from)
      AND (p_date_to IS NULL OR (o.created_at AT TIME ZONE 'America/Bogota')::date <= p_date_to)
      AND (v_clean_status IS NULL OR o.status = v_clean_status)
      AND (v_clean_mod IS NULL OR o.modality = v_clean_mod)
      AND (p_category_id IS NULL OR pr.category_id = p_category_id)
      AND (p_product_id IS NULL OR oi.product_id = p_product_id)
    GROUP BY COALESCE(c.name, 'Sin categoría')
  ) cg;

  -- 5. Reservas, cuentas y sesiones de caja
  SELECT count(*) INTO v_res_count
  FROM public.reservations r
  WHERE (p_date_from IS NULL OR r.reservation_date >= p_date_from)
    AND (p_date_to IS NULL OR r.reservation_date <= p_date_to);

  SELECT
    count(*) FILTER (WHERE status IN ('open', 'closing_requested')),
    count(*) FILTER (WHERE status = 'closed')
  INTO v_open_acc, v_closed_acc
  FROM public.table_accounts ta
  WHERE (p_date_from IS NULL OR (ta.opened_at AT TIME ZONE 'America/Bogota')::date >= p_date_from)
    AND (p_date_to IS NULL OR (ta.opened_at AT TIME ZONE 'America/Bogota')::date <= p_date_to);

  SELECT
    COALESCE(jsonb_agg(to_jsonb(cs) ORDER BY cs.opened_at DESC), '[]'::jsonb),
    COALESCE(SUM(cs.difference), 0)
  INTO v_sessions, v_total_diff
  FROM public.cash_sessions cs
  WHERE (p_date_from IS NULL OR (cs.opened_at AT TIME ZONE 'America/Bogota')::date >= p_date_from)
    AND (p_date_to IS NULL OR (cs.opened_at AT TIME ZONE 'America/Bogota')::date <= p_date_to);

  RETURN jsonb_build_object(
    'sales', v_sales,
    'payments', v_payments,
    'cashMovements', v_cash_movs,
    'products', jsonb_build_object(
      'topProducts', v_top_products,
      'byCategory', v_by_category
    ),
    'operation', jsonb_build_object(
      'ordersByStatus', v_orders_by_status,
      'ordersByModality', v_orders_by_modality,
      'reservationsCount', v_res_count,
      'tablesUsedCount', v_tables_used,
      'openAccountsCount', v_open_acc,
      'closedAccountsCount', v_closed_acc
    ),
    'cash', jsonb_build_object(
      'sessions', v_sessions,
      'totalDifference', v_total_diff
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_reports_summary(date, date, varchar, varchar, varchar, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_reports_summary(date, date, varchar, varchar, varchar, uuid, uuid)
  TO authenticated;
