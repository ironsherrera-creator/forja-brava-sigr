# Auditoría y Endurecimiento de Migraciones SQL
## FORJA BRAVA — SIGR (PostgreSQL 17 / Supabase)

**Estado:** Revisión estática y corrección completada sobre los 6 archivos en `supabase/migrations/`.  
**Ejecución en BD remota:** **No ejecutada** (pendiente de revisión final y autorización del propietario).

---

## 1. Hallazgos, riesgos y correcciones implementadas

| ID | Severidad | Hallazgo detectado en la versión previa | Riesgo técnico / de negocio | Corrección implementada |
|---|---|---|---|---|
| **SQL-01** | **Crítico** | Las funciones `SECURITY DEFINER` (`log_audit_event`, `recalculate_table_account_total`, triggers y RPCs) no revocaban el privilegio predeterminado `EXECUTE` de `PUBLIC`, `anon` ni `authenticated`, y usaban `SET search_path = public` sin anclar `pg_temp` al final. | Usuarios anónimos o clientes autenticados podían invocar por PostgREST `/rpc/log_audit_event` para inyectar registros falsos en `audit_logs` o `/rpc/recalculate_table_account_total`. | `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated` explícito en **todas** las funciones (migraciones 01, 03 y 05); `SET search_path = public, pg_temp` + referencias calificadas `public.*` / `pg_catalog.*`; `GRANT EXECUTE` mínimo por rol. |
| **SQL-02** | **Alto** | En `create_order`, cualquier `cliente` podía enviar `p_modality = 'mesa'` con cualquier `p_table_id` y ocupar mesas arbitrariamente; además un `mesero` podía invocar `create_order` con `domicilio` o `recoger`. | Bloqueo malicioso del salón por clientes externos y pedidos incoherentes creados por roles no autorizados. | Validación estricta rol × modalidad: `mesero` restringido a `mesa`; `cliente` bloqueado por defecto en `mesa` mediante `restaurant_settings.allow_client_table_orders = false` (decisión P-05 pendiente) y, aun si se activa, exige reserva propia vigente. Protección anti-suplantación (`p_customer_id`). |
| **SQL-03** | **Alto** | `create_order` aceptaba `p_reservation_id` sin verificar existencia, propiedad, estado, horario ni coincidencia con `p_table_id`, y permitía adjuntar reservas a domicilios o reutilizarlas en cuentas cerradas. | Suplantación de reservas de terceros, cruce de reservas entre mesas distintas y asociación inválida en domicilios. | Restricción SQL `chk_orders_reservation_only_mesa` + validación transaccional en `create_order` (`FOR UPDATE` sobre `reservations`, propiedad de cliente, estado `Confirmada`/`Atendida`, ventana activa, coincidencia con `table_id` y bloqueo de reutilización en cuentas cerradas). |
| **SQL-04** | **Alto** | `create_order` validaba `is_addon = true` pero omitía consultar `public.product_complements` y permitía enviar UUIDs duplicados dentro de `addon_ids`. | Adición de complementos no permitidos para un plato o cobro/registro anómalo por duplicados en el arreglo JSON. | Verificación `COUNT(*) = COUNT(DISTINCT val)` en `addon_ids` + `JOIN public.product_complements` obligatorio por línea + recálculo íntegro de precios y snapshots en PostgreSQL. |
| **SQL-05** | **Crítico** | Los pagos digitales confirmados en `create_order` (`domicilio`/`recoger`) no generaban fila en `cash_movements`, no validaban que la caja estuviera abierta, y faltaban RPCs para confirmar pagos `Efectivo` pendientes, abrir caja, registrar movimientos manuales y reembolsar. | Ventas cobradas fuera de arqueo de caja, imposibilidad de asentar cobros contra entrega y riesgo de insertar movimientos en sesiones de caja cerradas. | 1) Trigger `enforce_open_cash_session_on_movement` en `cash_movements` que impide insertar en sesiones cerradas. 2) En `create_order`, pagos digitales exigen caja abierta y crean `cash_movements` atómicamente. 3) Nuevas RPCs `open_cash_session`, `register_cash_movement`, `confirm_order_payment` y `refund_order_payment`. 4) `close_cash_session` excluye pagos `Reembolsado` y separa efectivo de digitales. |
| **SQL-06** | **Alto** | `settle_table_account` forzaba `restaurant_tables.status = 'disponible'` sin verificar reservas próximas/vigentes ni `fuera_de_servicio`, y permitía cerrar cuentas con comandas aún sin entregar. | Pérdida del estado visual `reservada` para reservas inmediatas y cierre prematuro de mesas con platos pendientes en cocina. | Nueva función interna `sync_table_status(uuid)` invocada en `create_reservation`, `cancel_reservation`, `create_order` y `settle_table_account`; bloqueo de cierre si quedan pedidos distintos de `Entregado`/`Cancelado`; reservas asociadas pasan a `Atendida`. |
| **SQL-07** | **Medio** | Faltaba inmutabilidad por trigger en `audit_logs`, `order_status_history` y `cash_movements`, protección `BEFORE DELETE` del último admin en `profiles`, y etiquetado explícito de configuración provisional. | Posibilidad de borrado accidental por funciones futuras y confusión entre valores semilla y datos definitivos. | Trigger `prevent_immutable_table_mutation` en las 3 tablas append-only; `BEFORE UPDATE OR DELETE` en `protect_profile_privileged_fields`; bandera `is_provisional_config = true` en `restaurant_settings`. |
| **SQL-08** | **Alto** | `refund_order_payment` actualizaba `payments.status` a `Reembolsado` sin registrar un movimiento de salida en `cash_movements`, y la restricción global `UNIQUE(payment_id)` impedía vincular el movimiento `'refund'` al pago original; además, excluir pagos `Reembolsado` en `close_cash_session` sin libro de reembolsos dejaba sin traza los reembolsos entre turnos (cross-shift). | Descuadre contable de efectivo físico y ventas digitales netas en arqueos de caja, pérdida de trazabilidad por turno y riesgo de doble resta o reembolso duplicado. | 1) En `cash_movements`: `movement_type` admite `'refund'`, se reemplaza `UNIQUE(payment_id)` por dos índices únicos parciales (`idx_cash_movements_one_sale_per_payment` y `idx_cash_movements_one_refund_per_payment`) y `chk_cash_movements_payment_ref_consistency`. 2) En `cash_sessions`: se añaden `total_cash_refunds`, `total_digital_refunds` y `net_digital_sales`. 3) `refund_order_payment` (exclusivo admin) exige caja abierta para movimientos > 0, impide duplicados, distingue reembolso en efectivo vs. digital, registra el movimiento `'refund'` con `payment_id` original sin alterar `orders.total` ni otros pedidos, y graba auditoría completa. 4) `close_cash_session` calcula `expected_cash = opening_balance + total_cash_sales - total_cash_refunds + manual_in - manual_out` y `net_digital_sales = total_digital_sales - total_digital_refunds` sin doble resta. |
| **SQL-09** | **Alto** | `refund_order_payment` exigía sesión de caja abierta pero no validaba si existía suficiente efectivo físico disponible en el turno abierto antes de autorizar un reembolso cuyo método original fuera `'Efectivo'`. | Posibilidad de registrar reembolsos en efectivo superiores al efectivo físico disponible en caja (produciendo `expected_cash` negativo). | En `refund_order_payment`, exclusivamente cuando `v_old_payment.method = 'Efectivo'` y `amount > 0`, se calcula bajo bloqueo `FOR UPDATE` de `cash_sessions`: `v_available_cash = opening_balance + ventas_efectivo + ingresos_manuales_efectivo - egresos_manuales_efectivo - reembolsos_efectivo`. Si `v_available_cash < amount`, lanza `INSUFFICIENT_CASH_FOR_REFUND`. Esta restricción **no** se aplica a reembolsos digitales (`Tarjeta`, `Nequi`, `PSE`). |

> **Nota sobre decisión funcional pendiente (P-05 — Pedidos en mesa iniciados por cliente):**  
> Conforme a las reglas actuales, los pedidos en salón los registra el `mesero` (D-05). Para no eliminar la capacidad técnica si el negocio decide habilitar pedidos autogestionados en mesa por clientes con reserva activa, se incorporó el parámetro `restaurant_settings.allow_client_table_orders` inicializado en **`false`**. Habilitarlo en producción requiere autorización funcional expresa.

---

## 2. Matriz de permisos de ejecución (`EXECUTE`) de funciones SQL

| Función | Tipo | `PUBLIC` | `anon` | `authenticated` | Validación interna de rol |
|---|---|---|---|---|---|
| `set_updated_at()` | Trigger | Revocado | Revocado | Revocado | Solo motor de triggers |
| `handle_new_auth_user()` | Trigger `SECURITY DEFINER` | Revocado | Revocado | Revocado | Solo trigger `auth.users` |
| `protect_profile_privileged_fields()` | Trigger `SECURITY DEFINER` | Revocado | Revocado | Revocado | Bloquea escalamiento y protege último admin |
| `prevent_immutable_table_mutation()` | Trigger | Revocado | Revocado | Revocado | Impide `UPDATE`/`DELETE` en bitácoras/caja |
| `enforce_open_cash_session_on_movement()` | Trigger `SECURITY DEFINER` | Revocado | Revocado | Revocado | Exige `cash_sessions.status = 'open'` |
| `log_audit_event(...)` | Interna `SECURITY DEFINER` | **Revocado** | **Revocado** | **Revocado** | Solo invocable por otras funciones `SECURITY DEFINER` |
| `recalculate_table_account_total(...)` | Interna `SECURITY DEFINER` | **Revocado** | **Revocado** | **Revocado** | Solo invocable internamente |
| `sync_table_status(...)` | Interna `SECURITY DEFINER` | **Revocado** | **Revocado** | **Revocado** | Solo invocable internamente |
| `current_user_role()` / `is_admin()` / `is_waiter()` | Auxiliar RLS `SECURITY DEFINER` | Revocado | Permitido | Permitido | Solo lectura sobre `auth.uid()` activo |
| `get_available_reservation_slots(...)` | RPC `SECURITY DEFINER` | Revocado | Permitido | Permitido | Solo lectura de conteo de cupos libres |
| `create_reservation(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | `cliente` (propia) o `administrador` |
| `cancel_reservation(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | `cliente` (propia + ventana) o `administrador` |
| `create_order(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | `cliente` (`domicilio`/`recoger`), `mesero` (`mesa`), `administrador` (todas) |
| `create_table_order(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | Exclusivo `mesero` o `administrador` |
| `update_order_status(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | `administrador` (todos); `mesero` solo D-05 (`Entregado` / `Cancelado` en `Pendiente`) |
| `request_table_account_close(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | Exclusivo `mesero` o `administrador` |
| `open_cash_session(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | Exclusivo `administrador` |
| `register_cash_movement(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | Exclusivo `administrador` |
| `confirm_order_payment(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | Exclusivo `administrador` |
| `refund_order_payment(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | Exclusivo `administrador` |
| `settle_table_account(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | Exclusivo `administrador` |
| `close_cash_session(...)` | RPC `SECURITY DEFINER` | Revocado | Revocado | Permitido | Exclusivo `administrador` |

---

## 3. Resumen de políticas RLS (19 tablas con RLS habilitado)

| # | Tabla | `anon` | `cliente` (`authenticated`) | `mesero` (`authenticated`) | `administrador` (`authenticated`) |
|---|---|---|---|---|---|
| 1 | `roles` | — | `SELECT` | `SELECT` | `SELECT` |
| 2 | `permissions` | — | — | — | `SELECT` |
| 3 | `role_permissions` | — | — | — | `SELECT` |
| 4 | `profiles` | — | `SELECT`/`UPDATE` propio (sin `role_id`, `is_active`, `email`) | `SELECT`/`UPDATE` propio | `SELECT`/`UPDATE` todos (último admin protegido) |
| 5 | `customer_addresses` | — | CRUD propio (`user_id = auth.uid()`) | CRUD propio | CRUD todos |
| 6 | `categories` | `SELECT` activas | `SELECT` activas | `SELECT` activas | `SELECT` todas + `INSERT`/`UPDATE`/`DELETE` |
| 7 | `products` | `SELECT` disponibles | `SELECT` disponibles | `SELECT` disponibles | `SELECT` todos + `INSERT`/`UPDATE`/`DELETE` |
| 8 | `product_complements` | `SELECT` | `SELECT` | `SELECT` | `SELECT` + `INSERT`/`UPDATE`/`DELETE` |
| 9 | `restaurant_settings` | `SELECT` | `SELECT` | `SELECT` | `SELECT` + `INSERT`/`UPDATE` |
| 10 | `restaurant_tables` | — | `SELECT` solo mesa de su propia reserva | `SELECT` todas | `SELECT` + `INSERT`/`UPDATE`/`DELETE` |
| 11 | `reservations` | — | `SELECT` propias (alta/cancelación vía RPC) | `SELECT` todas | `SELECT` + `UPDATE` + RPCs |
| 12 | `table_accounts` | — | — | `SELECT` (mutaciones vía RPC) | `SELECT` (mutaciones vía RPC) |
| 13 | `orders` | — | `SELECT` propios (alta vía RPC) | `SELECT` solo `modality = 'mesa'` (RPCs D-05) | `SELECT` todos + RPCs |
| 14 | `order_items` | — | `SELECT` de pedidos propios | `SELECT` de pedidos `mesa` | `SELECT` todos |
| 15 | `order_status_history` | — | `SELECT` de pedidos propios | `SELECT` de pedidos `mesa` | `SELECT` todos *(tabla inmutable)* |
| 16 | `payments` | — | `SELECT` de pedidos propios | — *(sin acceso financiero D-05)* | `SELECT` todos (mutaciones vía RPC) |
| 17 | `cash_sessions` | — | — | — | `SELECT` + RPCs `open`/`close` |
| 18 | `cash_movements` | — | — | — | `SELECT` + RPCs *(tabla inmutable)* |
| 19 | `audit_logs` | — | — | — | `SELECT` *(tabla inmutable)* |

---

## 4. Relaciones e integridad transaccional verificadas

- **Snapshots históricos:** `order_items` almacena `product_name_snapshot`, `unit_price_snapshot`, `addons_snapshot` y valida `line_total = (unit_price_snapshot * quantity) + addons_total`; `product_id` usa `ON DELETE RESTRICT`.
- **Pagos 100% simulados:** `payments.is_simulated` tiene `CHECK (is_simulated = true)` y referencia prefijada `DEMO-...`.
- **No doble contabilización ni duplicación de reembolsos:**
  - `chk_payments_exclusive_target`: un pago apunta a `order_id` **XOR** `table_account_id`.
  - `idx_payments_one_confirmed_per_order` e `idx_payments_one_confirmed_per_table_account`: impiden dos cobros confirmados.
  - `idx_cash_movements_one_sale_per_payment` e `idx_cash_movements_one_refund_per_payment` + `chk_cash_movements_payment_ref_consistency`: permiten exactamente **una venta (`sale`)** y a lo sumo **un reembolso (`refund`)** referenciando el mismo `payment_id` original, impidiendo duplicar ventas o reembolsos.
  - `trg_cash_movements_require_open_session`: impide registrar ventas, reembolsos o movimientos manuales en sesiones de caja cerradas.
  - **Fórmulas contables en `close_cash_session` (soporta reembolsos del mismo turno y de turnos anteriores sin doble resta):**
    - `expected_cash = opening_balance + total_cash_sales - total_cash_refunds + manual_cash_income - manual_cash_expense`
    - `net_digital_sales = total_digital_sales - total_digital_refunds`
    - `difference = counted_cash - expected_cash` (los reembolsos digitales nunca alteran `expected_cash`).
- **No solapamiento de reservas ni doble cuenta en mesa:**
  - `excl_reservations_no_overlap` (`EXCLUDE USING gist`) en `reservations`.
  - `idx_table_accounts_one_active_per_table` en `table_accounts`.

---

## 5. Suite de pruebas SQL pendientes de ejecución (Verificación post-push o en entorno local)

> **Nota:** Esta suite ha sido preparada para ejecutarse dentro de una transacción con `ROLLBACK;` final una vez se autorice aplicar las migraciones en Supabase. **No ha sido ejecutada aún contra la base de datos remota.**

```sql
-- ============================================================================
-- SUITE DE VERIFICACIÓN DE SEGURIDAD RLS, ROLES E INTEGRIDAD TRANSACCIONAL
-- Ejecutar en SQL Editor de Supabase (termina en ROLLBACK para no ensuciar datos)
-- ============================================================================
BEGIN;

-- 0. Preparar 4 usuarios simulados en auth.users (dispara on_auth_user_created -> rol 'cliente')
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin.test@forjabrava.local', '{"full_name":"Admin Test"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000b1', 'mesero.test@forjabrava.local', '{"full_name":"Mesero Test"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente1.test@forjabrava.local', '{"full_name":"Cliente Uno","phone":"3001112233"}'::jsonb),
  ('00000000-0000-0000-0000-0000000000c2', 'cliente2.test@forjabrava.local', '{"full_name":"Cliente Dos","phone":"3004445566"}'::jsonb);

-- Promover Admin y Mesero (como postgres/superuser de prueba) y crear 1 mesa de prueba
UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE code = 'administrador')
WHERE id = '00000000-0000-0000-0000-0000000000a1';

UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE code = 'mesero')
WHERE id = '00000000-0000-0000-0000-0000000000b1';

INSERT INTO public.restaurant_tables (id, code, zone, capacity, status)
VALUES ('00000000-0000-0000-0000-000000000071', 'M-TEST-01', 'Salón', 4, 'disponible');

-- ============================================================================
-- PRUEBA 1: Acceso Anónimo (anon) y protección de funciones SECURITY DEFINER
-- ============================================================================
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);

-- 1.1 Debe leer productos disponibles (> 0) y NO ver órdenes ni auditoría
SELECT count(*) AS anon_products FROM public.products;

-- 1.2 Debe FALLAR (permission denied) al intentar invocar funciones internas o autenticadas
SAVEPOINT sp_anon_audit;
DO $$ BEGIN
  PERFORM public.log_audit_event('orders', NULL, 'FAKE_EVENT', NULL, NULL);
  RAISE EXCEPTION 'FALLO DE SEGURIDAD: anon pudo ejecutar log_audit_event';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
RELEASE SAVEPOINT sp_anon_audit;

SAVEPOINT sp_anon_order;
DO $$ BEGIN
  PERFORM public.create_order('recoger', '[]'::jsonb);
  RAISE EXCEPTION 'FALLO DE SEGURIDAD: anon pudo ejecutar create_order';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
RELEASE SAVEPOINT sp_anon_order;

-- ============================================================================
-- PRUEBA 2: Administrador abre turno de caja
-- ============================================================================
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

SELECT (public.open_cash_session(100000, 'Apertura prueba')).id AS opened_cash_session_id;

-- ============================================================================
-- PRUEBA 3: Acceso de Cliente 1, anti-escalamiento, reserva, pedido y aislamiento
-- ============================================================================
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

-- 3.1 Debe FALLAR al intentar auto-asignarse rol administrador
SAVEPOINT sp_client_escalate;
DO $$ BEGIN
  UPDATE public.profiles
  SET role_id = (SELECT id FROM public.roles WHERE code = 'administrador')
  WHERE id = '00000000-0000-0000-0000-0000000000c1';
  RAISE EXCEPTION 'FALLO DE SEGURIDAD: cliente pudo cambiar su propio rol';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
RELEASE SAVEPOINT sp_client_escalate;

-- 3.2 Debe FALLAR al intentar ocupar una mesa arbitrariamente
SAVEPOINT sp_client_table_order;
DO $$ BEGIN
  PERFORM public.create_order(
    p_modality => 'mesa',
    p_items => jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE slug = 'forjada'), 'quantity', 1)),
    p_table_id => '00000000-0000-0000-0000-000000000071'
  );
  RAISE EXCEPTION 'FALLO DE SEGURIDAD: cliente pudo ocupar mesa sin autorización';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
RELEASE SAVEPOINT sp_client_table_order;

-- 3.3 Debe FALLAR si envía complementos duplicados o no relacionados
SAVEPOINT sp_client_dup_addon;
DO $$
DECLARE v_addon uuid;
BEGIN
  SELECT id INTO v_addon FROM public.products WHERE slug = 'adiciones';
  PERFORM public.create_order(
    p_modality => 'recoger',
    p_items => jsonb_build_array(jsonb_build_object(
      'product_id', (SELECT id FROM public.products WHERE slug = 'forjada'),
      'quantity', 1,
      'addon_ids', jsonb_build_array(v_addon, v_addon)
    )),
    p_payment_method => 'Efectivo'
  );
  RAISE EXCEPTION 'FALLO DE INTEGRIDAD: se permitieron complementos duplicados';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
RELEASE SAVEPOINT sp_client_dup_addon;

-- 3.4 Creación válida de pedido a domicilio con Nequi (registra pago simulado + movimiento en caja abierta)
SELECT (public.create_order(
  p_modality => 'domicilio',
  p_items => jsonb_build_array(jsonb_build_object(
    'product_id', (SELECT id FROM public.products WHERE slug = 'forjada'),
    'quantity', 2,
    'addon_ids', jsonb_build_array((SELECT id FROM public.products WHERE slug = 'adiciones'))
  )),
  p_payment_method => 'Nequi',
  p_delivery_address => 'Calle 85 # 15-20',
  p_delivery_neighborhood => 'Chapinero'
)).order_number;

-- 3.5 Creación de reserva futura para Cliente 1
SELECT (public.create_reservation(
  p_date => ((now() AT TIME ZONE 'America/Bogota')::date + 1),
  p_time => '19:00'::time,
  p_party_size => 2
)).reservation_code;

-- ============================================================================
-- PRUEBA 4: Aislamiento de Cliente 2 (no debe ver pedidos ni reservas de Cliente 1)
-- ============================================================================
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);

DO $$
DECLARE v_orders int; v_res int;
BEGIN
  SELECT count(*) INTO v_orders FROM public.orders;
  SELECT count(*) INTO v_res FROM public.reservations;
  IF v_orders <> 0 OR v_res <> 0 THEN
    RAISE EXCEPTION 'FALLO RLS: Cliente 2 pudo leer datos de Cliente 1';
  END IF;
END $$;

-- ============================================================================
-- PRUEBA 5: Flujo de Mesero (comanda en mesa, restricciones D-05 y solicitud de cierre D-04)
-- ============================================================================
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

DO $$
DECLARE
  v_order1 public.orders%ROWTYPE;
  v_order2 public.orders%ROWTYPE;
BEGIN
  -- 5.1 Mesero registra comanda 1 y la cancela estando en Pendiente (permitido por D-05)
  v_order1 := public.create_table_order(
    '00000000-0000-0000-0000-000000000071',
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE slug = 'perro-especial'), 'quantity', 1)),
    'Comanda cancelada rápido'
  );
  PERFORM public.update_order_status(v_order1.id, 'Cancelado', 'Cliente cambió de opinión');

  -- 5.2 Mesero registra comanda 2
  v_order2 := public.create_table_order(
    '00000000-0000-0000-0000-000000000071',
    jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE slug = 'doble-carbon'), 'quantity', 1)),
    'Término tres cuartos'
  );

  -- 5.3 Mesero NO puede pasar a En preparación (exclusivo Admin)
  BEGIN
    PERFORM public.update_order_status(v_order2.id, 'En preparación');
    RAISE EXCEPTION 'FALLO D-05: Mesero pudo cambiar estado de preparación';
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ============================================================================
-- PRUEBA 6: Administrador avanza preparación, Mesero entrega, Caja liquida mesa y cierra turno
-- ============================================================================
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

DO $$
DECLARE
  v_mesa_order_id uuid;
  v_account_id uuid;
  v_session_id uuid;
  v_closed public.cash_sessions%ROWTYPE;
BEGIN
  SELECT id, table_account_id INTO v_mesa_order_id, v_account_id
  FROM public.orders
  WHERE modality = 'mesa' AND status = 'Pendiente'
  LIMIT 1;

  -- Admin avanza preparación a Listo
  PERFORM public.update_order_status(v_mesa_order_id, 'Confirmado');
  PERFORM public.update_order_status(v_mesa_order_id, 'En preparación');
  PERFORM public.update_order_status(v_mesa_order_id, 'Listo');

  -- Mesero intenta cancelar en Listo (DEBE FALLAR) y luego marca Entregado (D-05)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
  BEGIN
    PERFORM public.update_order_status(v_mesa_order_id, 'Cancelado');
    RAISE EXCEPTION 'FALLO D-05: Mesero canceló un pedido que ya no estaba Pendiente';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  PERFORM public.update_order_status(v_mesa_order_id, 'Entregado');
  PERFORM public.request_table_account_close(v_account_id);

  -- Admin liquida cuenta de mesa en Efectivo ($35.900)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  PERFORM public.settle_table_account(v_account_id, 'Efectivo');
END $$;

-- ============================================================================
-- PRUEBA 7: Pagos confirmados (Efectivo y Digital), Reembolsos (Efectivo y Digital),
--           Aislamiento de totales de otros pedidos, Rechazo de duplicados y Arqueo Final
-- ============================================================================
DO $$
DECLARE
  v_cash_order public.orders%ROWTYPE;
  v_digital_order public.orders%ROWTYPE;
  v_untouched_order public.orders%ROWTYPE;
  v_untouched_total_before numeric(12,2);
  v_untouched_total_after numeric(12,2);
  v_session_id uuid;
  v_closed public.cash_sessions%ROWTYPE;
  v_refund_cash_count int;
  v_refund_digital_count int;
BEGIN
  -- 7.1 Cliente 1 crea 3 pedidos individuales:
  --     a) Recoger en Efectivo (Perro Tradicional $16.900 -> pago Pendiente)
  --     b) Recoger con Tarjeta (La Brava $31.900 -> pago Confirmación simulada + movimiento sale digital)
  --     c) Recoger en Efectivo que NO será reembolsado (Choripapa $24.900)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

  v_cash_order := public.create_order(
    p_modality => 'recoger',
    p_items => jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE slug = 'perro-tradicional'), 'quantity', 1)),
    p_payment_method => 'Efectivo'
  );

  v_digital_order := public.create_order(
    p_modality => 'recoger',
    p_items => jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE slug = 'brava'), 'quantity', 1)),
    p_payment_method => 'Tarjeta'
  );

  v_untouched_order := public.create_order(
    p_modality => 'recoger',
    p_items => jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE slug = 'choripapa'), 'quantity', 1)),
    p_payment_method => 'Efectivo'
  );
  v_untouched_total_before := v_untouched_order.total;

  -- 7.2 Mesero NO puede confirmar pagos ni emitir reembolsos (exclusivo Administrador)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
  BEGIN
    PERFORM public.confirm_order_payment(v_cash_order.id, 'Efectivo');
    RAISE EXCEPTION 'FALLO DE SEGURIDAD: mesero pudo confirmar un pago';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.refund_order_payment(v_digital_order.id, 'Intento no autorizado');
    RAISE EXCEPTION 'FALLO DE SEGURIDAD: mesero pudo emitir un reembolso';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 7.3 Administrador confirma cobros en Efectivo de v_cash_order ($16.900) y v_untouched_order ($24.900)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  PERFORM public.confirm_order_payment(v_cash_order.id, 'Efectivo');
  PERFORM public.confirm_order_payment(v_untouched_order.id, 'Efectivo');

  -- 7.4 Confirmar dos veces el mismo pago DEBE FALLAR
  BEGIN
    PERFORM public.confirm_order_payment(v_cash_order.id, 'Efectivo');
    RAISE EXCEPTION 'FALLO DE INTEGRIDAD: se permitió confirmar dos veces el mismo pago';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 7.5 Reembolsar un pedido NO cancelado DEBE FALLAR
  BEGIN
    PERFORM public.refund_order_payment(v_cash_order.id, 'Sin cancelar');
    RAISE EXCEPTION 'FALLO DE INTEGRIDAD: se reembolsó un pedido no cancelado';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 7.6 Admin cancela v_cash_order ($16.900 Efectivo) y v_digital_order ($31.900 Tarjeta) y los reembolsa
  PERFORM public.update_order_status(v_cash_order.id, 'Cancelado', 'Cancelación prueba efectivo');
  PERFORM public.update_order_status(v_digital_order.id, 'Cancelado', 'Cancelación prueba digital');

  PERFORM public.refund_order_payment(v_cash_order.id, 'Devolución en efectivo');
  PERFORM public.refund_order_payment(v_digital_order.id, 'Devolución a tarjeta');

  -- 7.7 Duplicar un reembolso DEBE FALLAR
  BEGIN
    PERFORM public.refund_order_payment(v_cash_order.id, 'Reembolso duplicado');
    RAISE EXCEPTION 'FALLO DE INTEGRIDAD: se permitió duplicar un reembolso';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 7.8 Verificar trazabilidad diferenciada en cash_movements (efectivo vs digital) con payment_id original
  SELECT count(*) INTO v_refund_cash_count
  FROM public.cash_movements cm
  JOIN public.payments p ON p.id = cm.payment_id
  WHERE cm.movement_type = 'refund'
    AND cm.payment_method = 'Efectivo'
    AND p.order_id = v_cash_order.id
    AND cm.amount = 16900;

  SELECT count(*) INTO v_refund_digital_count
  FROM public.cash_movements cm
  JOIN public.payments p ON p.id = cm.payment_id
  WHERE cm.movement_type = 'refund'
    AND cm.payment_method = 'Tarjeta'
    AND p.order_id = v_digital_order.id
    AND cm.amount = 31900;

  IF v_refund_cash_count <> 1 OR v_refund_digital_count <> 1 THEN
    RAISE EXCEPTION 'FALLO DE TRAZABILIDAD: movimientos de reembolso incompletos (cash=%, digital=%)', v_refund_cash_count, v_refund_digital_count;
  END IF;

  -- 7.9 Verificar que el total de otro pedido (v_untouched_order) NO fue alterado
  SELECT total INTO v_untouched_total_after FROM public.orders WHERE id = v_untouched_order.id;
  IF v_untouched_total_after <> v_untouched_total_before THEN
    RAISE EXCEPTION 'FALLO DE AISLAMIENTO: el reembolso alteró el total de otro pedido';
  END IF;

  -- 7.10 Cierre de sesión de caja y verificación matemática exacta:
  --      Base inicial: $100.000
  --      Ventas Efectivo brutas: Mesa ($35.900) + v_cash_order ($16.900) + v_untouched_order ($24.900) = $77.700
  --      Reembolsos Efectivo: $16.900
  --      => expected_cash = 100.000 + 77.700 - 16.900 = $160.800
  --      Ventas Digitales brutas: Prueba 3.4 Nequi ((28.900+8.900)*2 = $75.600) + v_digital_order Tarjeta ($31.900) = $107.500
  --      Reembolsos Digitales: $31.900
  --      => net_digital_sales = 107.500 - 31.900 = $75.600
  SELECT id INTO v_session_id FROM public.cash_sessions WHERE status = 'open';
  v_closed := public.close_cash_session(v_session_id, 160800, 'Arqueo exacto con reembolsos efectivo y digital');

  IF v_closed.expected_cash <> 160800
     OR v_closed.difference <> 0
     OR v_closed.total_cash_sales <> 77700
     OR v_closed.total_cash_refunds <> 16900
     OR v_closed.total_digital_sales <> 107500
     OR v_closed.total_digital_refunds <> 31900
     OR v_closed.net_digital_sales <> 75600 THEN
    RAISE EXCEPTION 'FALLO DE ARQUEO: %', to_jsonb(v_closed);
  END IF;

  -- 7.11 Con caja CERRADA, intentar reembolsar un pedido en Efectivo DEBE FALLAR (CASH_CLOSED)
  PERFORM public.update_order_status(v_untouched_order.id, 'Cancelado', 'Cancelado con caja cerrada');
  BEGIN
    PERFORM public.refund_order_payment(v_untouched_order.id, 'Debe fallar por caja cerrada');
    RAISE EXCEPTION 'FALLO DE INTEGRIDAD: se permitió reembolso en efectivo con caja cerrada';
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ============================================================================
-- PRUEBA 8: Validación de disponibilidad de efectivo en reembolsos (SQL-09)
--           - Reembolso en efectivo con saldo insuficiente -> INSUFFICIENT_CASH_FOR_REFUND
--           - Reembolso digital con $0 efectivo físico -> permitido sin afectar efectivo
--           - Reembolso en efectivo tras ingreso suficiente -> permitido y exacto
--           - Rechazo de reembolso duplicado
-- ============================================================================
DO $$
DECLARE
  v_session2 public.cash_sessions%ROWTYPE;
  v_order_cash_insuff public.orders%ROWTYPE;
  v_order_digital_zero_cash public.orders%ROWTYPE;
  v_closed2 public.cash_sessions%ROWTYPE;
BEGIN
  -- 8.1 Admin abre Turno 2 con base inicial = $0 en efectivo
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  v_session2 := public.open_cash_session(0, 'Turno 2 prueba liquidez efectivo');

  -- 8.2 Cliente 1 crea pedido digital PSE ($28.900 La Forjada) y pedido en Efectivo ($28.900 La Forjada)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
  v_order_digital_zero_cash := public.create_order(
    p_modality => 'recoger',
    p_items => jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE slug = 'forjada'), 'quantity', 1)),
    p_payment_method => 'PSE'
  );
  v_order_cash_insuff := public.create_order(
    p_modality => 'recoger',
    p_items => jsonb_build_array(jsonb_build_object('product_id', (SELECT id FROM public.products WHERE slug = 'forjada'), 'quantity', 1)),
    p_payment_method => 'Efectivo'
  );

  -- 8.3 Admin confirma cobro en efectivo ($28.900) y registra un egreso manual de $20.000 (quedan solo $8.900 en caja)
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  PERFORM public.confirm_order_payment(v_order_cash_insuff.id, 'Efectivo');
  PERFORM public.register_cash_movement('manual_expense', 'Efectivo', 20000, 'Compra insumos menores');

  -- 8.4 Cancelar ambos pedidos
  PERFORM public.update_order_status(v_order_cash_insuff.id, 'Cancelado', 'Prueba saldo insuficiente');
  PERFORM public.update_order_status(v_order_digital_zero_cash.id, 'Cancelado', 'Prueba digital sin efectivo');

  -- 8.5 Reembolso en EFECTIVO de $28.900 con solo $8.900 disponibles DEBE FALLAR con INSUFFICIENT_CASH_FOR_REFUND
  BEGIN
    PERFORM public.refund_order_payment(v_order_cash_insuff.id, 'Debe fallar por falta de efectivo');
    RAISE EXCEPTION 'FALLO SQL-09: se permitió reembolso en efectivo sin saldo suficiente';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%INSUFFICIENT_CASH_FOR_REFUND%' THEN
        RAISE EXCEPTION 'Error inesperado al validar liquidez: %', SQLERRM;
      END IF;
  END;

  -- 8.6 Reembolso DIGITAL ($28.900 PSE) DEBE PERMITIRSE aunque solo haya $8.900 en efectivo físico
  PERFORM public.refund_order_payment(v_order_digital_zero_cash.id, 'Reembolso PSE no requiere efectivo físico');

  -- 8.7 Rechazo de reembolso duplicado sobre el pedido digital
  BEGIN
    PERFORM public.refund_order_payment(v_order_digital_zero_cash.id, 'Reembolso digital duplicado');
    RAISE EXCEPTION 'FALLO DE INTEGRIDAD: se permitió duplicar reembolso digital';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 8.8 Admin registra ingreso manual de $20.000 en efectivo (disponible = $8.900 + $20.000 = $28.900)
  --     Ahora el reembolso en efectivo de $28.900 SÍ debe aprobarse y dejar expected_cash = $0
  PERFORM public.register_cash_movement('manual_income', 'Efectivo', 20000, 'Reposición caja menor');
  PERFORM public.refund_order_payment(v_order_cash_insuff.id, 'Reembolso efectivo con saldo suficiente');

  -- 8.9 Cierre del Turno 2:
  --     expected_cash = 0 (base) + 28.900 (venta) + 20.000 (ingreso) - 20.000 (egreso) - 28.900 (reembolso) = 0
  --     net_digital_sales = 28.900 (PSE) - 28.900 (reembolso PSE) = 0
  v_closed2 := public.close_cash_session(v_session2.id, 0, 'Cierre Turno 2 prueba liquidez');
  IF v_closed2.expected_cash <> 0
     OR v_closed2.difference <> 0
     OR v_closed2.total_cash_refunds <> 28900
     OR v_closed2.total_digital_refunds <> 28900
     OR v_closed2.net_digital_sales <> 0 THEN
    RAISE EXCEPTION 'FALLO DE ARQUEO TURNO 2: %', to_jsonb(v_closed2);
  END IF;
END $$;

ROLLBACK;
```
