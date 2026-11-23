# Reglas de Negocio — Pagos Simulados
## FORJA BRAVA — SIGR

---

## 1. Principio de transparencia obligatoria
- Todos los pagos en esta etapa son **simulaciones controladas** sin conexión a pasarelas bancarias ni captura de tarjetas, CVV o claves reales.
- Toda pantalla de pago (`CLI-05`, `ADM-09`), comprobante (`PrintableReceipt`) y registro en `payments` debe incluir el indicador `is_simulated = true` y el aviso visible: *"Pago de demostración / simulación controlada. No se efectuó ningún cobro real."*

---

## 2. Medios de pago soportados y comportamiento por modalidad

| Medio | Domicilio | Recoger | En mesa (D-04) |
|---|---|---|---|
| **Efectivo** | Pedido creado con pago `Pendiente` (se cobra contra entrega y se consolida en Caja). | Pedido creado con pago `Pendiente` (se cobra al entregar en mostrador). | Se registra al cerrar la cuenta en Caja (`ADM-09`); suma al `expected_cash`. |
| **Tarjeta** | Simulación inmediata en Paso 4 -> `Confirmación simulada` (o `Fallido` si se simula rechazo). | Simulación inmediata en Paso 4 -> `Confirmación simulada`. | Se registra al cerrar la cuenta en Caja (`ADM-09`); suma a `total_digital_sales`. |
| **Nequi** | Simulación inmediata en Paso 4 -> `Confirmación simulada`. | Simulación inmediata en Paso 4 -> `Confirmación simulada`. | Se registra al cerrar la cuenta en Caja (`ADM-09`); suma a `total_digital_sales`. |
| **PSE** | Simulación inmediata en Paso 4 -> `Confirmación simulada`. | Simulación inmediata en Paso 4 -> `Confirmación simulada`. | Se registra al cerrar la cuenta en Caja (`ADM-09`); suma a `total_digital_sales`. |

---

## 3. Estados de pago (independientes de la preparación)
- **`Pendiente`:** Pago aún no recibido (pedidos `En mesa` antes de cierre de cuenta o pagos en `Efectivo` contra entrega).
- **`Confirmación simulada`:** Pago simulado aprobado con referencia única `DEMO-XXXXXXXX`.
- **`Fallido`:** Simulación rechazada; el pedido no se confirma en cocina y el cliente puede reintentar sin perder el carrito.
- **`Reembolsado`:** Reverso simulado registrado exclusivamente por el administrador tras cancelar un pedido que ya tenía `Confirmación simulada`.
