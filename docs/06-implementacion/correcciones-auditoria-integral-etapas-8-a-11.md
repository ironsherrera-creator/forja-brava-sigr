# Correcciones Técnicas Postauditoría Integral — Etapas 8, 9, 10 y 11
## FORJA BRAVA — SIGR (Resolución de Hallazgos `AUD811-01` a `AUD811-07`)

**Fecha:** 25 de noviembre de 2026 (`America/Bogota`)  
**Informe de origen:** [`auditoria-integral-etapas-8-a-11.md`](./auditoria-integral-etapas-8-a-11.md)  
**Ámbito de ejecución:** Exclusivamente local y verificable (migraciones locales aún no aplicadas en remoto `09`, `10` y nueva migración aditiva `11`; sin tocar migraciones `01`–`07`, `.env` ni Supabase remoto).

---

## 1. Resumen ejecutivo

Se resolvieron en su totalidad los **7 hallazgos** (`AUD811-01` a `AUD811-07`) detectados durante la auditoría técnica integral de las Etapas 8, 9, 10 y 11, validando empíricamente cada corrección sobre **PostgreSQL real** (tanto en **PGlite** con `pgcrypto` confinada al esquema `extensions` como en un clúster efímero aislado de **PostgreSQL 18** con múltiples conexiones TCP concurrentes y más de **3.600 pedidos / 7.200 líneas**).

| Hallazgo | Severidad | Causa raíz | Solución implementada | Estado |
| :--- | :---: | :--- | :--- | :---: |
| **`AUD811-01`** | **ALTA** | `public.create_order` fijaba `SET search_path = public, pg_temp` e invocaba `digest(..., 'sha256')` sin esquema; en Supabase remoto `pgcrypto` vive en `extensions`. | Sustitución por función nativa del núcleo PostgreSQL 14+ `encode(pg_catalog.sha256(convert_to(...::text, 'UTF8')), 'hex')` sobre el mismo JSON canónico. | **RESUELTO Y VERIFICADO** |
| **`AUD811-02`** | **MEDIA** | `saveAdminProduct` realizaba 3 escrituras HTTP separadas (`products`, `DELETE` e `INSERT` en `product_complements`) sin transacción ni rollback, incluso al alternar disponibilidad. | Nueva RPC atómica `public.admin_save_product` con validación de complementos `is_addon = true`, deduplicación, rollback total ante error, flag `p_sync_complements` y registro en `audit_logs`. | **RESUELTO Y VERIFICADO** |
| **`AUD811-03`** | **MEDIA** | `public.refund_order_payment` existía en PostgreSQL pero carecía de flujo operativo conectado en UI administrativa. | Flujo administrativo completo en `AdminOrdersPage.jsx` + acceso rápido desde `AdminCashPage.jsx` con modal de revisión financiera, motivo obligatorio, control de liquidez en `Efectivo` y aviso explícito para medios digitales simulados. | **RESUELTO Y VERIFICADO** |
| **`AUD811-04`** | **MEDIA** | `fetchReportsDataset` truncaba en cliente (`.limit(1000)` / `.limit(3000)`) y `AdminReportsPage.jsx` omitía los filtros de `estado` y `producto`. | Nueva RPC `public.get_admin_reports_summary` en zona `America/Bogota`, sin truncamiento ni multiplicación por joins, conectada a los **7 filtros**, paginación y KPIs diferenciados en `AdminReportsPage.jsx`. | **RESUELTO Y VERIFICADO** |
| **`AUD811-05`** | **MEDIA** | Ventana TOCTOU en `public.admin_update_user_account` si 2 administradores activos se desactivaban o degradaban mutuamente antes del `COMMIT`. | `pg_advisory_xact_lock` + bloqueo determinístico `ORDER BY p.id FOR UPDATE` sobre administradores activos/actor/objetivo + revalidación post-lock del actor y conteo `LAST_ADMIN_PROTECTED`. | **RESUELTO Y VERIFICADO** |
| **`AUD811-06`** | **BAJA** | RLS sobre `profiles` impedía mostrar en salón el nombre del mesero responsable cuando otro compañero abría una cuenta. | Nueva RPC de privilegio mínimo `public.get_salon_staff_directory` que expone únicamente `staff_id`, `visible_name`, `role_code` y `active_table_codes` (sin correo ni teléfono), integrada en mapa, detalle y cuentas. | **RESUELTO Y VERIFICADO** |
| **`AUD811-07`** | **BAJA** | El campo opcional de efectivo recibido en Caja no bloqueaba importes inferiores al total ni validaba `p_received_amount` en backend. | Función `validateCashReceived` en UI/servicio + validación transaccional de `p_received_amount` en `confirm_order_payment` y `settle_table_account` (`INSUFFICIENT_CASH_RECEIVED`, `RECEIVED_AMOUNT_ONLY_FOR_CASH`). | **RESUELTO Y VERIFICADO** |

---

## 2. Detalle técnico por hallazgo

### 2.1 `AUD811-01` — Compatibilidad SHA-256 con Supabase remoto
- **Archivo modificado:** `supabase/migrations/20261124233009_post_audit_integrity_and_hardening.sql`.
- **Cambio:** Reemplazo de `encode(digest(...::text, 'sha256'), 'hex')` por `encode(pg_catalog.sha256(convert_to(...::text, 'UTF8')), 'hex')`.
- **Garantías preservadas:** `SET search_path = public, pg_temp`, mismo payload canónico JSON, idempotencia por `(customer_id, client_request_id)`, rechazo `IDEMPOTENCY_CONFLICT` ante alteración de payload y rechazo `DUPLICATE_REQUEST_ID` entre usuarios distintos.

### 2.2 `AUD811-02` — Guardado transaccional de productos y complementos
- **Archivos modificados/creados:** `supabase/migrations/20261125213011_catalog_reports_staff_and_cash_hardening.sql`, `src/services/adminCatalogService.js`, `src/pages/admin/AdminProductsPage.jsx`.
- **Cambio:** Creación de `public.admin_save_product(...)` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`). Valida rol administrador, categoría existente, precisión monetaria y que cada `complement_id` exista, sea distinto del producto padre y tenga `is_addon = true`. Si falla cualquier validación, PostgreSQL revierte tanto la escritura en `products` como el borrado/inserción en `product_complements`. Al conmutar únicamente disponibilidad (`handleToggleAvailable`), envía `p_sync_complements = false` para no tocar `product_complements`.

### 2.3 `AUD811-03` — Flujo operativo de reembolsos (`refund_order_payment`)
- **Archivos modificados:** `src/services/adminOrdersService.js`, `src/pages/admin/AdminOrdersPage.jsx`, `src/pages/admin/AdminCashPage.jsx`.
- **Cambio:** `fetchAdminOrders` incorpora los registros de `payments` del pedido y `getOrderRefundSummary` calcula importe pagado, importe reembolsado, saldo reembolsable y elegibilidad (`status === 'Cancelado'`, `modality !== 'mesa'`, pago en `Confirmación simulada` sin reembolso previo). El modal de confirmación presenta todos los datos del pago original, exige motivo obligatorio (`>= 4` caracteres) y advierte el descuento de efectivo físico para `Efectivo` frente al asiento contable simulado sin reversión bancaria externa para `Tarjeta`, `Nequi` y `PSE`.

### 2.4 `AUD811-04` — Reportes agregados en PostgreSQL sin truncamiento y con 7 filtros
- **Archivos modificados:** `supabase/migrations/20261125213011_catalog_reports_staff_and_cash_hardening.sql`, `src/services/reportsService.js`, `src/pages/admin/AdminReportsPage.jsx`.
- **Cambio:** `public.get_admin_reports_summary` agrega independientemente `orders`, `payments`, `cash_movements`, `order_items`, `reservations`, `table_accounts` y `cash_sessions` en zona horaria `America/Bogota`, eliminando por completo los límites `.limit(1000)` / `.limit(3000)` en navegador. `AdminReportsPage.jsx` expone los **7 filtros** (`Fecha inicial`, `Fecha final`, `Estado`, `Modalidad`, `Método de pago`, `Categoría`, `Producto`), diferencia KPIs de pedidos registrados, ventas confirmadas, pagos recibidos, reembolsos, ingresos manuales y egresos manuales, e incorpora paginación (`Pagination`) sobre la tabla de productos.

### 2.5 `AUD811-05` — Protección concurrente del último administrador activo
- **Archivo modificado:** `supabase/migrations/20261125200010_waiter_closing_guard_and_admin_rpcs.sql`.
- **Cambio:** En `public.admin_update_user_account`, se adquiere `pg_advisory_xact_lock(hashtextextended('sigr_admin_privilege_guard', 0))` y se bloquean con `ORDER BY p.id FOR UPDATE` todos los administradores activos más actor y objetivo. Inmediatamente después del bloqueo se revalida que `v_actor` continúe siendo un administrador activo y que permanezca al menos `1` administrador activo tras el cambio (`LAST_ADMIN_PROTECTED`), eliminando tanto la condición TOCTOU como cualquier riesgo de interbloqueo (`40P01`).

### 2.6 `AUD811-06` — Visibilidad operativa mínima del personal de salón sin PII
- **Archivos modificados:** `supabase/migrations/20261125213011_catalog_reports_staff_and_cash_hardening.sql`, `src/services/waiterService.js`, `src/hooks/useWaiterSalon.js`, `src/pages/waiter/WaiterTablesPage.jsx`, `src/pages/waiter/WaiterTableDetailPage.jsx`, `src/pages/waiter/WaiterAccountsPage.jsx`.
- **Cambio:** `public.get_salon_staff_directory()` autoriza exclusivamente a `mesero` y `administrador` y retorna únicamente `staff_id`, `visible_name`, `role_code` y `active_table_codes` (jamás expone `email`, `phone` ni metadatos privados). Las vistas de salón muestran el nombre del mesero responsable en mesas ocupadas, cuentas activas y comandas.

### 2.7 `AUD811-07` — Validación de monto recibido y cambio en efectivo
- **Archivos modificados:** `supabase/migrations/20261125213011_catalog_reports_staff_and_cash_hardening.sql`, `src/utils/cashCalculations.js`, `src/services/cashService.js`, `src/pages/admin/AdminCashPage.jsx`.
- **Cambio:** `validateCashReceived` rechaza en frontend y servicio importes negativos, con más de 2 decimales, inferiores al saldo pendiente o informados sobre medios digitales, deshabilitando el botón de cobro cuando el valor es inválido y mostrando el cambio exacto cuando es válido. En PostgreSQL, `confirm_order_payment` y `settle_table_account` reciben `p_received_amount DEFAULT NULL`, imponen las mismas invariantes transaccionales y registran `received_amount` y `change_amount` en `audit_logs`.

---

## 3. Evidencia empírica de verificación

### 3.1 PostgreSQL 18 real — Concurrencia multi-conexión y volumen (`127.0.0.1:55445`)
Clúster efímero aislado con `pgcrypto` preinstalada **únicamente en el esquema `extensions`** (idéntico a Supabase remoto) y migraciones `01` a `11` aplicadas secuencialmente:
- **Invariantes de seguridad:** `pgcryptoSchema: "extensions"`, `publicTablesWithoutRls: 0`, `secDefWithoutSearchPath: 0`.
- **`AUD811-01` (conexiones TCP paralelas):**
  - Mismo `(customer_id, client_request_id)` y mismo payload en paralelo → `samePayloadOrdersCreated: 1` (sin duplicados).
  - Mismo `(customer_id, client_request_id)` y distinto payload en paralelo → `1` exitoso y `1` rechazado con `IDEMPOTENCY_CONFLICT`.
  - Mismo `client_request_id` por otro usuario → rechazado con `DUPLICATE_REQUEST_ID`.
- **`AUD811-05` (2 administradores activos en conexiones TCP paralelas):**
  - Desactivación mutua simultánea → `exactlyOneSucceeded: true`, `remainingActiveAdmins: 1`, `deadlock: false`.
  - Degradación mutua simultánea a `mesero` → `exactlyOneSucceeded: true`, `remainingActiveAdmins: 1`, `deadlock: false`.
  - Intento posterior de desactivar al único administrador restante → bloqueado (`deactivateLastAdminBlocked: true`).
- **`AUD811-04` (volumen real > 3.000 filas):**
  - `3.600` pedidos + `7.200` `order_items` (2 líneas por pedido) + `3.600` `payments` agregados en **`173 ms`**: `ordersAggregated: 3600`, `totalSales: 90000000`, `totalPaid: 90000000`, `orderItemsUnitsAggregated: 7200` (cero truncamiento y cero multiplicación por joins).

### 3.2 Batería automatizada del repositorio
| Comando | Resultado | Detalle |
| :--- | :---: | :--- |
| `npm run lint` | **EXIT 0** | `0` errores y `0` advertencias en todo el proyecto. |
| `npm test` | **EXIT 0** | **16/16 suites (`83/83` pruebas)** aprobadas, incluyendo `tests/sql/postAudit811Fixes.test.js` sobre PGlite con `pgcrypto` en `extensions` y `3.500` pedidos / `7.000` líneas. |
| `npm run build` | **EXIT 0** | Build de producción compilado correctamente. |
| `npm run test:e2e` | **EXIT 0** | **22/22 pruebas E2E** en Chromium aprobadas (incluyendo reembolso administrativo, directorio de salón, validación de efectivo recibido y los 7 filtros de reportes). |
| `npm audit --omit=dev` | **EXIT 0** | `0` vulnerabilidades en dependencias de producción. |

---

## 4. Secuencia local de migraciones listas para validación futura

Las migraciones `01` a `07` permanecen intactas. La secuencia pendiente de aplicación controlada en Supabase remoto cuando se autorice la etapa correspondiente es:
1. `supabase/migrations/20261124230008_admin_reservations_and_schedule_rpcs.sql`
2. `supabase/migrations/20261124233009_post_audit_integrity_and_hardening.sql`
3. `supabase/migrations/20261125200010_waiter_closing_guard_and_admin_rpcs.sql`
4. `supabase/migrations/20261125213011_catalog_reports_staff_and_cash_hardening.sql`
