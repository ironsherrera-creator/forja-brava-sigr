# Reglas de Negocio — Caja y Reportes
## FORJA BRAVA — SIGR

---

## 1. Operación de Caja (`ADM-09`)

### 1.1. Ciclo de turno de caja
1. **Apertura:** Solo puede existir **un turno abierto** (`cash_sessions.status = 'open'`) a la vez. El administrador registra `opening_balance >= 0`.
2. **Registro de ventas sin duplicación:**
   - Pedidos `Domicilio` y `Recoger` con pago `Confirmación simulada` (o cobro en `Efectivo` al marcarse `Entregado`) generan un movimiento `sale` en `cash_movements` vinculado a su `payment_id` único.
   - Pedidos `En mesa` **NO** se contabilizan al crearse; se contabilizan **una sola vez** al cerrarse su `table_account` en Caja (`settle_table_account`), generando un único `payment` y un único `cash_movement`.
3. **Movimientos manuales:** El administrador puede registrar `manual_income` (ingresos extraordinarios) y `manual_expense` (egresos de caja menor) con monto `> 0`, método (`Efectivo` por defecto) y concepto obligatorio.
4. **Arqueo y cálculo de efectivo esperado:**
   $$\text{Efectivo Esperado} = \text{Base Inicial} + \text{Ventas Efectivo} + \text{Ingresos Efectivo} - \text{Egresos Efectivo}$$
   - Los pagos digitales (`Tarjeta`, `Nequi`, `PSE`) se muestran en su propio total (`total_digital_sales`) y **jamás** se suman al efectivo físico esperado.
5. **Diferencia y Cierre:**
   $$\text{Diferencia} = \text{Efectivo Contado} - \text{Efectivo Esperado}$$
   - Se registra `counted_cash`, `difference`, `notes` y `closed_at`. Si un turno cruza medianoche (o las 7:00 p. m. UTC-5), todos los cobros del turno siguen perteneciendo a esa `cash_session_id` (eliminando el bug actual de `today()` en `js/admin.js`).

---

## 2. Reglas de Reportes (`ADM-10`)

- **Zona horaria obligatoria:** Todos los cortes diarios (`Ventas hoy`, `Ventas por día`, filtros `Desde`/`Hasta`) convierten `timestamptz` a `America/Bogota` (`AT TIME ZONE 'America/Bogota'`).
- **Exclusión de cancelados:** Pedidos en estado `Cancelado` se contabilizan únicamente en el KPI de `Cancelados`, nunca en ventas, ticket promedio ni ranking de productos.
- **Agrupación por identificador:** El ranking de productos más vendidos agrupa por `order_items.product_id` (mostrando el nombre actual del producto, total de unidades y monto total vendido `$`), evitando fragmentar el historial si el nombre del producto se edita.
- **Indicadores obligatorios:** Ventas totales del periodo, ventas diarias, pedidos por modalidad (`Domicilio`, `Recoger`, `Mesa`), desglose por medio de pago (`Efectivo`, `Tarjeta`, `Nequi`, `PSE`), ranking de productos, resumen de reservas y listado de cierres/movimientos de caja.
