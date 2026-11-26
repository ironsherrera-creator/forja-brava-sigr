# Implementación de la Etapa 11 — Pruebas y Aseguramiento de Calidad (QA)
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Estado:** COMPLETADO (batería integral ejecutada: ESLint, Vitest unitarias + integración + PostgreSQL real PGlite, PostgreSQL 18 multi-conexión para concurrencia real, Vite build, Playwright E2E y `npm audit --omit=dev`).

---

## 1. Estrategia de aseguramiento de calidad

Se estructuraron 5 capas independientes de verificación diferenciando explícitamente mocks de ejecución real en PostgreSQL:

1. **Pruebas unitarias (`tests/unit/`):** cálculos financieros puros (`cashCalculations.js`), esquemas Zod (`cashSchemas.js`, `authSchemas.js`, `clientSchemas.js`, `adminSchemas.js`), agregación de reportes sin duplicación por joins (`reportsService.js`), exportación CSV (`exportReports.js`), RBAC, zona horaria `America/Bogota` y componentes UI.
2. **Pruebas de integración frontend (`tests/integration/`):** `AuthContext`/guards, catálogo público y carrito, layouts y navegación por rol, flujos cliente/admin y mesero/admin.
3. **Pruebas reales de PostgreSQL, RLS, RBAC y Flujos A–E (`tests/sql/` sobre PGlite 0.6.0, migraciones `01`–`10`):**
   - `tests/sql/postAuditSqlFixes.test.js`: AUD-01..AUD-09 y AUD-13.
   - `tests/sql/stage8And9Sql.test.js`: D-04, D-05, bloqueo `ACCOUNT_CLOSING_REQUESTED`, `admin_update_user_account` y triggers de auditoría.
   - `tests/sql/stage10And11Qa.test.js`: **Flujos completos A (Mesa), B (Recoger), C (Domicilio con D-03), D (Caja completa + inmutabilidad) y E (Matriz de permisos Cliente/Mesero/Admin bajo RLS y RPC)**.
4. **Pruebas reales de concurrencia multi-conexión (PostgreSQL 18 efímero aislado, puerto `55440`, `pg.Pool` + `Promise.all`):**
   - Dos aperturas simultáneas de caja (`open_cash_session`) → 1 OK, 1 rechazada, 1 sesión abierta.
   - Dos solicitudes simultáneas de cierre (`request_table_account_close`) → 1 OK, 1 rechazada.
   - Dos pagos simultáneos sobre una misma cuenta (`settle_table_account`) → 1 OK, 1 rechazada, 1 solo pago.
   - Dos confirmaciones simultáneas sobre un mismo pedido (`confirm_order_payment`) → 1 OK, 1 rechazada, 1 solo movimiento.
   - Registro de movimiento manual simultáneo con cierre de caja (`register_cash_movement` vs `close_cash_session`) → contabilidad 100% consistente, 0 movimientos huérfanos.
   - Dos pedidos simultáneos con la misma clave de idempotencia (`create_order`) → 1 solo pedido, 0 duplicados.
5. **Pruebas E2E Playwright (`tests/e2e/`):** 22 escenarios cubriendo Etapas 3 a 11 (con interceptores HTTP controlados; claramente diferenciados de las pruebas reales de PostgreSQL).

---

## 2. Matriz de permisos verificada en PostgreSQL (RLS + RPC)

| Operación / Recurso | `cliente` | `mesero` | `administrador` |
| :--- | :---: | :---: | :---: |
| Abrir/cerrar caja (`open_cash_session`, `close_cash_session`) | Rechazado (`FORBIDDEN_ROLE`) | Rechazado (`FORBIDDEN_ROLE`) | Permitido (auditado) |
| Movimientos manuales (`register_cash_movement`) | Rechazado | Rechazado | Permitido (inmutable) |
| Lectura `cash_sessions` / `cash_movements` (RLS) | 0 filas | 0 filas | Permitido |
| Cobrar cuenta mesa / confirmar pago (`settle_table_account`, `confirm_order_payment`) | Rechazado | Rechazado | Permitido (auditado) |
| Registrar comanda mesa / solicitar cierre (`create_table_order`, `request_table_account_close`) | Bloqueado (D-07) | Permitido | Permitido |
| Modificar estados de cocina (`En preparación`, `Listo`) | Rechazado | Rechazado (D-05) | Permitido |
| Gestionar usuarios y roles (`admin_update_user_account`) | Rechazado | Rechazado | Permitido (auditado) |

---

## 3. Limitaciones y pendientes para despliegue controlado

- Las Migraciones `08`, `09` y `10` permanecen en local y deben aplicarse en orden secuencial (`08` → `09` → `10`) sobre Supabase remoto antes de publicar el frontend actualizado en Vercel.
- No se ejecutaron pruebas de escritura contra el proyecto Supabase remoto por restricción obligatoria del proyecto.
