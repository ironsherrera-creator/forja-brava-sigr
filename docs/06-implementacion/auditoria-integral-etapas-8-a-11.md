# Auditoría Técnica Integral — Etapas 8, 9, 10 y 11
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Fecha:** 25 de noviembre de 2026 (`America/Bogota`)  
**Modalidad:** Auditoría técnica independiente de solo lectura sobre el repositorio, complementada con pruebas empíricas de integración y concurrencia real multi-conexión en un clúster efímero aislado de **PostgreSQL 18** (`127.0.0.1:55441`).  
**Dictamen final:** **`REQUIERE CORRECCIONES`**

---

## 1. Resumen ejecutivo

Se auditó de extremo a extremo la implementación real de las **Etapas 8 (Panel del Mesero)**, **9 (Panel Administrativo)**, **10 (Caja y Reportes)** y **11 (Aseguramiento de Calidad)**, incluyendo la secuencia completa de migraciones SQL `01` a `10`, las políticas RLS, los privilegios `GRANT`/`REVOKE`, las RPC transaccionales, los servicios y páginas React y las suites de pruebas.

### Fortalezas verificadas empíricamente
- **Flujo integrado completo de 14 pasos (§11):** probado y aprobado al 100% en PostgreSQL 18 real (apertura de caja → 2 comandas en una única cuenta acumulada → entrega → solicitud de cierre → visibilidad admin → liquidación atómica en caja → cierre de cuenta → liberación de mesa → movimiento inmutable → trazabilidad en `audit_logs`).
- **Concurrencia real multi-conexión (§10):** probados 7 escenarios con conexiones TCP paralelas (`pg.Pool` + `Promise.all`) sobre PostgreSQL 18: cero cuentas duplicadas, cero pagos duplicados, bloqueo efectivo `ACCOUNT_CLOSING_REQUESTED` frente a comandas concurrentes y contabilidad consistente entre movimientos manuales y cierre de sesión.
- **Calidad y regresión (§7):** `eslint` (0 errores/advertencias), `vitest` (15/15 archivos, 75/75 pruebas incluyendo 3 suites PGlite SQL), `vite build` (OK), `playwright` (22/22 E2E aprobadas) y `npm audit --omit=dev` (0 vulnerabilidades).

### Motivo del dictamen `REQUIERE CORRECCIONES`
La inspección profunda del código SQL frente al entorno real de **Supabase remoto** descubrió un **defecto bloqueante de despliegue (`AUD811-01`, ALTO)** que pasa desapercibido en entornos locales:
- En `supabase/migrations/20261124233009_post_audit_integrity_and_hardening.sql` (L424), `public.create_order` fija `SET search_path = public, pg_temp` e invoca `digest(..., 'sha256')` **sin calificar esquema**. En PostgreSQL local/PGlite `pgcrypto` se instala en `public` y funciona, pero **en Supabase remoto `pgcrypto` reside en el esquema `extensions`**, por lo que `create_order` (y `create_table_order`) fallaría en remoto con `function digest(text, unknown) does not exist`.
- Adicionalmente, se identificaron **4 hallazgos de severidad MEDIA** (`AUD811-02` a `AUD811-05`) y **2 de severidad BAJA** (`AUD811-06` y `AUD811-07`) que conviene corregir antes de aplicar las migraciones `08`–`10` en Supabase remoto.

---

## 2. Alcance

- **Migraciones SQL:** `01` a `07` (aplicadas previamente en remoto) y secuencia local pendiente `08`, `09` y `10`.
- **Etapa 8 (Mesero):** `waiterService.js`, `useWaiterSalon.js`, `waiterSchemas.js` y las 6 páginas en `src/pages/waiter/`.
- **Etapa 9 (Administración):** `adminDashboardService.js`, `adminCatalogService.js`, `adminOrdersService.js`, `adminUsersService.js`, `adminAuditService.js` y las páginas en `src/pages/admin/`.
- **Etapa 10 (Caja y Reportes):** `cashCalculations.js`, `cashSchemas.js`, `exportReports.js`, `cashService.js`, `reportsService.js`, `AdminCashPage.jsx`, `AdminCashMovementsPage.jsx`, `AdminReportsPage.jsx`.
- **Etapa 11 (QA):** `tests/unit/`, `tests/integration/`, `tests/sql/` y `tests/e2e/`.

---

## 3. Auditoría del Panel del Mesero (Etapa 8)

- **Cuenta única acumulada por mesa (D-04):** Verificado en `public.create_table_order` → `public.create_order` (`09` L595–619) + índice parcial `idx_table_accounts_one_active_per_table` (`03` L104). Dos comandas simultáneas sobre una mesa virgen generan exactamente `1` cuenta activa cuya suma coincide con ambos pedidos.
- **Consistencia de precios e idempotencia:** `submitWaiterTableOrder` (`waiterService.js` L103–153) nunca envía precios; envía `clientRequestId` UUID y PostgreSQL bloquea productos `FOR SHARE` y calcula importes.
- **Permisos D-05:** Verificado en PostgreSQL (`05` L1061–1077) y en `WaiterOrdersPage.jsx`: el mesero solo puede transicionar `Listo` → `Entregado` y `Pendiente` → `Cancelado`. Cualquier intento de pasar a `Confirmado`, `En preparación` o `Listo` lanza `FORBIDDEN_ROLE`.
- **Protección de cierre solicitado (§3.7):** El trigger `trg_block_orders_on_closing_account` (`10` L15–51) bloquea en PostgreSQL cualquier nuevo `INSERT` en `orders` cuando `table_accounts.status = 'closing_requested'` (`ACCOUNT_CLOSING_REQUESTED`), y la UI oculta/deshabilita la toma de comandas para esas mesas.
- **Realtime:** `useWaiterSalon.js` suscribe `restaurant_tables`, `table_accounts` y `orders` (las tres incluidas en la publicación `supabase_realtime` en `04` L396) con limpieza `removeChannel` y *polling* cada 25 s.
- **Observación `AUD811-06` (BAJO):** Debido a la política RLS `profiles_select_own_or_admin` (`04` L53–56), un mesero no puede leer el `full_name` de otros meseros en `profiles`, por lo que el mapa y detalle de mesas no muestran el nombre textual del compañero cuando otro mesero abrió la cuenta.

---

## 4. Auditoría del Panel Administrativo (Etapa 9)

- **Dashboard (`AdminDashboardPage.jsx`, `adminDashboardService.js`):** Calcula KPIs reales en `America/Bogota` sin datos ficticios.
- **RPC `admin_update_user_account` (`10` L54–131):**
  - `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE ALL / GRANT EXECUTE TO authenticated`.
  - Exige `public.is_admin()` (bloquea clientes, meseros y usuarios inactivos).
  - Valida que el rol exista en `public.roles`, bloquea automodificación en sesión (`CANNOT_MODIFY_OWN_PRIVILEGES`), delega al trigger `protect_profile_privileged_fields` la protección del último administrador (`LAST_ADMIN_PROTECTED`) y registra `ADMIN_UPDATE_USER_ACCOUNT` en `audit_logs`.
  - **Hallazgo `AUD811-05` (MEDIO):** En aislamiento `READ COMMITTED`, `protect_profile_privileged_fields` (`01` L248–259) cuenta administradores activos sin `FOR UPDATE`; si dos administradores activos ejecutan `admin_update_user_account` desactivándose mutuamente antes de que cualquiera confirme `COMMIT`, existe una ventana teórica TOCTOU.
- **Catálogo (`adminCatalogService.js`, `AdminProductsPage.jsx`, `AdminCategoriesPage.jsx`):**
  - Los registros históricos están protegidos en BD por `order_items.product_id REFERENCES products(id) ON DELETE RESTRICT` y `products.category_id REFERENCES categories(id) ON DELETE RESTRICT`, y la UI solo realiza desactivación lógica (`is_available` / `is_active`).
  - Los triggers `trg_audit_products`, `trg_audit_categories` y `trg_audit_restaurant_settings` (`10` L134–189) registran auditoría automática.
  - **Hallazgo `AUD811-02` (MEDIO):** `saveAdminProduct` (`adminCatalogService.js` L143–170) actualiza el producto y luego ejecuta `DELETE` + `INSERT` sobre `product_complements` en **3 llamadas HTTP no transaccionales** sin verificar errores de `delete`/`insert`, y re-ejecuta ese borrado/inserción incluso al conmutar únicamente disponibilidad (`AdminProductsPage.jsx` L197).
- **Pedidos (`AdminOrdersPage.jsx`):**
  - Usa `update_order_status` con matriz estricta de transiciones e historial inmutable.
  - **Hallazgo `AUD811-03` (MEDIO):** Aunque `public.refund_order_payment` está implementada y blindada en PostgreSQL (`05` L1371), ni `AdminOrdersPage.jsx` ni `AdminCashPage.jsx` incluyen un botón en la interfaz para ejecutar el reembolso de un pedido cancelado cuyo pago ya estaba confirmado (`Confirmación simulada`).

---

## 5. Auditoría de Caja (Etapa 10)

- **Apertura única global (`open_cash_session`):** Respaldada por `idx_cash_sessions_single_open` (`03` L306) y validada bajo concurrencia real (1 abierta, 1 rechazada).
- **Ingresos y egresos (`register_cash_movement`):** Valida `amount > 0`, concepto `>= 2` caracteres, sesión abierta (`FOR KEY SHARE` + trigger `trg_cash_movements_require_open_session`) e inmutabilidad estricta (`trg_cash_movements_immutable`).
- **Cobro de cuentas de mesa (`settle_table_account`) y pedidos (`confirm_order_payment`):** Atómicos en PostgreSQL, protegidos contra doble cobro por `FOR UPDATE` e índices únicos `idx_payments_one_confirmed_per_table_account`, `idx_payments_one_confirmed_per_order` y `idx_cash_movements_one_sale_per_payment`. Liberan la mesa vía `sync_table_status`.
- **Arqueo y cierre (`close_cash_session` y `cashCalculations.js`):** La fórmula `opening_balance + cash_sales - cash_refunds + manual_in_cash - manual_out_cash` coincide exactamente entre backend y frontend, separando pagos digitales (`net_digital_sales`) del efectivo físico y **sin cerrar automáticamente cuentas de mesa abiertas** (verificado en prueba empírica `openAccountPreservedOnCashClose: true`).
- **Observación `AUD811-07` (BAJO):** En `AdminCashPage.jsx` (L411–433), el campo auxiliar *"Recibido"* (solo para mostrar cambio visual en efectivo) no bloquea el botón de cobro si el cajero digita un monto menor al total de la cuenta (en BD `settle_table_account` siempre registra el `total_amount` íntegro, pero conviene validar el input en UI para evitar confusión operativa).

---

## 6. Auditoría de Reportes y Exportación (Etapa 10)

- **Sin duplicación por joins:** `aggregateReportsData` (`reportsService.js` L7–124) consulta y agrega `orders`, `order_items` y `payments` por separado, evitando multiplicar totales de pedidos o pagos por el número de líneas del pedido, y distingue claramente *total de pedidos*, *total vendido (no cancelados)* y *total pagado confirmado*.
- **Exportación CSV y PDF:** `exportReports.js` genera CSV con cabeceras de metadatos (`Reporte`, `Periodo`, `Generado (America/Bogota)`) y escape RFC 4180, además de impresión nativa PDF.
- **Hallazgo `AUD811-04` (MEDIO):**
  1. `fetchReportsDataset` (`reportsService.js` L129–136) descarga lotes fijos (`.limit(1000)` en `orders`/`payments`, `.limit(3000)` en `order_items`) y aplica el rango de fechas en memoria en el navegador; al superar ese volumen histórico, los reportes de períodos anteriores quedarán truncados silenciosamente sin filtro `gte`/`lte` en servidor.
  2. `AdminReportsPage.jsx` (L128–178) incluye filtros por fechas, modalidad, método de pago y categoría, pero **no expone en la interfaz** los filtros por **estado de pedido** ni por **producto**, solicitados en la especificación de reportes (§3.8).

---

## 7. Auditoría de Calidad y Pruebas (Etapa 11)

| Suite / Verificación | Resultado real ejecutado | Evaluación del auditor |
| :--- | :--- | :--- |
| `npm run lint` | **EXIT 0** (0 errores, 0 advertencias) | Limpio. |
| `npm test` (Vitest + PGlite SQL) | **EXIT 0** (15/15 archivos, **75/75 pruebas**) | Las 3 suites en `tests/sql/` (`postAuditSqlFixes`, `stage8And9Sql`, `stage10And11Qa`) ejecutan **PostgreSQL real** (WASM) sobre las migraciones `01`–`10`, probando persistencia, triggers, RLS y flujos A–E sin mocks. |
| `npm run build` | **EXIT 0** (`dist/` compilado) | Bundle JS principal de `946 kB` (`253 kB` gzip); se sugiere *code-splitting* por ruta (`React.lazy`) como mejora futura de rendimiento. |
| `npm run test:e2e` (Playwright) | **EXIT 0** (**22/22 pruebas**) | Cubren UI, navegación y guards por rol con interceptores `page.route` (correctamente diferenciados de las pruebas reales de PostgreSQL). |
| `npm audit --omit=dev` | **EXIT 0** (`found 0 vulnerabilities`) | Sin vulnerabilidades en dependencias de producción. |

**Brecha detectada en el arnés local de pruebas SQL:** PGlite y PostgreSQL local instalan `pgcrypto` en `public`, mientras que Supabase remoto la instala en `extensions`; por ello las pruebas locales no detectaron `AUD811-01` hasta contrastar el `search_path` estricto de las funciones `SECURITY DEFINER`.

---

## 8. Seguridad (RLS, RBAC y RPC)

Auditoría automatizada contra el catálogo `pg_proc` y `pg_class` tras aplicar las migraciones `01` a `10` en PostgreSQL 18:
- **Tablas públicas sin RLS (`publicTablesWithoutRls`):** **`0`** (las 19 tablas tienen `relrowsecurity = true`).
- **Funciones `SECURITY DEFINER` sin `search_path` (`secDefWithoutSearchPath`):** **`0`** (todas definen `SET search_path = public, pg_temp`).
- **Sobrecargas/duplicados de funciones de negocio en `public`:** **`0`** (solo aparecen las funciones C internas de `pgcrypto`).
- **Credenciales y `service_role`:** Ausencia total de `service_role` en el código frontend y configuración `.env` intacta.

---

## 9. Integridad transaccional

Todas las mutaciones financieras y de inventario operativo (`open_cash_session`, `register_cash_movement`, `create_order`, `create_table_order`, `request_table_account_close`, `settle_table_account`, `confirm_order_payment`, `refund_order_payment`, `close_cash_session`, `admin_manage_reservation`, `admin_save_restaurant_table`, `admin_update_user_account`) residen en funciones PL/pgSQL atómicas con registro en `audit_logs`. La única excepción de escritura multi-paso desde cliente se encuentra en la asociación de complementos del catálogo (`saveAdminProduct`, `AUD811-02`).

---

## 10. Pruebas de concurrencia real (PostgreSQL 18 multi-conexión)

Ejecutadas sobre clúster efímero aislado de **PostgreSQL 18** (`127.0.0.1:55441`, `pg.Pool` con conexiones TCP paralelas independientes):

| Escenario concurrente real | Resultado empírico | Estado |
| :--- | :--- | :--- |
| **C1.** Dos comandas simultáneas en una misma mesa virgen (`create_table_order` × 2) | `bothOk: true`, `singleActiveAccount: true`, `totalMatchesSum: true` | **VERIFICADO** |
| **C2.** Solicitud de cierre (`request_table_account_close`) simultánea con nueva comanda (`create_table_order`) | `reqCloseOk: true`, `newOrderOk: false` (`ACCOUNT_CLOSING_REQUESTED`), `accountTotalConsistentWithOrders: true` | **VERIFICADO** |
| **C3.** Dos pagos simultáneos sobre la misma cuenta (`settle_table_account` × 2) | `exactlyOneOk: true`, `paymentsCount: 1` (0 pagos duplicados) | **VERIFICADO** |
| **C4.** Dos confirmaciones simultáneas sobre pedido individual (`confirm_order_payment` × 2) | `exactlyOneOk: true`, `saleMovementsInDb: 1` | **VERIFICADO** |
| **C5.** Dos aperturas simultáneas de caja (`open_cash_session` × 2) | `exactlyOneOk: true`, `openSessions: 1` | **VERIFICADO** |
| **C6.** Movimiento manual (`register_cash_movement`) simultáneo con cierre de sesión (`close_cash_session`) | `cashClosed: true`, `movOk: false` (`CASH_CLOSED`), 0 movimientos huérfanos | **VERIFICADO** |
| **C7.** Desactivación mutua simultánea entre los 2 únicos administradores activos | `remainingActiveAdmins: 1` en corrida rápida, pero inspección SQL confirma ventana TOCTOU bajo barrera antes de `COMMIT` (`AUD811-05`) | **OBSERVACIÓN (`AUD811-05`)** |

---

## 11. Integración entre módulos (Flujo completo de 14 pasos)

Verificado de principio a fin en PostgreSQL 18 (`integrated14Steps`):
1. Apertura de sesión de caja (`$150.000`) → OK.
2. Selección de mesa activa `M-INT-01` → OK.
3–5. Dos comandas sucesivas con y sin complementos asociadas a la **misma** `table_account_id` (`sameAccount: true`) → OK.
6–7. Solicitud de cierre por mesero visible para administrador (`closingRequestedVisibleToAdmin: true`, `accountTotalMatchesOrders: true`) → OK.
8–12. Cobro en Caja (`Efectivo`) cierra la cuenta (`accountClosed: true`), libera la mesa (`tableFreed: true`, `status = 'disponible'`) y asienta el movimiento `sale` exacto (`cashMovementRecorded: true`) → OK.
13–14. Agregación de reportes sin duplicación y eventos inmutables en `audit_logs` (`auditEventsRecorded: true`) → OK.
- **Casos adicionales:** fallo simulado de pago hace `ROLLBACK` total (`simulatedFailedPaymentRolledBack: true`); cerrar sesión de caja preserva abiertas las cuentas de mesa en curso (`openAccountPreservedOnCashClose: true`).

---

## 12. Auditoría de la secuencia de migraciones (08, 09 y 10)

Las migraciones `01` a `10` se aplican limpiamente en orden secuencial desde una base vacía sin conflictos sintácticos ni sobrecargas duplicadas. Sin embargo, para garantizar compatibilidad 100% con **Supabase remoto**, debe corregirse `AUD811-01` (`digest` no calificada bajo `search_path = public, pg_temp` en la Migración 09).

---

## 13. Hallazgos nuevos detectados

| ID | Severidad | Módulo / Archivo | Descripción técnica |
| :--- | :---: | :--- | :--- |
| **AUD811-01** | **ALTO** | `20261124233009_post_audit_integrity_and_hardening.sql` (L424) | `public.create_order` usa `SET search_path = public, pg_temp` e invoca `digest(..., 'sha256')` sin esquema. En Supabase remoto `pgcrypto` está en `extensions`, lo que provocará fallo en tiempo de ejecución al crear pedidos. |
| **AUD811-02** | **MEDIO** | `src/services/adminCatalogService.js` (L143–170), `AdminProductsPage.jsx` (L197) | La actualización de producto y sus `product_complements` ejecuta 3 escrituras HTTP separadas sin transacción ni manejo de errores en `delete`/`insert` de complementos, y se dispara incluso al cambiar solo disponibilidad. |
| **AUD811-03** | **MEDIO** | `src/pages/admin/AdminOrdersPage.jsx` / `AdminCashPage.jsx` | La RPC `public.refund_order_payment` existe en BD pero no cuenta con acción conectada en la interfaz administrativa para reembolsar pedidos cancelados que ya estaban pagados. |
| **AUD811-04** | **MEDIO** | `src/services/reportsService.js` (L129–136), `AdminReportsPage.jsx` | `fetchReportsDataset` usa `.limit(1000)` / `.limit(3000)` filtrando fechas en memoria (riesgo de truncamiento al crecer el historial) y `AdminReportsPage.jsx` no muestra controles de filtro por `estado` ni `producto`. |
| **AUD811-05** | **MEDIO** | `20261125200010_waiter_closing_guard_and_admin_rpcs.sql` (L54–131) | `admin_update_user_account` no serializa con `FOR UPDATE` el conjunto de perfiles administradores activos antes de desactivar/degradar, dejando ventana TOCTOU si 2 administradores se desactivan mutuamente antes del `COMMIT`. |
| **AUD811-06** | **BAJO** | `WaiterTablesPage.jsx`, `WaiterTableDetailPage.jsx`, `WaiterAccountsPage.jsx` | Las vistas de salón no muestran el nombre del mesero responsable cuando otro compañero abrió la cuenta debido a la restricción RLS sobre `profiles`. |
| **AUD811-07** | **BAJO** | `src/pages/admin/AdminCashPage.jsx` (L411–433) | El input opcional de efectivo recibido para cálculo de cambio no valida ni bloquea el envío si el cajero digita un valor menor al saldo a cobrar. |

---

## 14. Riesgos pendientes

1. **Fallo de `create_order` en Supabase remoto si se aplica la Migración 09 sin corregir `AUD811-01`.**
2. **Pérdida parcial de asociaciones `product_complements`** ante corte de red durante edición de producto (`AUD811-02`).
3. **Necesidad de aplicar las migraciones locales `08`, `09` y `10` en secuencia estricta** antes de desplegar el frontend en producción.

---

## 15. Correcciones recomendadas (previas a validación remota)

1. **`AUD811-01` (Obligatorio, cambio de 1 línea en Migración 09 local aún no aplicada):** Sustituir `encode(digest(...::text, 'sha256'), 'hex')` por la función nativa del núcleo de PostgreSQL 14+ `encode(pg_catalog.sha256(convert_to(...::text, 'UTF8')), 'hex')`, eliminando toda dependencia del esquema donde esté instalada `pgcrypto`.
2. **`AUD811-02`:** Crear una RPC `admin_save_product` transaccional (o separar el cambio rápido de disponibilidad y verificar errores en `product_complements`).
3. **`AUD811-03`:** Exponer el botón **Reembolsar pago** en `AdminOrdersPage.jsx` (con motivo y confirmación) para pedidos en `status === 'Cancelado'` y `payment_status === 'Confirmación simulada'` invocando `refund_order_payment`.
4. **`AUD811-04`:** Pasar `dateFrom`/`dateTo` como filtros `.gte()`/`.lte()` a PostgREST en `fetchReportsDataset` y añadir los selectores de `estado` y `producto` en `AdminReportsPage.jsx`.
5. **`AUD811-05`:** Añadir `PERFORM 1 FROM public.profiles WHERE role_id = v_admin_role_id AND is_active = true ORDER BY id FOR UPDATE;` en `admin_update_user_account` (Migración 10 local) cuando se degrade o desactive un administrador.
6. **`AUD811-06` y `AUD811-07`:** Validar `Number(received) >= acc.total_amount` cuando se ingrese efectivo recibido en `AdminCashPage.jsx` y, opcionalmente, exponer nombre de mesero en cuentas activas vía vista/RPC segura.

---

## 16. Dictamen final

**`REQUIERE CORRECCIONES`**

> La arquitectura transaccional, el aislamiento RLS/RBAC, la conciliación financiera, la integración entre salón y caja y la concurrencia real multi-conexión en PostgreSQL 18 demostraron un nivel de madurez alto. Subsanar puntualmente **`AUD811-01`** (compatibilidad `pg_catalog.sha256` con Supabase remoto) junto con los ajustes recomendados **`AUD811-02` a `AUD811-05`** dejará a **FORJA BRAVA — SIGR** completamente listo para pasar a validación controlada sobre Supabase remoto.

---

## 17. Seguimiento de correcciones postauditoría (25 de noviembre de 2026)

> **Nota de trazabilidad:** Las secciones 1 a 16 y el dictamen original de auditoría se conservan íntegros como registro histórico. Esta sección documenta el cierre técnico verificado de los hallazgos. Informe detallado en [`correcciones-auditoria-integral-etapas-8-a-11.md`](./correcciones-auditoria-integral-etapas-8-a-11.md).

| ID | Estado actual | Resolución verificada |
| :--- | :---: | :--- |
| **`AUD811-01`** | **CERRADO** | `public.create_order` migrado a `pg_catalog.sha256(convert_to(..., 'UTF8'))`; probado en PGlite y PostgreSQL 18 con `pgcrypto` instalada exclusivamente en `extensions`. |
| **`AUD811-02`** | **CERRADO** | Nueva RPC transaccional `public.admin_save_product` con validación `is_addon`, rollback total ante error, `p_sync_complements` separado para disponibilidad y auditoría. |
| **`AUD811-03`** | **CERRADO** | Modal operativo de reembolso conectado a `public.refund_order_payment` en `AdminOrdersPage.jsx` y acceso desde `AdminCashPage.jsx`, con motivo obligatorio y avisos diferenciados (`Efectivo` vs digital simulado). |
| **`AUD811-04`** | **CERRADO** | Nueva RPC `public.get_admin_reports_summary` en `America/Bogota` + los 7 filtros y paginación en `AdminReportsPage.jsx`; probado con `3.500` y `3.600` pedidos (`7.200` `order_items`) sin truncamiento ni duplicación por joins. |
| **`AUD811-05`** | **CERRADO** | `pg_advisory_xact_lock` + `ORDER BY p.id FOR UPDATE` + revalidación post-lock en `admin_update_user_account`; probado bajo desactivación y degradación mutua concurrente en PostgreSQL 18 (`remainingActiveAdmins: 1`, `deadlock: false`). |
| **`AUD811-06`** | **CERRADO** | RPC de privilegio mínimo `public.get_salon_staff_directory` integrada en vistas del mesero mostrando responsable operativo sin exponer correo ni teléfono. |
| **`AUD811-07`** | **CERRADO** | Validación de `receivedAmount` en `cashCalculations.js`, `AdminCashPage.jsx`, `confirm_order_payment` y `settle_table_account`. |

**Resultado global tras seguimiento:** `eslint` (`0` errores/advertencias), `vitest` (`16/16` suites, `83/83` pruebas), `vite build` (`OK`), `playwright` (`22/22` E2E), `npm audit --omit=dev` (`0` vulnerabilidades) y concurrencia multi-conexión en PostgreSQL 18 aprobada.
