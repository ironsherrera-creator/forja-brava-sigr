# Correcciones Técnicas Postauditoría — Etapas 6 y 7
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Fecha:** 24 de noviembre de 2026 (`America/Bogota`)  
**Documento base auditado:** `docs/06-implementacion/auditoria-tecnica-etapas-6-y-7.md` (dictamen histórico preservado sin alteración)  
**Alcance:** Resolución de hallazgos **AUD-01 a AUD-09 y AUD-13** sin modificar migraciones `01` a `07`, sin aplicar migraciones en Supabase remoto y sin ejecutar commits/push.

---

## 1. Estrategia de migraciones

- **Migraciones `01` a `07`:** **Intactas** (ya aplicadas en Supabase remoto).
- **Migración `08` corregida localmente (NUNCA aplicada en remoto):** `supabase/migrations/20261124230008_admin_reservations_and_schedule_rpcs.sql`
  - Corrige `set_default_customer_address` (AUD-13), añade `save_customer_address` (AUD-08), endurece `admin_manage_reservation` (AUD-05) y revoca `UPDATE` directo sobre `public.reservations` (AUD-08).
- **Migración `09` aditiva local (depende de `01..08`; NO aplicada en remoto):** `supabase/migrations/20261124233009_post_audit_integrity_and_hardening.sql`
  - Añade `orders.request_payload_hash`, corrige `get_available_reservation_slots` y `create_reservation` (AUD-01), fortalece `create_order` (AUD-02, AUD-03, AUD-04) e incorpora el trigger `trg_protect_restaurant_table_integrity` + RPC `admin_save_restaurant_table` (AUD-06, AUD-09).

---

## 2. Detalle de correcciones por hallazgo

| ID | Causa raíz | Archivos modificados / creados | Solución implementada | Pruebas y estado |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-01** | `(p_time + make_interval(...))::time > v_close` envolvía sobre 24 h al cruzar medianoche. | `20261124233009_post_audit_integrity_and_hardening.sql` | Ventanas completas `timestamp` en `America/Bogota` (`v_open_local`, `v_close_local`, `v_start_local`, `v_end_local`), soportando cierres que cruzan medianoche (`v_close < v_open`) y rechazando horarios inválidos o duraciones superiores al turno. | `tests/sql/postAuditSqlFixes.test.js` (6 escenarios en PostgreSQL real / PGlite). **CORREGIDO Y VERIFICADO** |
| **AUD-02** | `create_order` retornaba `v_existing` sin validar si el contenido del reintento coincidía con la solicitud original. | `20261124233009_post_audit_integrity_and_hardening.sql`, `src/services/orderService.js` | Columna `orders.request_payload_hash` (SHA-256 canónico sobre actor, modalidad, destino, método de pago, notas e ítems ordenados, sin datos sensibles). Rechaza con `IDEMPOTENCY_CONFLICT` si el payload difiere y corrige lógica trivaluada `NULL` con `IS NOT DISTINCT FROM` para `DUPLICATE_REQUEST_ID`. | `tests/sql/postAuditSqlFixes.test.js` (misma clave+mismo payload, misma clave+payload distinto, usuario ajeno, clave distinta). **CORREGIDO Y VERIFICADO** |
| **AUD-03** | Carrera entre `SELECT` y `INSERT` con la misma clave `client_request_id` podía lanzar `23505`. | `20261124233009_post_audit_integrity_and_hardening.sql` | Serialización transaccional mediante `pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0))` antes de consultar `orders`, manteniendo la restricción `UNIQUE`. | Lógica validada en PGlite; contención paralela multi-conexión pendiente de instancia PostgreSQL multi-sesión (Docker Desktop apagado). **CORREGIDO, PENDIENTE DE VERIFICACIÓN** (concurrencia multi-sesión) |
| **AUD-04** | Pase 1 y Pase 2 en `create_order` leían `products` dos veces sin bloqueo `FOR SHARE`. | `20261124233009_post_audit_integrity_and_hardening.sql` | Bloqueo selectivo `FOR SHARE` en orden determinista (`ORDER BY id`) **solo** sobre los `product_id` y `addon_id` referenciados + resolución de snapshots en un único pase (`v_resolved_items`). | `tests/sql/postAuditSqlFixes.test.js` (coincidencia exacta `orders.subtotal = SUM(order_items.line_total)` e inmutabilidad tras cambio de precio). **CORREGIDO Y VERIFICADO** |
| **AUD-05** | `admin_manage_reservation` carecía de matriz de transiciones, no limpiaba `cancelled_at` al reactivar y bloqueaba mesas sin orden determinista. | `20261124230008_admin_reservations_and_schedule_rpcs.sql` | Matriz estricta (`Pendiente`→`Confirmada`/`Cancelada`; `Confirmada`→`Atendida`/`Cancelada`; `Atendida` terminal; `Cancelada`→`Confirmada` limpiando `cancelled_at` y `cancel_reason`), bloqueo ordenado `ORDER BY t.id FOR UPDATE` sobre mesas involucradas y soporte explícito para limpiar `notes`. | `tests/sql/postAuditSqlFixes.test.js` (transiciones válidas/inválidas, reactivación, capacidad, roles). **CORREGIDO Y VERIFICADO** |
| **AUD-06** | Sin protección en PostgreSQL al reducir capacidad o desactivar mesas con reservas futuras o cuenta abierta. | `20261124233009_post_audit_integrity_and_hardening.sql`, `src/services/tableService.js` | Trigger `BEFORE UPDATE` `trg_protect_restaurant_table_integrity` en `public.restaurant_tables` que rechaza con `TABLE_CAPACITY_CONFLICT`, `TABLE_HAS_OPEN_ACCOUNT` o `TABLE_HAS_ACTIVE_RESERVATIONS`. | `tests/sql/postAuditSqlFixes.test.js` y `tests/unit/postAuditFrontendFixes.test.jsx`. **CORREGIDO Y VERIFICADO** |
| **AUD-07** | `ClientHistoryPage.jsx` filtraba fechas con `order.created_at.startsWith(dateFilter)` (UTC). | `src/utils/formatDate.js`, `src/pages/client/ClientHistoryPage.jsx` | Nueva utilidad `getDateIsoBogota(isoString)` usando `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` aplicada al filtro de `ClientHistoryPage.jsx`. | `tests/unit/postAuditFrontendFixes.test.jsx` (pedidos entre 19:00 y 23:59 hora Colombia). **CORREGIDO Y VERIFICADO** |
| **AUD-08** | Fallbacks frontend no transaccionales en `addressService.js` y `reservationService.js` + `UPDATE` directo permitido en `reservations`. | `20261124230008_admin_reservations_and_schedule_rpcs.sql`, `src/services/addressService.js`, `src/services/reservationService.js` | Eliminados todos los fallbacks no atómicos; `addressService` usa `save_customer_address` y `set_default_customer_address`; `reservationService` usa exclusivamente `admin_manage_reservation` y retorna error claro si la RPC no existe (`PGRST202`); `UPDATE` directo sobre `reservations` revocado en Migración 08. | `tests/sql/postAuditSqlFixes.test.js` (`permission denied` en `UPDATE` directo) y `tests/unit/postAuditFrontendFixes.test.jsx` (cero llamadas a `.from()` ante `PGRST202`). **CORREGIDO Y VERIFICADO** |
| **AUD-09** | Reactivar una mesa desde el modal **Editar** dejaba `status = 'fuera_de_servicio'`. | `20261124233009_post_audit_integrity_and_hardening.sql`, `src/services/tableService.js` | Nueva RPC `admin_save_restaurant_table` (`SECURITY DEFINER`, `is_admin()`, auditoría) que despeja `fuera_de_servicio` al reactivar sin sobrescribir estados operativos legítimos (`ocupada`/`reservada`) y delega el estado final a `sync_table_status`. | `tests/sql/postAuditSqlFixes.test.js` y `tests/unit/postAuditFrontendFixes.test.jsx`. **CORREGIDO Y VERIFICADO** |
| **AUD-13** | `set_default_customer_address` no verificaba `profiles.is_active = true` y bloqueaba solo 1 fila. | `20261124230008_admin_reservations_and_schedule_rpcs.sql` | Valida `v_actor IS NOT NULL AND public.current_user_role() IS NOT NULL` (exige perfil activo) y bloquea todas las direcciones del usuario `ORDER BY ca.id FOR UPDATE`. | `tests/sql/postAuditSqlFixes.test.js` (perfil desactivado rechazado, aislamiento por propietario, unicidad). Concurrencia multi-sesión pendiente de PostgreSQL multi-conexión. **CORREGIDO Y VERIFICADO** (lógica/seguridad en PGlite) |

---

## 3. Resultados de verificación

| Verificación | Comando | Resultado |
| :--- | :--- | :--- |
| Linter | `npm run lint` | **EXIT 0** — 0 errores, 0 advertencias |
| Pruebas unitarias, integración y SQL (PGlite) | `npm test` (`vitest run`) | **EXIT 0** — 11/11 archivos, 65/65 pruebas aprobadas (incluyendo 5 suites PostgreSQL reales en PGlite 0.6.0 sobre migraciones `01..09`) |
| Compilación de producción | `npm run build` | **EXIT 0** — `dist/` generado en 1.37 s |
| Pruebas E2E | `npm run test:e2e` (`playwright test`) | **EXIT 0** — 18/18 pruebas aprobadas |

---

## 4. Limitaciones y riesgos residuales

- **Entorno PostgreSQL aislado:** Docker Desktop no se encontraba activo en la estación local, por lo que las pruebas SQL reales se ejecutaron sobre **PGlite 0.6.0** (PostgreSQL compilado a WebAssembly con `btree_gist` y `pgcrypto`, 100% en memoria sin tocar Supabase remoto). PGlite valida SQL, triggers, restricciones, `GRANT`/`REVOKE` y RLS reales, pero expone **una única conexión**, por lo que las pruebas de contención paralela multi-sesión (dos transacciones simultáneas reales sobre `create_order` y `set_default_customer_address`) deben ejecutarse en una instancia PostgreSQL multi-conexión (Docker o entorno staging) antes del pase a producción.
- **Despliegue remoto pendiente:** Las Migraciones `08` y `09` permanecen únicamente en local conforme a las restricciones obligatorias.
