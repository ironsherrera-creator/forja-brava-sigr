-- ============================================================================
-- FORJA BRAVA — SIGR
-- Migración 07 (Correctiva Etapa 3): Privilegios mínimos de tabla (GRANT)
-- alineados 1:1 con las políticas Row Level Security (RLS) existentes.
--
-- Hallazgo detectado en verificación en vivo (Etapa 3):
-- Las migraciones 01..06 habilitaron RLS y definieron políticas por rol en las
-- 19 tablas, pero al aplicarse mediante CLI sin privilegios por defecto hacia
-- `anon` y `authenticated`, PostgREST rechaza las consultas directas con código
-- PostgreSQL `42501 (permission denied for table ...)`.
--
-- Principio de menor privilegio:
-- 1. Se revoca cualquier permiso residual de tabla para `anon` y `authenticated`.
-- 2. `anon` recibe ÚNICAMENTE `SELECT` sobre las 4 tablas públicas de catálogo
--    y configuración (`categories`, `products`, `product_complements`,
--    `restaurant_settings`), donde RLS filtra `is_active` / `is_available`.
-- 3. `authenticated` recibe únicamente los verbos SQL contemplados en las
--    políticas RLS de la Migración 04; las mutaciones transaccionales sobre
--    pedidos, pagos, cuentas de mesa, sesiones/movimientos de caja y auditoría
--    continúan canalizadas exclusivamente mediante RPCs `SECURITY DEFINER`.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1. Rol `anon`: exclusivamente lectura pública del catálogo y ajustes visibles
-- ----------------------------------------------------------------------------
GRANT SELECT ON TABLE
  public.categories,
  public.products,
  public.product_complements,
  public.restaurant_settings
TO anon;

-- ----------------------------------------------------------------------------
-- 2. Rol `authenticated`: privilegios mínimos gobernados por políticas RLS
-- ----------------------------------------------------------------------------

-- Identidad y RBAC (`profiles` protegido además por trigger `protect_profile_privileged_fields`)
GRANT SELECT ON TABLE
  public.roles,
  public.permissions,
  public.role_permissions
TO authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_addresses TO authenticated;

-- Catálogo y configuración (RLS restringe INSERT/UPDATE/DELETE a `public.is_admin()`)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.categories,
  public.products,
  public.product_complements,
  public.restaurant_tables
TO authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.restaurant_settings TO authenticated;

-- Operación transaccional: lectura gobernada por RLS; escrituras vía RPCs seguras
GRANT SELECT, UPDATE ON TABLE public.reservations TO authenticated;

GRANT SELECT ON TABLE
  public.table_accounts,
  public.orders,
  public.order_items,
  public.order_status_history,
  public.payments,
  public.cash_sessions,
  public.cash_movements,
  public.audit_logs
TO authenticated;
