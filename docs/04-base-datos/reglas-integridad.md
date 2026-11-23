# Reglas de Integridad y Controles Transaccionales
## FORJA BRAVA — SIGR

Documenta exactamente qué mecanismos de PostgreSQL y Supabase impiden los 6 riesgos críticos de integridad en el sistema.

---

## 1. Prevención de duplicación de pedidos
- **Mecanismo:** El frontend genera un UUID `client_request_id` por intento de checkout o envío de comanda y lo pasa a la RPC `create_order` / `create_table_order`.
- **En BD:** `orders.client_request_id` tiene restricción `UNIQUE`. Si ocurre un doble clic o reintento de red con el mismo `client_request_id`, la RPC retorna el pedido ya creado sin insertar un duplicado.

## 2. Prevención de sobreventa de disponibilidad (Productos y Mesas)
- **Productos:** Dentro de la transacción de `create_order` / `create_table_order`, se consultan los productos y complementos con `WHERE is_available = true`. Si alguno fue desactivado justo antes, se hace `ROLLBACK` y se retorna `OUT_OF_STOCK`.
- **Mesas:** `table_accounts` posee un índice único parcial `(table_id) WHERE status IN ('open','closing_requested')`, impidiendo abrir dos cuentas simultáneas en la misma mesa.

## 3. Prevención de reservas simultáneas incompatibles (D-01, D-02)
- **Mecanismo en BD:** Extensión `btree_gist` + restricción de exclusión:
  `EXCLUDE USING gist (table_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status IN ('Pendiente','Confirmada'))`.
- **Resultado:** Incluso si dos clientes pulsan "Confirmar reserva" en el mismo milisegundo para la última mesa disponible en un bloque horario traslapado, PostgreSQL rechaza la segunda transacción de forma atómica (`SLOT_UNAVAILABLE`).

## 4. Prevención de modificación indebida de precios
- **Mecanismo:** Las RPCs de creación de pedidos reciben únicamente `{ product_id, quantity, addon_ids[], notes }`. Los precios se leen directamente de `products.price` y la tarifa fija de `restaurant_settings.fixed_delivery_fee` dentro de PostgreSQL.
- **Snapshots históricos:** Los montos calculados se graban en `order_items.unit_price_snapshot`, `addons_snapshot` y `orders.subtotal / delivery_fee / total` con restricción `CHECK (total = subtotal + delivery_fee)`. Cambios futuros al catálogo jamás alteran órdenes pasadas.

## 5. Prevención de doble contabilización de pagos y ventas en Caja
- **Separación excluyente en `payments`:** `CHECK ((order_id IS NOT NULL) <> (table_account_id IS NOT NULL))` asegura que un pedido de mesa **no** tenga un pago individual además del pago consolidado de su `table_account`.
- **Unicidad de pago confirmado:** Índice único parcial en `payments` impide dos pagos `Confirmación simulada` para el mismo pedido o cuenta de mesa.
- **Unicidad en caja:** `cash_movements.payment_id` es `UNIQUE`, impidiendo registrar el mismo pago en dos turnos de caja o dos veces en el mismo turno.
- **Separación Efectivo vs. Digital:** El cálculo de `expected_cash` suma únicamente `opening_balance + ventas(Efectivo) + ingresos_manuales(Efectivo) - egresos_manuales(Efectivo)`. Los pagos `Tarjeta`, `Nequi` y `PSE` se totalizan en `total_digital_sales` sin sumarse al efectivo físico.

## 6. Garantía de trazabilidad histórica
- `ON DELETE RESTRICT` en `order_items.product_id`, `products.category_id` y `reservations.table_id` impide eliminar registros que rompan reportes históricos (promoviendo desactivación lógica `is_available = false` / `is_active = false`).
- `order_status_history` y `audit_logs` son tablas *append-only* (solo inserción) que registran actor, rol, hora y cambio.
