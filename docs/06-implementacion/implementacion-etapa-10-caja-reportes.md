# Implementación de la Etapa 10 — Caja, Conciliación y Reportes
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Estado:** COMPLETADO (implementado en React 19 + Supabase/PostgreSQL con RPCs transaccionales auditables, validado con ESLint, Vitest, PGlite SQL, PostgreSQL 18 multi-conexión, Vite build y Playwright E2E).  
**Stack:** React 19 · Vite 8 · Tailwind CSS v4 · React Router 7 · Zod 4 · `@supabase/supabase-js` v2 · PostgreSQL 17/18/19 (RLS + RPCs `SECURITY DEFINER`).

---

## 1. Objetivo

Integrar el módulo financiero y analítico completo dentro del panel administrativo de **FORJA BRAVA — SIGR**, permitiendo abrir turnos de caja única, registrar ingresos y egresos manuales inmutables, cobrar cuentas acumuladas de mesa (D-04) y pedidos individuales, ejecutar arqueos físicos separados de ventas digitales, cerrar turnos con trazabilidad y generar/exportar reportes reales en zona horaria `America/Bogota`.

---

## 2. Arquitectura y modelo financiero utilizado (sin duplicar esquema)

El sistema reutiliza íntegramente las tablas, triggers y RPCs transaccionales auditadas de las Migraciones `03`, `04`, `05`, `07` y `10` (sin necesidad de crear migraciones redundantes):
- **Caja única global (`public.cash_sessions`):** garantizada por índice único parcial `idx_cash_sessions_single_open`.
- **Movimientos inmutables (`public.cash_movements`):** tipos `sale`, `refund`, `manual_income`, `manual_expense`, blindados por triggers `trg_cash_movements_require_open_session` y `trg_cash_movements_immutable`.
- **Pagos simulados (`public.payments`):** métodos `Efectivo`, `Tarjeta`, `Nequi`, `PSE` (sin datos bancarios reales ni pagos parciales; limitación documentada conforme al esquema actual).
- **RPCs transaccionales:** `open_cash_session`, `register_cash_movement`, `settle_table_account`, `confirm_order_payment`, `refund_order_payment`, `close_cash_session`.

---

## 3. Rutas, páginas, servicios y utilidades

| Ruta | Página | Funcionalidades |
| :--- | :--- | :--- |
| `/admin/caja`, `/admin/caja/apertura`, `/admin/caja/pagos`, `/admin/caja/arqueos`, `/admin/caja/cierres` | `src/pages/admin/AdminCashPage.jsx` | Dashboard de caja, apertura de turno con saldo inicial, cobro atómico de cuentas de mesa (D-04) con cálculo de cambio en efectivo y liberación de mesa, confirmación de pedidos individuales pendientes, arqueo físico separado de pagos digitales, cierre de sesión (sin cerrar automáticamente cuentas de mesa) e historial de sesiones anteriores. |
| `/admin/movimientos`, `/admin/caja/movimientos` | `src/pages/admin/AdminCashMovementsPage.jsx` | Registro de ingresos (`manual_income`) y egresos (`manual_expense`) con concepto y monto positivo + listado inmutable con filtros por tipo. |
| `/admin/reportes` | `src/pages/admin/AdminReportsPage.jsx` | Reportes reales de Ventas, Pagos por método, Productos/Categorías más vendidos, Operación y Caja, sin duplicación por joins, diferenciando pedidos/ventas/pagos confirmados, con filtros y exportación **CSV** y **PDF (impresión)**. |

- **Servicios y utilidades:** `src/services/cashService.js`, `src/services/reportsService.js`, `src/utils/cashCalculations.js`, `src/schemas/cashSchemas.js`, `src/utils/exportReports.js`.

---

## 4. Reglas financieras y limitaciones documentadas

- **Fórmula de efectivo físico esperado:** `opening_balance + cash_sales - cash_refunds + manual_income_cash - manual_expense_cash`. Los pagos electrónicos (`Tarjeta`, `Nequi`, `PSE`) se consolidan en `net_digital_sales` y **nunca** se suman al efectivo físico.
- **Pagos parciales:** No contemplados en el esquema actual (`idx_payments_one_confirmed_per_table_account` exige cobro consolidado único por cuenta). Documentado explícitamente sin inventar estados paralelos.
- **Cierre de caja vs. cierre de cuenta:** Cerrar una sesión de caja no cierra ni cobra automáticamente cuentas de mesa abiertas; la interfaz advierte si hay cuentas abiertas al momento del cierre.
