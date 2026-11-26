# Implementación de la Etapa 7 — Mesas, Horarios, Motor de Disponibilidad y Administración de Reservas
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Estado:** COMPLETADO (implementado en React 19 + Supabase/PostgreSQL, con Migración 08 preparada localmente sin aplicar remotamente; validado con ESLint, Vitest, Vite build y Playwright E2E).  
**Stack:** React 19 · Vite 8 · Tailwind CSS v4 · React Router 7 · Zod 4 · `@supabase/supabase-js` v2 · PostgreSQL 17 (`btree_gist` + restricción de exclusión `excl_reservations_no_overlap` + RPCs `SECURITY DEFINER`).

---

## 1. Objetivo

Entregar el módulo administrativo completo de gestión física de mesas (D-01), configuración de horarios semanales, duración estándar de reserva (D-02), ventana de cancelación, tarifa fija de domicilio (D-03), parámetro de pedidos en mesa por cliente (D-07) y administración integral de reservas con reasignación de mesa validada en base de datos.

---

## 2. Rutas y pantallas administrativas implementadas

| Ruta | Página | Funcionalidades principales |
| :--- | :--- | :--- |
| `/admin/mesas` y `/admin/mesas/:id` | `src/pages/admin/AdminTablesPage.jsx` | Inventario dinámico de `restaurant_tables`: métricas de mesas totales/activas/inactivas y capacidad total activa, filtro por zona, creación/edición con validación de código único y capacidad ≥ 1, separación entre estado operativo (`Disponible`, `Reservada`, `Ocupada`, `Inactiva`) y estado administrativo (`is_active`), y desactivación lógica preservando historial. |
| `/admin/reservas` y `/admin/reservas/:id` | `src/pages/admin/AdminReservationsPage.jsx` | Listado operativo con filtros por fecha, estado y búsqueda por código/cliente, métricas rápidas, acciones de **Confirmar**, **Marcar atendida**, **Cancelar** y modal de **Reasignar mesa** filtrando mesas activas con capacidad suficiente y validación transaccional de no solapamiento. |
| `/admin/configuracion`, `/admin/configuracion/horarios` y `/admin/configuracion/reservas` | `src/pages/admin/AdminScheduleConfigPage.jsx` | Configuración persistente en `restaurant_settings`: horario semanal por día (abierto/cerrado, apertura y cierre en formato `HH:MM`), duración de reserva D-02 (`30–300 min`), ventana límite de cancelación, tarifa fija de domicilio D-03 (`COP`), permiso D-07 `allow_client_table_orders` y datos del establecimiento. |

---

## 3. Migración SQL aditiva local (Migración 08 — NO aplicada remotamente)

Se preparó el archivo aditivo local:
- `supabase/migrations/20261124230008_admin_reservations_and_schedule_rpcs.sql`

Funciones `SECURITY DEFINER` con `SET search_path = public, pg_temp` y permisos mínimos (`REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO authenticated;`):
1. **`public.set_default_customer_address(p_address_id uuid)`**: garantiza atomicidad al establecer una única dirección predeterminada por usuario autenticado, bloqueando el resto en la misma transacción.
2. **`public.admin_manage_reservation(p_reservation_id uuid, p_new_status text, p_new_table_id uuid, p_notes text)`**: restringida a `administrador` (`public.is_admin()`), valida transiciones permitidas (`Pendiente`/`Confirmada`/`Atendida`/`Cancelada`), verifica capacidad y ausencia de solapamiento antes de reasignar una mesa (apoyada en la restricción GiST `excl_reservations_no_overlap`) y registra auditoría en `audit_logs`.

> **Nota operativa:** En estricto cumplimiento de las restricciones del proyecto, las migraciones `01` a `07` no fueron modificadas y la Migración `08` **no** ha sido ejecutada contra la base de datos remota (`supabase db push` no ejecutado). Los servicios frontend (`addressService.js` y `reservationService.js`) invocan primero los RPCs de la Migración 08 y aplican respaldo automático compatible con las políticas RLS existentes si la migración aún no está desplegada en el proyecto remoto.

---

## 4. Arquitectura de servicios, hooks y esquemas

- **Validación Zod (`src/schemas/adminSchemas.js`):**
  - `restaurantTableSchema` (código 1–20 caracteres, zona, capacidad entera 1–40, estado activo).
  - `restaurantScheduleSettingsSchema` (duración 30–300 min, corte de cancelación 0–1440 min, tarifa domicilio ≥ 0, validación de apertura < cierre en cada día abierto).
  - `adminReservationActionSchema` (estados válidos, UUID de mesa opcional, notas).
- **Servicios:**
  - `src/services/tableService.js`: listado, creación, actualización y desactivación lógica de `restaurant_tables` con manejo explícito de códigos duplicados (`23505`).
  - `src/services/restaurantScheduleService.js`: lectura y actualización de `restaurant_settings` con normalización de `business_hours` para los 7 días de la semana.
  - `src/services/reservationService.js`: listado administrativo (`fetchAdminReservations`) y gestión transaccional (`adminUpdateReservation`).
- **Hooks:** `src/hooks/useTables.js` y `src/hooks/useReservations.js`.

---

## 5. Mejora transversal detectada y corregida durante pruebas

Durante la ejecución de las pruebas de integración de `AdminTablesPage`, se detectó y corrigió un defecto de foco en el componente compartido `src/components/ui/Modal.jsx` (el `useEffect` de apertura incluía `onClose` como dependencia, devolviendo el foco al diálogo tras cada cambio de estado interno). Se estabilizó `onClose` en una referencia (`useRef`), garantizando escritura fluida y accesible en todos los formularios modales de la aplicación.

---

## 6. Verificación y pruebas automatizadas

- **Pruebas unitarias (`tests/unit/stage6And7SchemasAndOrderRpc.test.js`):** validación de `restaurantTableSchema` (rechazo de capacidad `< 1`) y `restaurantScheduleSettingsSchema` (rechazo de cierre ≤ apertura).
- **Pruebas de integración (`tests/integration/clientAndAdminFlows.test.jsx`):** creación de mesa en `/admin/mesas` con verificación de payload enviado a `tableService`.
- **Pruebas E2E Playwright (`tests/e2e/stages-6-and-7.spec.js`):** creación de mesa `M-03`, actualización de horarios y duración en `/admin/configuracion`, y flujo de confirmación/gestión de reservas en `/admin/reservas`.
