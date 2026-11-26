# Implementación de la Etapa 8 — Panel del Mesero (Servicio en Salón)
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Estado:** COMPLETADO (implementado en React 19 + Supabase/PostgreSQL con RLS, Realtime y RPCs transaccionales, validado con ESLint, Vitest, PostgreSQL real en PGlite, Vite build y Playwright E2E).  
**Stack:** React 19 · Vite 8 · Tailwind CSS v4 · React Router 7 · Zod 4 · `@supabase/supabase-js` v2 · PostgreSQL 17/19 (RLS + RPCs `SECURITY DEFINER`) · Supabase Realtime.

---

## 1. Objetivo

Entregar una herramienta operativa ágil y responsive (tablets, computadores y móviles) para el rol **mesero** bajo `WaiterLayout`, respetando estrictamente las reglas de negocio **D-04** (cuenta acumulada única por mesa) y **D-05** (toma de comandas, consulta de pedidos de mesa, entrega de pedidos en estado `Listo` y cancelación únicamente de pedidos en estado `Pendiente`, sin manipular estados de preparación de cocina ni realizar cobros).

---

## 2. Rutas y pantallas implementadas

| Ruta | Página | Funcionalidades principales |
| :--- | :--- | :--- |
| `/mesero` | `src/pages/waiter/WaiterDashboardPage.jsx` | Indicadores operativos reales desde Supabase (mesas disponibles, ocupadas, reservadas, fuera de servicio, cuentas activas, cierres solicitados, pedidos registrados y pendientes de entrega), actualización en tiempo real (Realtime + polling) y listado de pedidos `Listos` para entregar. |
| `/mesero/mesas` | `src/pages/waiter/WaiterTablesPage.jsx` | Mapa visual de mesas con capacidad, zona, estado real (`disponible`, `ocupada`, `reservada`, `fuera_de_servicio`), cuenta activa, total acumulado, tiempo de ocupación y filtros por estado (sin edición estructural de mesas). |
| `/mesero/mesas/:id` | `src/pages/waiter/WaiterTableDetailPage.jsx` | Detalle de mesa y cuenta acumulada activa (D-04), pedidos asociados con productos, cantidades, complementos, observaciones, subtotales, total acumulado, botón para nueva comanda (bloqueado si la cuenta tiene cierre solicitado) y solicitud de cierre con `ConfirmDialog`. |
| `/mesero/comandas/nueva` (y alias `/mesero/nuevo-pedido`) | `src/pages/waiter/WaiterNewOrderPage.jsx` | Toma rápida de comandas: selección de mesa elegible, categorías y productos disponibles desde Supabase, buscador, selección de complementos reales (`product_complements`), observaciones por línea y generales, cantidades, eliminación, idempotencia (`clientRequestId`) y envío atómico vía `create_table_order`. |
| `/mesero/pedidos` y `/mesero/historial` | `src/pages/waiter/WaiterOrdersPage.jsx` | Listado de pedidos de mesa con filtros por fecha (`America/Bogota`), mesa, estado y número de pedido; acciones D-05 estrictas (**Entregar** solo en `Listo`, **Cancelar** solo en `Pendiente` con confirmación) vía `update_order_status`. |
| `/mesero/cuentas` | `src/pages/waiter/WaiterAccountsPage.jsx` | Listado de cuentas acumuladas activas (`open` y `closing_requested`), detalle de apertura, pedidos, cantidad de productos, total acumulado y solicitud de cierre controlada (sin cobrar ni cerrar definitivamente). |

---

## 3. Servicios, hooks, esquemas y Migración 10

- **Esquemas Zod:** `src/schemas/waiterSchemas.js` (`waiterOrderLineSchema`, `waiterCreateOrderSchema`).
- **Servicio y hook:** `src/services/waiterService.js`, `src/hooks/useWaiterSalon.js` (suscripción Supabase Realtime a `restaurant_tables`, `table_accounts`, `orders` con respaldo por polling).
- **RPCs utilizadas:** `public.create_table_order`, `public.update_order_status`, `public.request_table_account_close`.
- **Migración 10 aditiva local (NO aplicada en remoto):** `supabase/migrations/20261125200010_waiter_closing_guard_and_admin_rpcs.sql`
  - Trigger `trg_block_orders_on_closing_account` (`BEFORE INSERT ON public.orders`): impide registrar nuevos pedidos sobre una cuenta de mesa en estado `closing_requested` (`ACCOUNT_CLOSING_REQUESTED`), `closed` o `cancelled`.

---

## 4. Pruebas y resultados

- **PostgreSQL real (PGlite):** `tests/sql/stage8And9Sql.test.js` verifica acumulación de múltiples comandas en la misma `table_account`, bloqueo `FORBIDDEN_ROLE` ante intento del mesero de cambiar estado a `En preparación`, cancelación en `Pendiente`, entrega desde `Listo`, solicitud de cierre y rechazo `ACCOUNT_CLOSING_REQUESTED` al intentar agregar otra comanda tras solicitar cierre.
- **Integración Vitest:** `tests/integration/waiterAndAdminStages8And9.test.jsx`.
- **E2E Playwright:** `tests/e2e/stages-8-and-9.spec.js` (flujo completo de mesero + bloqueo 403 en `/admin/usuarios`).
- **Pendientes:** Aplicación remota de las migraciones `08`, `09` y `10` cuando sea autorizada; módulo de Caja (Etapa 10) para el cobro definitivo de cuentas con solicitud de cierre.
