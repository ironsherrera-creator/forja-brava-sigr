# Reglas de Negocio — Pedidos
## FORJA BRAVA — SIGR

---

## 1. Modalidades oficiales
1. **Domicilio (`domicilio`):** Requiere cliente autenticado (D-06), dirección completa y barrio. Suma la **tarifa fija de domicilio** vigente en `restaurant_settings.fixed_delivery_fee` (D-03).
2. **Recoger (`recoger`):** Requiere cliente autenticado (D-06). Tarifa de domicilio = `$0`. Permite indicar hora estimada de recogida.
3. **En mesa (`mesa`):** Registrado por el **mesero** (operación principal en salón) o por el **cliente autenticado** en restaurante. Se asocia a una `table_id` y a su `table_account_id`. Tarifa de domicilio = `$0`. El pago queda `Pendiente` hasta el cierre de cuenta (D-04).

---

## 2. Creación y validación
- Un pedido debe tener al menos `1` línea válida con `quantity >= 1`.
- Todos los productos y complementos deben estar activos (`is_available = true`) al momento de confirmar.
- Los precios, subtotales y totales se calculan siempre en servidor y se guardan como snapshot inmutable en `order_items`.
- El código legible de pedido sigue el formato único `FB-YYYYMMDD-XXXX` (basado en fecha local `America/Bogota`).

---

## 3. Estados y transiciones válidas

Estados oficiales: `Pendiente`, `Confirmado`, `En preparación`, `Listo`, `Despachado`, `Entregado`, `Cancelado`.

| Estado origen | Estados destino permitidos | Quién puede ejecutar | Condición |
|---|---|---|---|
| `Pendiente` | `Confirmado`, `Cancelado` | `administrador` (ambos); `mesero` (**solo `Cancelado`** en modalidad `mesa`, D-05) | El mesero pierde permiso de cancelar en cuanto sale de `Pendiente`. |
| `Confirmado` | `En preparación`, `Cancelado` | Solo `administrador` | — |
| `En preparación` | `Listo`, `Cancelado` | Solo `administrador` | — |
| `Listo` | `Despachado` (Domicilio) / `Entregado` (Recoger o Mesa) / `Cancelado` | `administrador` (todos); `mesero` (**solo `Entregado`** en modalidad `mesa`, D-05) | `Despachado` está prohibido para `Recoger` y `Mesa`. |
| `Despachado` | `Entregado`, `Cancelado` | Solo `administrador` | Solo modalidad `Domicilio`. |
| `Entregado` / `Cancelado` | *(Estados terminales)* | Ninguno | Inmutables tras cierre contable. |

---

## 4. Seguimiento, cancelación e historial
- Todo cambio de estado inserta un registro en `order_status_history` visible en `CLI-07` (solo lectura para cliente) y `ADM-05`.
- Los pedidos `Cancelado` se excluyen automáticamente del total de `table_accounts`, de ventas entregadas, de cierres de caja y de rankings de productos.
- Si un pedido con pago `Confirmación simulada` es cancelado por el administrador, el estado de pago puede marcarse como `Reembolsado` (simulado).
