# Segunda Auditoría Técnica Independiente — Etapas 6 y 7
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Fecha:** 24 de noviembre de 2026 (`America/Bogota`)  
**Modalidad:** Auditoría independiente de verificación postcorrección (solo lectura sobre el repositorio; pruebas de concurrencia en clúster efímero aislado de **PostgreSQL 18**)  
**Dictamen final:** **`APROBADO CON OBSERVACIONES`**

---

## 1. Resumen ejecutivo

Se realizó una verificación técnica independiente sobre las correcciones aplicadas tras la primera auditoría de las **Etapas 6 y 7** (`AUD-01` a `AUD-09` y `AUD-13`), inspeccionando directamente las migraciones `08` y `09`, los servicios y páginas React modificados, y ejecutando:
1. La batería automatizada completa (`eslint`, `vitest` 65/65 incluyendo 5 suites en PGlite, `vite build` y `playwright` 18/18).
2. **Seis pruebas reales de concurrencia multi-conexión** sobre un servidor **PostgreSQL 18** efímero y aislado (`127.0.0.1:55439`, `pg.Pool` con conexiones TCP y transacciones paralelas independientes, destruido al finalizar).

**Resultado:** Los 10 hallazgos priorizados (`AUD-01` a `AUD-09` y `AUD-13`) quedaron **efectivamente corregidos y verificados** con evidencia reproducible, incluyendo los escenarios de concurrencia real que permanecían pendientes en la fase anterior. No se detectaron hallazgos nuevos de severidad crítica ni alta.

---

## 2. Alcance de la auditoría

- **Migraciones SQL inspeccionadas:** `20261124230008_admin_reservations_and_schedule_rpcs.sql` y `20261124233009_post_audit_integrity_and_hardening.sql` (verificando además que las migraciones `01` a `07` permanecen intactas).
- **Frontend inspeccionado:** `src/utils/formatDate.js`, `src/pages/client/ClientHistoryPage.jsx`, `src/services/orderService.js`, `src/services/addressService.js`, `src/services/reservationService.js`, `src/services/tableService.js`.
- **Pruebas inspeccionadas y ejecutadas:** `tests/sql/postAuditSqlFixes.test.js`, `tests/unit/postAuditFrontendFixes.test.jsx`, suite completa Vitest/Playwright y batería multi-conexión en PostgreSQL 18.

---

## 3. Revisión independiente de hallazgos AUD-01 a AUD-09 y AUD-13

| Hallazgo | Verificación independiente | Evidencia |
| :--- | :--- | :--- |
| **AUD-01** | **VERIFICADO** | `create_reservation` y `get_available_reservation_slots` (Migración 09) operan con ventanas `timestamp` completas en `America/Bogota`, soportan cruce de medianoche (`v_close < v_open`) y rechazan `23:30` con cierre `22:00` (`OUT_OF_HOURS`). |
| **AUD-02** | **VERIFICADO** | `orders.request_payload_hash` (SHA-256 canónico) + `IDEMPOTENCY_CONFLICT` + `IS NOT DISTINCT FROM` para `DUPLICATE_REQUEST_ID` verificados tanto en PGlite como en PostgreSQL 18 multi-conexión. |
| **AUD-03** | **VERIFICADO** | `pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0))` + `UNIQUE` probados con 2 conexiones simultáneas reales en PostgreSQL 18: ambos hilos completaron sin error `23505`, retornaron el mismo `order.id` y crearon exactamente `1` registro. |
| **AUD-04** | **VERIFICADO** | Bloqueo selectivo `FOR SHARE` en `ORDER BY pr.id` solo sobre los productos/complementos solicitados + pase único de resolución (`v_resolved_items`). |
| **AUD-05** | **VERIFICADO** | `admin_manage_reservation` (Migración 08) impone matriz estricta de transiciones, limpia `cancelled_at`/`cancel_reason` al reactivar `Cancelada`→`Confirmada`, bloquea mesas en `ORDER BY t.id FOR UPDATE` (0 *deadlocks* en prueba cruzada A↔B en PG 18) y audita en `audit_logs`. |
| **AUD-06** | **VERIFICADO** | Trigger `trg_protect_restaurant_table_integrity` (Migración 09) bloquea reducción de capacidad por debajo de reservas futuras (`TABLE_CAPACITY_CONFLICT`) y desactivación con cuentas abiertas o reservas vigentes. |
| **AUD-07** | **VERIFICADO** | `ClientHistoryPage.jsx` filtra mediante `getDateIsoBogota(order.created_at)` en `America/Bogota`, corrigiendo el desplazamiento UTC entre 19:00 y 23:59 COT. |
| **AUD-08** | **VERIFICADO** | Eliminados los fallbacks no atómicos en `addressService.js` y `reservationService.js`; `UPDATE` directo sobre `public.reservations` revocado a `authenticated` en Migración 08 (`permission denied` verificado en BD). |
| **AUD-09** | **VERIFICADO** | `admin_save_restaurant_table` (Migración 09) + `tableService.js` restauran `status` mediante `sync_table_status` sin sobrescribir estados operativos legítimos y registran auditoría. |
| **AUD-13** | **VERIFICADO** | `set_default_customer_address` (Migración 08) exige `public.current_user_role() IS NOT NULL` (perfil activo) y bloquea todas las direcciones del usuario `ORDER BY ca.id FOR UPDATE` (0 *deadlocks* y 0 `23505` en prueba simultánea real en PG 18). |

---

## 4. Hallazgos nuevos

No se identificaron vulnerabilidades críticas ni altas nuevas. Se registran dos observaciones menores de endurecimiento operativo:
- **OBS-01 (BAJO):** `public.restaurant_tables` conserva `GRANT INSERT, UPDATE, DELETE` para `authenticated` (restringido por RLS a `is_admin()`) desde la Migración 07. Aunque el trigger `trg_protect_restaurant_table_integrity` protege la integridad de capacidad y desactivación incluso ante `UPDATE` directo, una edición directa vía PostgREST no escribiría en `audit_logs` ni llamaría a `sync_table_status`. El frontend actual ya canaliza todo mediante `admin_save_restaurant_table`.
- **OBS-02 (OPERATIVO):** Como se eliminaron los fallbacks frontend en `addressService.js`, `reservationService.js` y `tableService.js` (AUD-08), **las Migraciones `08` y `09` deben aplicarse en Supabase remoto antes o en la misma ventana de despliegue que el frontend actualizado**.

---

## 5. Resultados de seguridad (Supabase / PostgreSQL)

Todas las RPC nuevas o modificadas (`set_default_customer_address`, `save_customer_address`, `admin_manage_reservation`, `get_available_reservation_slots`, `create_reservation`, `create_order`, `admin_save_restaurant_table`) fueron verificadas con:
- `SECURITY DEFINER` + `SET search_path = public, pg_temp`.
- `REVOKE ALL FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO authenticated` (y `anon` únicamente en `get_available_reservation_slots` de solo lectura).
- Validación explícita de `auth.uid()` y `public.current_user_role()` / `public.is_admin()`.
- Registro en `public.audit_logs` en todas las mutaciones administrativas y transaccionales de pedidos, reservas y mesas.

---

## 6. Resultados de concurrencia real (PostgreSQL 18 multi-conexión)

**Entorno:** Instancia efímera local de **PostgreSQL 18** (`C:\Program Files\PostgreSQL\18\bin\postgres.exe`, puerto `55439`, `pg.Pool` con conexiones TCP independientes y `Promise.all` en transacciones separadas; sin afectar Supabase remoto).

| # | Escenario concurrente real (2 conexiones independientes) | Resultado observado | Estado |
| :--- | :--- | :--- | :--- |
| 1 | Dos `create_order` simultáneos con el mismo `client_request_id` y **mismo payload** | `bothOk: true`, `sameOrderId: true` (`17f53e45-91b7-4ab5-a191-7b3808586c33`), `dbCount: 1`, 0 errores `23505` | **APROBADO** |
| 2 | Dos `create_order` simultáneos con el mismo `client_request_id` y **payload diferente** | `exactlyOneOk: true`, el segundo rechazado con `IDEMPOTENCY_CONFLICT`, `dbCount: 1` | **APROBADO** |
| 3 | Dos clientes simultáneos reservando la única mesa disponible en horarios solapados (`19:00` vs `19:30`) | `exactlyOneOk: true`, el segundo rechazado (`SLOT_UNAVAILABLE`/`excl_reservations_no_overlap`), `dbActiveReservationsOnTable: 1` | **APROBADO** |
| 4 | Dos administradores reasignando reservas cruzadas entre las mismas mesas (`A→B` y `B→A`) | `bothOk: true`, `noDeadlock: true` (0 `40P01`) | **APROBADO** |
| 5 | Dos `set_default_customer_address` simultáneos para el mismo usuario | `bothOk: true`, `noDeadlockOr23505: true`, `dbDefaultCount: 1` | **APROBADO** |
| 6 | Reducción de capacidad (`4` → `2`) mientras existe reserva activa de 4 personas | `rejected: true` (`TABLE_CAPACITY_CONFLICT`), `capacityPreserved: true` (`4`) | **APROBADO** |

---

## 7. Resultados de pruebas automatizadas

| Suite | Comando | Resultado |
| :--- | :--- | :--- |
| ESLint | `npm run lint` | **EXIT 0** — 0 errores, 0 advertencias |
| Vitest (unitarias + integración + PGlite SQL) | `npm test` | **EXIT 0** — 11/11 archivos, **65/65 pruebas aprobadas** |
| Build producción | `npm run build` | **EXIT 0** — compilación limpia (`dist/` en 1.38 s) |
| Playwright E2E | `npm run test:e2e` | **EXIT 0** — **18/18 pruebas aprobadas** |

---

## 8. Evidencias y archivos inspeccionados

- `supabase/migrations/20261124230008_admin_reservations_and_schedule_rpcs.sql`
- `supabase/migrations/20261124233009_post_audit_integrity_and_hardening.sql`
- `src/utils/formatDate.js`, `src/pages/client/ClientHistoryPage.jsx`
- `src/services/orderService.js`, `src/services/addressService.js`, `src/services/reservationService.js`, `src/services/tableService.js`
- `tests/sql/postAuditSqlFixes.test.js`, `tests/unit/postAuditFrontendFixes.test.jsx`

---

## 9. Riesgos pendientes

1. **Sincronización de despliegue (OBS-02):** Aplicar las Migraciones `08` y `09` en Supabase remoto antes de publicar el bundle frontend actualizado para evitar errores `PGRST202` en direcciones, mesas y gestión administrativa de reservas.
2. **Ítems de prioridad baja heredados de la primera auditoría:** `AUD-10` (comandas sobre `table_accounts` en `closing_requested`), `AUD-14` (selector de reserva en `CheckoutPage` si en el futuro se activa D-07) y `AUD-15` (estado de carga por fila en `AdminReservationsPage`).

---

## 10. Dictamen final

**`APROBADO CON OBSERVACIONES`**

> Las correcciones de **AUD-01 a AUD-09 y AUD-13** son técnicamente sólidas y quedaron demostradas con evidencia reproducible tanto en pruebas unitarias/integración/E2E como en **concurrencia real multi-conexión sobre PostgreSQL 18**. El proyecto está en condiciones de avanzar a despliegue controlado de las Migraciones `08` y `09` cuando sea autorizado.
