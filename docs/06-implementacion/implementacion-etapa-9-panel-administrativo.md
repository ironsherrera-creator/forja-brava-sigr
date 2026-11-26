# Implementación de la Etapa 9 — Panel Administrativo
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Estado:** COMPLETADO (implementado en React 19 + Supabase/PostgreSQL con RLS, Storage y RPCs auditables, validado con ESLint, Vitest, PostgreSQL real en PGlite, Vite build y Playwright E2E).  
**Stack:** React 19 · Vite 8 · Tailwind CSS v4 · React Router 7 · Zod 4 · `@supabase/supabase-js` v2 · PostgreSQL 17/19 (RLS + RPCs `SECURITY DEFINER`) · Supabase Storage (`product-images`).

---

## 1. Objetivo

Centralizar la operación administrativa de **FORJA BRAVA — SIGR** bajo `AdminLayout`, integrando los módulos de mesas, reservas y configuración de la Etapa 7 y completando el Dashboard con KPIs reales, gestión de catálogo (productos, categorías, imágenes y complementos), gestión de pedidos, usuarios, roles/permisos y consulta inmutable de auditoría.

---

## 2. Rutas y pantallas administrativas implementadas e integradas

| Ruta | Página | Funcionalidades principales |
| :--- | :--- | :--- |
| `/admin` | `src/pages/admin/AdminDashboardPage.jsx` | Indicadores reales calculados en `America/Bogota`: ventas del día, pedidos del día, ticket promedio, mesas ocupadas, reservas del día, cuentas activas y pendientes de cierre, productos activos y usuarios activos. |
| `/admin/productos`, `/admin/productos/nuevo`, `/admin/productos/:id` | `src/pages/admin/AdminProductsPage.jsx` | CRUD completo de `products`, precios, descripciones, categorías, carga de imágenes a Supabase Storage (`product-images`, límite 2 MB, PNG/JPG/WEBP), asociación de complementos (`product_complements`) y activación/desactivación lógica preservando snapshots históricos. |
| `/admin/categorias` | `src/pages/admin/AdminCategoriesPage.jsx` | CRUD de `categories`, control de `display_order`, activación y desactivación lógica. |
| `/admin/pedidos` | `src/pages/admin/AdminOrdersPage.jsx` | Listado con filtros por estado, modalidad y búsqueda; visor de detalle con `order_items` (snapshots) e historial `order_status_history`; transiciones válidas vía RPC `update_order_status` con trazabilidad. |
| `/admin/reservas`, `/admin/reservas/:id` | `src/pages/admin/AdminReservationsPage.jsx` | Integrado desde Etapa 7 con RPC `admin_manage_reservation`. |
| `/admin/mesas`, `/admin/mesas/:id` | `src/pages/admin/AdminTablesPage.jsx` | Integrado desde Etapa 7 con RPC `admin_save_restaurant_table` y trigger de integridad. |
| `/admin/usuarios` y `/admin/clientes` | `src/pages/admin/AdminUsersPage.jsx` | Consulta, búsqueda, filtro por rol, activación/desactivación y asignación de roles oficiales vía RPC `admin_update_user_account` (protección del último administrador y de la propia sesión; sin `service_role` en frontend). |
| `/admin/roles` | `src/pages/admin/AdminRolesPage.jsx` | Consulta oficial de `roles`, `permissions` y matriz `role_permissions` bajo RLS administrativo. |
| `/admin/configuracion`, `/admin/configuracion/horarios`, `/admin/configuracion/reservas` | `src/pages/admin/AdminScheduleConfigPage.jsx` | Integrado desde Etapa 7 (`restaurant_settings`, D-02, D-03, D-07) con auditoría automática. |
| `/admin/auditoria` | `src/pages/admin/AdminAuditPage.jsx` | Consulta de solo lectura sobre `audit_logs` con filtros por entidad, acción y fecha (`America/Bogota`) + visor de snapshots `old_data` / `new_data`. |

---

## 3. Servicios y Migración 10

- **Servicios creados:** `src/services/adminDashboardService.js`, `src/services/adminCatalogService.js`, `src/services/adminOrdersService.js`, `src/services/adminUsersService.js`, `src/services/adminAuditService.js`.
- **Migración 10 aditiva local (NO aplicada en remoto):** `supabase/migrations/20261125200010_waiter_closing_guard_and_admin_rpcs.sql`
  - RPC `public.admin_update_user_account(p_user_id, p_role_code, p_is_active)` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`, `is_admin()`, bloquea `CANNOT_MODIFY_OWN_PRIVILEGES`, respeta `LAST_ADMIN_PROTECTED` y registra `audit_logs`).
  - Triggers automáticos `trg_audit_products`, `trg_audit_categories` y `trg_audit_restaurant_settings` para registrar en `audit_logs` todos los cambios administrativos sobre catálogo y configuración.

---

## 4. Pruebas, resultados y pendientes

- **PostgreSQL real (PGlite):** `tests/sql/stage8And9Sql.test.js` verifica `admin_update_user_account` (bloqueo a mesero `FORBIDDEN_ROLE`, bloqueo de automodificación `CANNOT_MODIFY_OWN_PRIVILEGES`, actualización válida con auditoría) y triggers automáticos de auditoría sobre `products`.
- **Integración Vitest y E2E Playwright:** `tests/integration/waiterAndAdminStages8And9.test.jsx` y `tests/e2e/stages-8-and-9.spec.js`.
- **Pendientes:** Aplicación remota de Migraciones `08`, `09` y `10` cuando sea autorizada; módulos de Caja, Movimientos y Reportes (Etapa 10).
