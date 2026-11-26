-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 04: Row Level Security (RLS), Storage Bucket y Realtime
-- ============================================================================

-- 1. Habilitar RLS obligatoriamente en las 19 tablas públicas
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_complements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Políticas RLS — Dominio Identidad, Roles y Perfiles
-- ============================================================================

-- roles: lectura solo autenticados; sin escritura directa
DROP POLICY IF EXISTS roles_select_authenticated ON public.roles;
CREATE POLICY roles_select_authenticated
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

-- permissions & role_permissions: consulta exclusiva de administrador
DROP POLICY IF EXISTS permissions_select_admin ON public.permissions;
CREATE POLICY permissions_select_admin
  ON public.permissions FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS role_permissions_select_admin ON public.role_permissions;
CREATE POLICY role_permissions_select_admin
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- profiles: lectura y actualización propia (protegida por trigger anti-escalamiento) o admin
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_own_or_admin
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;
CREATE POLICY profiles_update_own_or_admin
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- customer_addresses: CRUD exclusivo del propietario o administrador
DROP POLICY IF EXISTS customer_addresses_select_own_or_admin ON public.customer_addresses;
CREATE POLICY customer_addresses_select_own_or_admin
  ON public.customer_addresses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS customer_addresses_insert_own ON public.customer_addresses;
CREATE POLICY customer_addresses_insert_own
  ON public.customer_addresses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS customer_addresses_update_own ON public.customer_addresses;
CREATE POLICY customer_addresses_update_own
  ON public.customer_addresses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS customer_addresses_delete_own ON public.customer_addresses;
CREATE POLICY customer_addresses_delete_own
  ON public.customer_addresses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 3. Políticas RLS — Dominio Catálogo y Configuración (separando SELECT de escritura)
-- ============================================================================

-- categories
DROP POLICY IF EXISTS categories_select_public ON public.categories;
CREATE POLICY categories_select_public
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS categories_admin_write ON public.categories;
DROP POLICY IF EXISTS categories_admin_insert ON public.categories;
CREATE POLICY categories_admin_insert
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS categories_admin_update ON public.categories;
CREATE POLICY categories_admin_update
  ON public.categories FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS categories_admin_delete ON public.categories;
CREATE POLICY categories_admin_delete
  ON public.categories FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- products
DROP POLICY IF EXISTS products_select_public ON public.products;
CREATE POLICY products_select_public
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (is_available = true OR public.is_admin());

DROP POLICY IF EXISTS products_admin_write ON public.products;
DROP POLICY IF EXISTS products_admin_insert ON public.products;
CREATE POLICY products_admin_insert
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS products_admin_update ON public.products;
CREATE POLICY products_admin_update
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS products_admin_delete ON public.products;
CREATE POLICY products_admin_delete
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- product_complements
DROP POLICY IF EXISTS product_complements_select_public ON public.product_complements;
CREATE POLICY product_complements_select_public
  ON public.product_complements FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS product_complements_admin_write ON public.product_complements;
DROP POLICY IF EXISTS product_complements_admin_insert ON public.product_complements;
CREATE POLICY product_complements_admin_insert
  ON public.product_complements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS product_complements_admin_update ON public.product_complements;
CREATE POLICY product_complements_admin_update
  ON public.product_complements FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS product_complements_admin_delete ON public.product_complements;
CREATE POLICY product_complements_admin_delete
  ON public.product_complements FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- restaurant_settings
DROP POLICY IF EXISTS restaurant_settings_select_public ON public.restaurant_settings;
CREATE POLICY restaurant_settings_select_public
  ON public.restaurant_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS restaurant_settings_admin_insert ON public.restaurant_settings;
CREATE POLICY restaurant_settings_admin_insert
  ON public.restaurant_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS restaurant_settings_admin_update ON public.restaurant_settings;
CREATE POLICY restaurant_settings_admin_update
  ON public.restaurant_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. Políticas RLS — Mesas, Reservas, Cuentas de Mesa, Pedidos y Pagos
-- (Mutaciones transaccionales críticas canalizadas vía RPCs SECURITY DEFINER)
-- ============================================================================

-- restaurant_tables: mapa e inventario restringido a mesero y admin (clientes consultan franjas vía RPC)
DROP POLICY IF EXISTS restaurant_tables_select_roles ON public.restaurant_tables;
CREATE POLICY restaurant_tables_select_roles
  ON public.restaurant_tables FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_waiter()
    OR EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.table_id = restaurant_tables.id
        AND r.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS restaurant_tables_admin_write ON public.restaurant_tables;
DROP POLICY IF EXISTS restaurant_tables_admin_insert ON public.restaurant_tables;
CREATE POLICY restaurant_tables_admin_insert
  ON public.restaurant_tables FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS restaurant_tables_admin_update ON public.restaurant_tables;
CREATE POLICY restaurant_tables_admin_update
  ON public.restaurant_tables FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS restaurant_tables_admin_delete ON public.restaurant_tables;
CREATE POLICY restaurant_tables_admin_delete
  ON public.restaurant_tables FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- reservations: aislamiento por cliente propietario; mesero/admin leen ocupación; edición directa solo admin
DROP POLICY IF EXISTS reservations_select_authorized ON public.reservations;
CREATE POLICY reservations_select_authorized
  ON public.reservations FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR public.is_waiter() OR public.is_admin());

DROP POLICY IF EXISTS reservations_admin_write ON public.reservations;
CREATE POLICY reservations_admin_write
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- table_accounts: lectura exclusiva de personal interno (mesero / admin)
DROP POLICY IF EXISTS table_accounts_select_staff ON public.table_accounts;
CREATE POLICY table_accounts_select_staff
  ON public.table_accounts FOR SELECT
  TO authenticated
  USING (public.is_waiter() OR public.is_admin());

-- orders: aislamiento estricto por propietario, mesero (solo modalidad 'mesa') o admin
DROP POLICY IF EXISTS orders_select_authorized ON public.orders;
CREATE POLICY orders_select_authorized
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.is_admin()
    OR (public.is_waiter() AND modality = 'mesa')
  );

-- order_items: hereda visibilidad exacta de orders
DROP POLICY IF EXISTS order_items_select_authorized ON public.order_items;
CREATE POLICY order_items_select_authorized
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.customer_id = auth.uid()
          OR public.is_admin()
          OR (public.is_waiter() AND o.modality = 'mesa')
        )
    )
  );

-- order_status_history: solo lectura vinculada al pedido; inmutable
DROP POLICY IF EXISTS order_status_history_select_authorized ON public.order_status_history;
CREATE POLICY order_status_history_select_authorized
  ON public.order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND (
          o.customer_id = auth.uid()
          OR public.is_admin()
          OR (public.is_waiter() AND o.modality = 'mesa')
        )
    )
  );

-- payments: lectura solo del cliente propietario del pedido o admin (mesero sin acceso financiero D-05)
DROP POLICY IF EXISTS payments_select_authorized ON public.payments;
CREATE POLICY payments_select_authorized
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      order_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = payments.order_id
          AND o.customer_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 5. Políticas RLS — Caja y Auditoría (Exclusivo Administrador, escritura vía RPCs)
-- ============================================================================

DROP POLICY IF EXISTS cash_sessions_admin_select ON public.cash_sessions;
CREATE POLICY cash_sessions_admin_select
  ON public.cash_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS cash_sessions_admin_insert ON public.cash_sessions;
DROP POLICY IF EXISTS cash_movements_admin_insert ON public.cash_movements;

DROP POLICY IF EXISTS cash_movements_admin_select ON public.cash_movements;
CREATE POLICY cash_movements_admin_select
  ON public.cash_movements FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 6. Supabase Storage: Bucket 'product-images' y Políticas de Objetos
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152, -- 2 MB
  ARRAY['image/webp', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_public_read
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS product_images_admin_insert ON storage.objects;
CREATE POLICY product_images_admin_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS product_images_admin_update ON storage.objects;
CREATE POLICY product_images_admin_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS product_images_admin_delete ON storage.objects;
CREATE POLICY product_images_admin_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- ============================================================================
-- 7. Supabase Realtime (Idempotente)
-- ============================================================================

DO $$
DECLARE
  v_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY['orders', 'restaurant_tables', 'table_accounts', 'reservations']
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END;
$$;
