-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 03: Mesas, Reservas, Cuentas de Mesa, Pedidos, Detalles,
--               Pagos Simulados, Caja y Auditoría + Triggers de Integridad
-- ============================================================================

-- Función defensiva para tablas inmutables (append-only)
CREATE OR REPLACE FUNCTION public.prevent_immutable_table_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_RECORD: No se permite modificar ni eliminar registros en la tabla %.', TG_TABLE_NAME;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_immutable_table_mutation() FROM PUBLIC, anon, authenticated;

-- 3.1. Inventario dinámico de mesas (D-01)
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(30) NOT NULL UNIQUE CHECK (char_length(btrim(code)) >= 1),
  zone varchar(60) NOT NULL DEFAULT 'Salón',
  capacity smallint NOT NULL CHECK (capacity >= 1),
  status varchar(25) NOT NULL DEFAULT 'disponible'
    CHECK (status IN ('disponible', 'ocupada', 'reservada', 'fuera_de_servicio')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_zone_status
  ON public.restaurant_tables (zone, status)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_restaurant_tables_updated_at ON public.restaurant_tables;
CREATE TRIGGER trg_restaurant_tables_updated_at
  BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3.2. Reservas con prevención atómica de solapamientos (D-01, D-02, D-06)
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_code varchar(30) NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  customer_name varchar(120) NOT NULL,
  customer_phone varchar(30) NOT NULL,
  party_size smallint NOT NULL CHECK (party_size >= 1),
  reservation_date date NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  duration_minutes smallint NOT NULL CHECK (duration_minutes >= 15),
  notes text,
  status varchar(20) NOT NULL DEFAULT 'Confirmada'
    CHECK (status IN ('Pendiente', 'Confirmada', 'Atendida', 'Cancelada')),
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_reservation_interval CHECK (end_at > start_at),
  CONSTRAINT excl_reservations_no_overlap
    EXCLUDE USING gist (
      table_id WITH =,
      tstzrange(start_at, end_at, '[)') WITH &&
    )
    WHERE (status IN ('Pendiente', 'Confirmada'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_date_status
  ON public.reservations (reservation_date, status);

CREATE INDEX IF NOT EXISTS idx_reservations_customer
  ON public.reservations (customer_id, start_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservations_table_window
  ON public.reservations (table_id, start_at, end_at)
  WHERE status IN ('Pendiente', 'Confirmada');

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON public.reservations;
CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3.3. Cuentas acumuladas de mesa (D-04: diferenciadas de pedidos individuales)
CREATE TABLE IF NOT EXISTS public.table_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  opened_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status varchar(25) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closing_requested', 'closed', 'cancelled')),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closing_requested_at timestamptz,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT
);

-- Máximo una cuenta abierta o en solicitud de cierre por mesa
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_accounts_one_active_per_table
  ON public.table_accounts (table_id)
  WHERE status IN ('open', 'closing_requested');

CREATE INDEX IF NOT EXISTS idx_table_accounts_status
  ON public.table_accounts (status, opened_at DESC);

-- 3.4. Pedidos (Domicilio, Recoger, Mesa)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(30) NOT NULL UNIQUE,
  client_request_id uuid UNIQUE,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  waiter_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE RESTRICT,
  table_account_id uuid REFERENCES public.table_accounts(id) ON DELETE RESTRICT,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  modality varchar(20) NOT NULL
    CHECK (modality IN ('domicilio', 'recoger', 'mesa')),
  customer_name varchar(120) NOT NULL,
  customer_email varchar(180),
  customer_phone varchar(30),
  delivery_address varchar(200),
  delivery_neighborhood varchar(100),
  delivery_directions text,
  pickup_eta time,
  notes text,
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  status varchar(25) NOT NULL DEFAULT 'Pendiente'
    CHECK (status IN (
      'Pendiente',
      'Confirmado',
      'En preparación',
      'Listo',
      'Despachado',
      'Entregado',
      'Cancelado'
    )),
  payment_status varchar(30) NOT NULL DEFAULT 'Pendiente'
    CHECK (payment_status IN (
      'Pendiente',
      'Confirmación simulada',
      'Fallido',
      'Reembolsado'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_orders_total_sum
    CHECK (total = subtotal + delivery_fee),
  CONSTRAINT chk_orders_domicilio_fields
    CHECK (
      modality <> 'domicilio'
      OR (
        delivery_address IS NOT NULL AND char_length(btrim(delivery_address)) >= 4
        AND delivery_neighborhood IS NOT NULL AND char_length(btrim(delivery_neighborhood)) >= 2
        AND table_id IS NULL
        AND table_account_id IS NULL
      )
    ),
  CONSTRAINT chk_orders_mesa_fields
    CHECK (
      modality <> 'mesa'
      OR (table_id IS NOT NULL AND table_account_id IS NOT NULL AND delivery_fee = 0)
    ),
  CONSTRAINT chk_orders_recoger_fields
    CHECK (
      modality <> 'recoger'
      OR (delivery_fee = 0 AND table_id IS NULL AND table_account_id IS NULL)
    ),
  CONSTRAINT chk_orders_reservation_only_mesa
    CHECK (reservation_id IS NULL OR modality = 'mesa'),
  CONSTRAINT chk_orders_despachado_only_domicilio
    CHECK (status <> 'Despachado' OR modality = 'domicilio')
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_modality
  ON public.orders (status, modality);

CREATE INDEX IF NOT EXISTS idx_orders_customer
  ON public.orders (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_table_account
  ON public.orders (table_account_id);

CREATE INDEX IF NOT EXISTS idx_orders_reservation
  ON public.orders (reservation_id)
  WHERE reservation_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3.5. Líneas de pedido con snapshots históricos inmutables
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name_snapshot varchar(120) NOT NULL,
  unit_price_snapshot numeric(12,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity smallint NOT NULL CHECK (quantity >= 1),
  addons_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  addons_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_total >= 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  notes varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_order_items_line_math
    CHECK (line_total = (unit_price_snapshot * quantity) + addons_total)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON public.order_items (product_id);

-- 3.6. Historial inmutable de estados de pedido
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status varchar(25),
  new_status varchar(25) NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON public.order_status_history (order_id, changed_at ASC);

DROP TRIGGER IF EXISTS trg_order_status_history_immutable ON public.order_status_history;
CREATE TRIGGER trg_order_status_history_immutable
  BEFORE UPDATE OR DELETE ON public.order_status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_immutable_table_mutation();

-- 3.7. Pagos simulados (exclusivos por pedido individual O cuenta de mesa)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  table_account_id uuid REFERENCES public.table_accounts(id) ON DELETE RESTRICT,
  method varchar(25) NOT NULL
    CHECK (method IN ('Efectivo', 'Tarjeta', 'Nequi', 'PSE')),
  status varchar(30) NOT NULL
    CHECK (status IN ('Pendiente', 'Confirmación simulada', 'Fallido', 'Reembolsado')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  transaction_ref varchar(60) NOT NULL UNIQUE,
  is_simulated boolean NOT NULL DEFAULT true CHECK (is_simulated = true),
  disclaimer text NOT NULL DEFAULT 'Pago de simulación controlada. No representa una transacción bancaria real.',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_payments_exclusive_target
    CHECK ((order_id IS NOT NULL) <> (table_account_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_confirmed_per_order
  ON public.payments (order_id)
  WHERE order_id IS NOT NULL AND status = 'Confirmación simulada';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_confirmed_per_table_account
  ON public.payments (table_account_id)
  WHERE table_account_id IS NOT NULL AND status = 'Confirmación simulada';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_order
  ON public.payments (order_id)
  WHERE order_id IS NOT NULL AND status = 'Pendiente';

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3.8. Sesiones / turnos de Caja
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status varchar(15) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  opening_balance numeric(12,2) NOT NULL CHECK (opening_balance >= 0),
  expected_cash numeric(12,2),
  counted_cash numeric(12,2) CHECK (counted_cash IS NULL OR counted_cash >= 0),
  difference numeric(12,2),
  total_cash_sales numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_cash_sales >= 0),
  total_cash_refunds numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_cash_refunds >= 0),
  total_digital_sales numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_digital_sales >= 0),
  total_digital_refunds numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_digital_refunds >= 0),
  net_digital_sales numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

-- Solo un turno de caja abierto simultáneamente
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_single_open
  ON public.cash_sessions (status)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at
  ON public.cash_sessions (opened_at DESC);

-- 3.9. Movimientos de Caja (máximo una venta y máximo un reembolso por payment_id)
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE RESTRICT,
  payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  movement_type varchar(20) NOT NULL
    CHECK (movement_type IN ('sale', 'refund', 'manual_income', 'manual_expense')),
  payment_method varchar(25) NOT NULL
    CHECK (payment_method IN ('Efectivo', 'Tarjeta', 'Nequi', 'PSE')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  concept varchar(200) NOT NULL CHECK (char_length(btrim(concept)) >= 2),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cash_movements_payment_ref_consistency
    CHECK (
      (movement_type IN ('sale', 'refund') AND payment_id IS NOT NULL)
      OR (movement_type IN ('manual_income', 'manual_expense') AND payment_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_movements_one_sale_per_payment
  ON public.cash_movements (payment_id)
  WHERE payment_id IS NOT NULL AND movement_type = 'sale';

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_movements_one_refund_per_payment
  ON public.cash_movements (payment_id)
  WHERE payment_id IS NOT NULL AND movement_type = 'refund';

CREATE INDEX IF NOT EXISTS idx_cash_movements_session
  ON public.cash_movements (cash_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_movements_payment
  ON public.cash_movements (payment_id)
  WHERE payment_id IS NOT NULL;

-- Trigger que impide registrar cualquier venta o movimiento en una sesión de caja cerrada
CREATE OR REPLACE FUNCTION public.enforce_open_cash_session_on_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_status varchar(15);
BEGIN
  SELECT cs.status INTO v_session_status
  FROM public.cash_sessions cs
  WHERE cs.id = NEW.cash_session_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASH_SESSION_NOT_FOUND: La sesión de caja indicada no existe.';
  END IF;

  IF v_session_status <> 'open' THEN
    RAISE EXCEPTION 'CASH_CLOSED: No se pueden registrar ventas ni movimientos en una sesión de caja cerrada.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_open_cash_session_on_movement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cash_movements_require_open_session ON public.cash_movements;
CREATE TRIGGER trg_cash_movements_require_open_session
  BEFORE INSERT ON public.cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_open_cash_session_on_movement();

DROP TRIGGER IF EXISTS trg_cash_movements_immutable ON public.cash_movements;
CREATE TRIGGER trg_cash_movements_immutable
  BEFORE UPDATE OR DELETE ON public.cash_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_immutable_table_mutation();

-- 3.10. Bitácora inmutable de Auditoría
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role varchar(30),
  entity_name varchar(60) NOT NULL,
  entity_id uuid,
  action varchar(60) NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_date
  ON public.audit_logs (entity_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_date
  ON public.audit_logs (actor_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_immutable_table_mutation();
