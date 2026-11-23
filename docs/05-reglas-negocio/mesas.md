# Reglas de Negocio — Mesas y Cuentas de Mesa
## FORJA BRAVA — SIGR

---

## 1. Inventario dinámico de mesas (D-01)
- No existe cantidad fija de mesas en código ni en BD.
- El administrador gestiona en `ADM-07` el código único (ej. `M-01`, `T-02`), la `zone` (ej. `Salón`, `Terraza`, `Barra`), la `capacity` (`>= 1`) y `is_active`.
- Las mesas con historial de reservas o pedidos se desactivan (`is_active = false` / `fuera_de_servicio`) en lugar de borrarse físicamente.

---

## 2. Estados de mesa y transiciones

| Estado | Significado operativo | Cómo entra a este estado |
|---|---|---|
| `disponible` | Libre para asignar a nuevos comensales o pedidos | Al crearse, al cobrarse y cerrarse su cuenta en Caja, o al finalizar/cancelar una reserva sin ocupación. |
| `ocupada` | Tiene una cuenta abierta (`table_accounts.status IN ('open','closing_requested')`) | Automáticamente al registrar el primer pedido `En mesa` (por mesero o cliente). |
| `reservada` | Tiene una reserva confirmada próxima o en curso aún sin cuenta abierta | Reflejado operativamente según la franja horaria de `reservations` activas. |
| `fuera_de_servicio` | Inhabilitada temporalmente por mantenimiento o cierre de zona | Configurado manualmente por el administrador (`ADM-07`). Impide nuevos pedidos y nuevas reservas. |

---

## 3. Reglas de Cuentas de Mesa (D-04)
1. **Máximo una cuenta abierta por mesa:** Garantizado en PostgreSQL mediante índice único parcial.
2. **Acumulación de múltiples pedidos:** Todos los pedidos sucesivos que el mesero (o el cliente) registre en la misma mesa mientras la cuenta esté `open` se asocian al mismo `table_account_id`.
3. **Cálculo del total de cuenta:** `table_accounts.total_amount` es la suma de `orders.total` de todos los pedidos asociados cuyo estado sea **distinto de `Cancelado`**.
4. **Solicitud de cierre por mesero (`MES-05`):** Cambia `table_accounts.status` de `open` a `closing_requested` y notifica a Caja (`ADM-09`).
5. **Cobro y liberación (`ADM-09`):** Solo al registrar el pago en Caja (`settle_table_account`), la cuenta pasa a `closed`, todos sus pedidos no cancelados actualizan `payment_status = 'Confirmación simulada'` y la mesa vuelve a `disponible`.
