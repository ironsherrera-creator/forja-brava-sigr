# Auditoría Final de Seguridad — Migración 07 (`least_privilege_table_grants`)
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Fecha de auditoría:** 2026-11-24  
**Archivo auditado:** [20261124210007_least_privilege_table_grants.sql](file:///c:/Users/Sebastian/Documents/Urestaurante/supabase/migrations/20261124210007_least_privilege_table_grants.sql)  
**Base de contraste:** Migraciones `01` a `06` (`20261123221001` .. `20261123221006`), las 19 tablas del esquema `public`, todas las políticas RLS de la Migración `04`, las 24 funciones SQL/RPC de las Migraciones `01`, `03` y `05`, triggers de integridad/seguridad, secuencias y claves foráneas.  
**Restricciones cumplidas:** Auditoría estrictamente estática y documental; no se ejecutó `supabase db push` ni `db reset`, no se modificó la base de datos remota, no se editaron las migraciones `01..07` y no se realizaron `commits` ni `push`.

---

## 1. Contexto técnico del problema que resuelve la Migración 07

En PostgreSQL y PostgREST (Supabase), el control de acceso a tablas opera en **dos barreras secuenciales obligatorias**:

1. **Capa 1 — Privilegios discrecionales de objeto (`GRANT` / ACL de PostgreSQL):** determina si el rol de conexión (`anon` o `authenticated`) puede siquiera intentar `SELECT`, `INSERT`, `UPDATE` o `DELETE` sobre la tabla. Si falta este permiso, PostgreSQL aborta inmediatamente con código `42501 (permission denied for table ...)`, sin llegar a evaluar las políticas RLS.
2. **Capa 2 — Row Level Security (`ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`):** filtra qué filas puede leer (`USING`) o escribir (`WITH CHECK`) cada usuario concreto según `auth.uid()`, `public.current_user_role()`, `public.is_admin()` y `public.is_waiter()`.

Durante la verificación no destructiva en vivo de la Etapa 3 se comprobó que las migraciones `01..06` implementaron íntegramente la **Capa 2** (RLS en las 19 tablas) y los permisos de las 24 funciones, pero omitieron los `GRANT` explícitos de la **Capa 1** sobre las tablas. La Migración `07` introduce exclusivamente esa Capa 1 bajo el principio de mínimo privilegio.

---

## 2. Matriz maestra por tabla: Privilegios (`GRANT`) vs. Políticas RLS

La siguiente matriz contrasta las **19 tablas** del esquema `public` celda por celda (`anon` y `authenticated`) frente a las políticas RLS definidas en [20261123221004_rls_policies_and_storage.sql](file:///c:/Users/Sebastian/Documents/Urestaurante/supabase/migrations/20261123221004_rls_policies_and_storage.sql):

| # | Tabla (`public.*`) | `GRANT` a `anon` (Mig. 07) | `GRANT` a `authenticated` (Mig. 07) | Políticas RLS aplicables (Mig. 04) | Controles adicionales (Triggers / RPCs / Constraints) | Resultado |
|---|---|---|---|---|---|---|
| 1 | `roles` | *(ninguno)* | `SELECT` | `roles_select_authenticated` (`SELECT` -> `true`). Sin políticas de escritura. | Creación/semilla solo por migración o fallback `SECURITY DEFINER` en `handle_new_auth_user`. | **CORRECTO** |
| 2 | `permissions` | *(ninguno)* | `SELECT` | `permissions_select_admin` (`SELECT` -> `public.is_admin()`). Sin políticas de escritura. | Solo `administrador` activo ve filas; `cliente` y `mesero` reciben `0` filas. | **CORRECTO** |
| 3 | `role_permissions` | *(ninguno)* | `SELECT` | `role_permissions_select_admin` (`SELECT` -> `public.is_admin()`). Sin políticas de escritura. | Solo `administrador` activo ve filas; inmutable desde clientes API. | **CORRECTO** |
| 4 | `profiles` | *(ninguno)* | `SELECT, UPDATE` | `profiles_select_own_or_admin` (`id = auth.uid() OR is_admin()`); `profiles_update_own_or_admin` (`USING` y `WITH CHECK`: `id = auth.uid() OR is_admin()`). | `INSERT` exclusivo por trigger `on_auth_user_created` (rol fijo `cliente`). `BEFORE UPDATE OR DELETE` trigger `trg_protect_profile_privileged_fields` bloquea cambios a `id`, `role_id`, `is_active`, `email` por no-admins y protege al último admin activo. Sin `DELETE` grant. | **CORRECTO** |
| 5 | `customer_addresses` | *(ninguno)* | `SELECT, INSERT, UPDATE, DELETE` | `customer_addresses_select_own_or_admin`, `_insert_own`, `_update_own`, `_delete_own` (`user_id = auth.uid() OR is_admin()`). | PK `gen_random_uuid()`; índice único parcial `idx_customer_addresses_one_default`. Aislamiento total entre clientes. | **CORRECTO** |
| 6 | `categories` | `SELECT` | `SELECT, INSERT, UPDATE, DELETE` | `categories_select_public` (`anon, authenticated`: `is_active = true OR is_admin()`); `_admin_insert`, `_admin_update`, `_admin_delete` (`is_admin()`). | PK `gen_random_uuid()`; `FK` en `products` con `ON DELETE RESTRICT` impide borrar categorías con productos. | **CORRECTO** |
| 7 | `products` | `SELECT` | `SELECT, INSERT, UPDATE, DELETE` | `products_select_public` (`anon, authenticated`: `is_available = true OR is_admin()`); `_admin_insert`, `_admin_update`, `_admin_delete` (`is_admin()`). | PK `gen_random_uuid()`; `anon` solo ve productos disponibles; escritura exclusiva de `administrador` activo. | **CORRECTO** |
| 8 | `product_complements` | `SELECT` | `SELECT, INSERT, UPDATE, DELETE` | `product_complements_select_public` (`anon, authenticated`: `true`); `_admin_insert`, `_admin_update`, `_admin_delete` (`is_admin()`). | PK compuesta `(product_id, complement_id)`; `chk_product_complement_distinct`. Escritura exclusiva de `administrador`. | **CORRECTO** |
| 9 | `restaurant_settings` | `SELECT` | `SELECT, INSERT, UPDATE` | `restaurant_settings_select_public` (`anon, authenticated`: `true`); `_admin_insert`, `_admin_update` (`is_admin()`). Sin política `DELETE`. | Singleton `id = 1 CHECK (id = 1)`. No se otorga `DELETE` ni siquiera a `authenticated`, impidiendo borrado accidental de la fila singleton. | **CORRECTO** |
| 10 | `restaurant_tables` | *(ninguno)* | `SELECT, INSERT, UPDATE, DELETE` | `restaurant_tables_select_roles` (`is_admin() OR is_waiter() OR EXISTS (reserva propia)`); `_admin_insert`, `_admin_update`, `_admin_delete` (`is_admin()`). | PK `gen_random_uuid()`; `anon` no ve inventario interno de mesas (consulta disponibilidad vía RPC `get_available_reservation_slots`). Escritura exclusiva de `administrador`. | **CORRECTO** |
| 11 | `reservations` | *(ninguno)* | `SELECT, UPDATE` | `reservations_select_authorized` (`customer_id = auth.uid() OR is_waiter() OR is_admin()`); `reservations_admin_write` (`FOR UPDATE`: `is_admin()`). Sin `INSERT`/`DELETE`. | Creación y cancelación de clientes canalizadas vía RPCs `create_reservation` y `cancel_reservation`; `UPDATE` directo restringido por RLS a `is_admin()`; constraint GiST `excl_reservations_no_overlap`. | **CORRECTO** |
| 12 | `table_accounts` | *(ninguno)* | `SELECT` | `table_accounts_select_staff` (`is_waiter() OR is_admin()`). Sin políticas de escritura directa. | Mutaciones exclusivas mediante RPCs `create_order`, `request_table_account_close` y `settle_table_account`. Clientes sin visibilidad. | **CORRECTO** |
| 13 | `orders` | *(ninguno)* | `SELECT` | `orders_select_authorized` (`customer_id = auth.uid() OR is_admin() OR (is_waiter() AND modality = 'mesa')`). Sin escritura directa. | Creación, cambio de estado y pago exclusivos vía RPCs `create_order`, `create_table_order`, `update_order_status`, `confirm_order_payment`, `refund_order_payment`, `settle_table_account`. | **CORRECTO** |
| 14 | `order_items` | *(ninguno)* | `SELECT` | `order_items_select_authorized` (hereda visibilidad exacta del pedido padre en `orders`). Sin escritura directa. | Inserción de snapshots inmutables exclusivamente dentro de `create_order`. | **CORRECTO** |
| 15 | `order_status_history` | *(ninguno)* | `SELECT` | `order_status_history_select_authorized` (hereda visibilidad exacta del pedido padre en `orders`). Sin escritura directa. | Append-only vía RPCs; trigger `trg_order_status_history_immutable` bloquea `UPDATE` y `DELETE` incluso para propietarios. | **CORRECTO** |
| 16 | `payments` | *(ninguno)* | `SELECT` | `payments_select_authorized` (`is_admin()` o cliente dueño de `order_id IS NOT NULL`). Sin escritura directa. | `mesero` no tiene acceso ni siquiera de lectura financiera (cumple D-05). Escritura exclusiva vía RPCs de pedido/caja. | **CORRECTO** |
| 17 | `cash_sessions` | *(ninguno)* | `SELECT` | `cash_sessions_admin_select` (`is_admin()`). Sin escritura directa. | Apertura y arqueo/cierre exclusivos mediante RPCs `open_cash_session` y `close_cash_session` (solo `administrador`). | **CORRECTO** |
| 18 | `cash_movements` | *(ninguno)* | `SELECT` | `cash_movements_admin_select` (`is_admin()`). Sin escritura directa. | Inserción exclusiva vía RPCs + trigger `trg_cash_movements_require_open_session` + trigger inmutable `trg_cash_movements_immutable`. | **CORRECTO** |
| 19 | `audit_logs` | *(ninguno)* | `SELECT` | `audit_logs_admin_select` (`is_admin()`). Sin escritura directa. | Inserción exclusiva vía función privada `log_audit_event` + trigger inmutable `trg_audit_logs_immutable`. | **CORRECTO** |

---

## 3. Desarrollo de las 12 comprobaciones obligatorias

### 3.1. Correspondencia 1:1 entre cada `GRANT` y las políticas RLS
- **Estado:** **CORRECTO**
- Se verificaron las `19 tablas × 4 verbos DML × 2 roles = 152 combinaciones de permisos`.
- **Ninguna tabla** recibe en la Migración `07` un verbo (`SELECT`, `INSERT`, `UPDATE` o `DELETE`) que no tenga una política RLS explícita para ese rol en la Migración `04`, ni queda ninguna política RLS de la Migración `04` desprovista de su `GRANT` correspondiente.
- Previamente a otorgar permisos, las líneas 25–26 ejecutan `REVOKE ALL PRIVILEGES ON ALL TABLES` y `ALL SEQUENCES` para `anon` y `authenticated`, eliminando cualquier permiso residual no documentado.

### 3.2. Exposición exclusiva de información pública al rol `anon`
- **Estado:** **CORRECTO**
- `anon` únicamente posee `SELECT` en 4 tablas: `categories`, `products`, `product_complements` y `restaurant_settings`.
- En `categories` y `products`, como `auth.uid()` es `NULL` para `anon`, `public.is_admin()` evalúa a `false`, por lo que `anon` solo puede leer categorías con `is_active = true` y productos con `is_available = true`.
- En las 15 tablas restantes (`profiles`, `roles`, `permissions`, `role_permissions`, `customer_addresses`, `restaurant_tables`, `reservations`, `table_accounts`, `orders`, `order_items`, `order_status_history`, `payments`, `cash_sessions`, `cash_movements`, `audit_logs`), `anon` carece tanto de privilegio `GRANT` como de políticas RLS (doble barrera).
- *Nota informativa menor (sin fuga de PII):* `restaurant_settings` contiene la columna `updated_by` (`uuid` anulable que referencia `profiles.id`, actualmente `NULL`). Dado que `anon` tiene bloqueo total sobre `profiles`, dicho UUID opaco no expone nombre, correo ni teléfono de ningún usuario; reemplazar `GRANT SELECT ON TABLE` por `GRANT SELECT (columnas)` rompería consultas `SELECT *` estándar de PostgREST, por lo que mantener `GRANT SELECT` de tabla es la decisión correcta.

### 3.3. Aislamiento entre clientes (lectura y escritura)
- **Estado:** **CORRECTO**
- Un usuario con rol `cliente` no puede leer ni alterar registros de otros clientes en ninguna tabla:
  - `profiles`: `id = auth.uid()`.
  - `customer_addresses`: `user_id = auth.uid()` tanto en `USING` como en `WITH CHECK` (impide leer direcciones ajenas o insertar/reasignar una dirección con el `user_id` de otro cliente).
  - `reservations`: lectura limitada a `customer_id = auth.uid()`; sin `INSERT`/`DELETE` directos y con `UPDATE` restringido a `is_admin()`. En las RPCs `create_reservation` y `cancel_reservation` se valida explícitamente `p_customer_id <> auth.uid()` y `v_old.customer_id <> auth.uid()`.
  - `restaurant_tables`: un cliente solo puede resolver datos de una mesa si tiene una reserva propia asociada a ese `table_id`.
  - `orders`, `order_items`, `order_status_history`, `payments`: solo `SELECT` filtrando `customer_id = auth.uid()`.

### 3.4. Imposibilidad de operaciones administrativas por parte del rol `mesero`
- **Estado:** **CORRECTO**
- Aunque `mesero` se conecta bajo el rol PostgreSQL `authenticated`, todas las tablas tienen `ENABLE ROW LEVEL SECURITY`:
  - Cualquier intento de un `mesero` de ejecutar `INSERT`, `UPDATE` o `DELETE` sobre `categories`, `products`, `product_complements`, `restaurant_tables`, `restaurant_settings` o `UPDATE` sobre `reservations` falla en RLS porque todas esas políticas exigen `public.is_admin()`.
  - Un `mesero` no puede leer `payments`, `cash_sessions`, `cash_movements`, `audit_logs`, `permissions` ni `role_permissions` (cumpliendo estrictamente la decisión funcional **D-05**).
  - En las RPCs transaccionales, `open_cash_session`, `register_cash_movement`, `confirm_order_payment`, `refund_order_payment`, `settle_table_account` y `close_cash_session` exigen `public.is_admin()`, mientras `update_order_status` restringe al `mesero` exclusivamente a pedidos de `modality = 'mesa'` y a las transiciones `Pendiente -> Cancelado` y `Listo -> Entregado`.

### 3.5. Exclusividad del administrador sobre catálogo, mesas y configuración
- **Estado:** **CORRECTO**
- Solo un usuario autenticado cuyo perfil cumpla `is_active = true` y `roles.code = 'administrador'` (`public.is_admin() = true`) supera las políticas `WITH CHECK (public.is_admin())` y `USING (public.is_admin())` en `categories`, `products`, `product_complements`, `restaurant_tables` y `restaurant_settings`.
- Adicionalmente, en `restaurant_settings` no se concede `DELETE`, protegiendo la integridad del registro singleton (`id = 1`).

### 3.6. Prevención de escalada de privilegios en `profiles`
- **Estado:** **CORRECTO**
- **Sin auto-inserción ni borrado:** `authenticated` solo recibe `SELECT, UPDATE` sobre `profiles` (sin `INSERT` ni `DELETE`). El alta ocurre únicamente vía trigger `on_auth_user_created` (`handle_new_auth_user`), que asigna de forma fija el rol `cliente`.
- **Protección de columnas privilegiadas:** el trigger `trg_protect_profile_privileged_fields` (`BEFORE UPDATE OR DELETE ON public.profiles`, `SECURITY DEFINER`) intercepta cualquier `UPDATE` directo desde PostgREST y lanza excepción si un usuario no administrador intenta modificar `id` (`FORBIDDEN_ID_CHANGE`), `role_id` (`FORBIDDEN_ROLE_CHANGE`), `is_active` (`FORBIDDEN_STATUS_CHANGE`) o `lower(email)` (`FORBIDDEN_EMAIL_CHANGE`).
- **Protección del último administrador y de cuentas desactivadas:** el mismo trigger impide degradar o desactivar al último `administrador` activo (`LAST_ADMIN_PROTECTED`). Si un administrador es desactivado (`is_active = false`), `public.current_user_role()` retorna `NULL` de forma inmediata (`WHERE p.id = auth.uid() AND p.is_active = true`), por lo que `public.is_admin()` pasa a `false` incluso si su JWT aún no ha expirado, impidiéndole reactivarse a sí mismo.
- *Observación de endurecimiento futuro (no bloqueante, sin escalada de privilegios):* en una iteración posterior (Etapa 9 / Gestión de Usuarios) sería recomendable congelar también `NEW.created_at` dentro de `protect_profile_privileged_fields()` y agregar `AND is_active = true` en la política `profiles_update_own_or_admin` / `customer_addresses_*_own` de la Migración `04` para impedir que una cuenta recién desactivada con JWT aún vigente edite su propio nombre/teléfono o libreta de direcciones antes de que expire el token. Esto no constituye escalada de privilegios ni afecta la seguridad de la Migración `07`.

### 3.7. Restricción administrativa sobre `permissions` y `role_permissions`
- **Estado:** **CORRECTO**
- `anon`: sin ningún permiso.
- `authenticated`: únicamente `SELECT` (sin `INSERT`, `UPDATE` ni `DELETE`), gobernado por las políticas `permissions_select_admin` y `role_permissions_select_admin` (`USING (public.is_admin())`). Ни `cliente` ni `mesero` pueden enumerar la matriz interna de permisos, y ningún usuario API puede alterarla.

### 3.8. Permisos de tabla/secuencia requeridos por las 24 funciones SQL/RPC y comprobación `SECURITY DEFINER` (Comprobaciones 8 y 12)
- **Estado:** **CORRECTO**
- Se auditaron las **24 funciones** definidas en las migraciones `01`, `03` y `05`:

| Grupo | Funciones (24 en total) | Modo de ejecución | Dependencia de permisos de `anon` / `authenticated` | Estado |
|---|---|---|---|---|
| Triggers utilitarios sin acceso a tablas (2) | `set_updated_at`, `prevent_immutable_table_mutation` | `SECURITY INVOKER` (trigger `BEFORE`) | **Ninguna:** solo asignan `NEW.updated_at := pg_catalog.now()` o ejecutan `RAISE EXCEPTION`. No consultan tablas ni secuencias. | **CORRECTO** |
| Triggers de seguridad e integridad (3) | `handle_new_auth_user`, `protect_profile_privileged_fields`, `enforce_open_cash_session_on_movement` | `SECURITY DEFINER` (`search_path = public, pg_temp`) | **Ninguna:** se ejecutan con los privilegios del rol propietario de la migración, que conserva el 100 % de permisos sobre tablas y secuencias. | **CORRECTO** |
| Helpers de autorización RLS (3) | `current_user_role`, `is_admin`, `is_waiter` | `SECURITY DEFINER` (`search_path = public, pg_temp`) | **Ninguna:** leen `profiles` y `roles` como propietario; `GRANT EXECUTE TO anon, authenticated` se conserva intacto. | **CORRECTO** |
| Funciones internas privadas (3) | `log_audit_event`, `recalculate_table_account_total`, `sync_table_status` | `SECURITY DEFINER` (`search_path = public, pg_temp`) | **Ninguna:** ejecución revocada a `PUBLIC, anon, authenticated`; invocadas solo desde RPCs propietarias. | **CORRECTO** |
| RPC pública de reservas (1) | `get_available_reservation_slots` | `SECURITY DEFINER` (`search_path = public, pg_temp`) | **Ninguna:** requiere únicamente `USAGE ON SCHEMA public` (otorgado en línea 23 de Mig. 07) y su `GRANT EXECUTE` ya existente en Mig. 05. | **CORRECTO** |
| RPCs operativas autenticadas (12) | `create_reservation`, `cancel_reservation`, `create_order`, `create_table_order`, `update_order_status`, `open_cash_session`, `register_cash_movement`, `confirm_order_payment`, `refund_order_payment`, `request_table_account_close`, `settle_table_account`, `close_cash_session` | `SECURITY DEFINER` (`search_path = public, pg_temp`) | **Ninguna:** ejecutan lecturas, escrituras y bloqueos `FOR UPDATE` como propietario de las tablas, validando internamente `auth.uid()`, `is_active = true` y rol efectivo. | **CORRECTO** |

- Además, las líneas 25–26 de la Migración `07` revocan privilegios exclusivamente `FROM anon, authenticated` (nunca del propietario de las funciones ni sobre `ALL FUNCTIONS`), por lo que ningún `GRANT EXECUTE` existente ni ningún permiso interno de `SECURITY DEFINER` se ve afectado.

### 3.9. Impacto de revocar todos los permisos de secuencias (`REVOKE ALL ON ALL SEQUENCES`)
- **Estado:** **CORRECTO**
- El escaneo exhaustivo de las migraciones `01..06` demuestra que en el esquema `public` existen **únicamente dos secuencias**:
  1. `public.roles_id_seq` (`roles.id smallserial PRIMARY KEY`).
  2. `public.permissions_id_seq` (`permissions.id smallserial PRIMARY KEY`).
- Ni `anon` ni `authenticated` tienen permiso `INSERT` directo sobre `roles` o `permissions`.
- Todas las tablas donde `authenticated` realiza `INSERT` directo (`customer_addresses`, `categories`, `products`, `restaurant_tables`) generan su clave primaria mediante `pg_catalog.gen_random_uuid()` (función nativa de PostgreSQL 13+ que no utiliza secuencias), `product_complements` utiliza clave primaria compuesta de UUIDs y `restaurant_settings` usa `smallint DEFAULT 1`.
- El único `INSERT` de respaldo sobre `public.roles` ocurre dentro de `handle_new_auth_user()`, que es `SECURITY DEFINER` (propietario de `roles_id_seq`).
- Por consiguiente, **revocar todos los privilegios de secuencias a `anon` y `authenticated` no rompe ninguna inserción legítima** y reduce la superficie de ataque.

### 3.10. Continuidad operativa de reservas, pedidos, pagos, cuentas de mesa, caja y auditoría
- **Estado:** **CORRECTO** *(con comprobación en vivo posterior a `db push` clasificada como **PENDIENTE DE VERIFICACIÓN**)*
- Todos los flujos de escritura transaccional continúan operando mediante las RPCs `SECURITY DEFINER` previstas en la Migración `05`.
- Todos los flujos de lectura desde el frontend React y suscripciones **Supabase Realtime** (`orders`, `restaurant_tables`, `table_accounts`, `reservations`) quedan habilitados gracias a los `GRANT SELECT` otorgados a `authenticated`, permaneciendo gobernados fila por fila por las políticas RLS de la Migración `04`.
- El bucket público `product-images` reside en el esquema `storage` (`storage.buckets` y `storage.objects`), el cual no es tocado por los `REVOKE ... IN SCHEMA public` de la Migración `07`.

### 3.11. Identificación de privilegios excesivos o insuficientes
- **Estado:** **CORRECTO**
- **Privilegios excesivos:** `0` detectados. No se otorga `ALL`, `TRUNCATE`, `TRIGGER` ni `REFERENCES` a ningún rol API; `DELETE` está omitido incluso para administradores en `restaurant_settings`, `profiles`, `reservations`, `orders`, `payments`, `cash_sessions`, `cash_movements` y `audit_logs`.
- **Privilegios insuficientes:** `0` detectados. Incluye `GRANT USAGE ON SCHEMA public TO anon, authenticated;` y cubre todos los `SELECT` necesarios tanto para consultas directas como para cláusulas `RETURNING` (`insert().select()` / `update().select()`) de PostgREST en las tablas editables.

---

## 4. Resumen clasificado de hallazgos

| ID | Hallazgo / Verificación | Clasificación |
|---|---|---|
| **H-01** | Alineación exacta 1:1 entre los `GRANT` de las 19 tablas en la Migración 07 y las políticas RLS de la Migración 04 (`152/152` combinaciones verificadas). | **CORRECTO** |
| **H-02** | Restricción de `anon` exclusivamente a `SELECT` sobre las 4 tablas públicas de catálogo/configuración y bloqueo total (`42501`) en las 15 tablas internas/privadas. | **CORRECTO** |
| **H-03** | Aislamiento entre clientes, confinamiento operativo del `mesero` (D-05), exclusividad del `administrador` en catálogo/mesas/ajustes y bloqueo de escalada de privilegios en `profiles`. | **CORRECTO** |
| **H-04** | Independencia total de las 24 funciones SQL/RPC (`22 SECURITY DEFINER` + `2 triggers BEFORE` sin acceso a tablas) y ausencia de roturas por `REVOKE ALL ON ALL SEQUENCES`. | **CORRECTO** |
| **H-05** | Verificación funcional en vivo de consultas PostgREST (`categories`, `products`, `profiles + roles`) contra el proyecto remoto una vez se autorice y ejecute `npx supabase db push`. | **PENDIENTE DE VERIFICACIÓN** |

*(No se registraron hallazgos en estado `REQUIERE CORRECCIÓN` ni `RIESGO DE SEGURIDAD` atribuibles a la Migración 07).*

---

## 5. Conclusión final de auditoría

**APROBADA PARA APLICACIÓN REMOTA.**

La migración [20261124210007_least_privilege_table_grants.sql](file:///c:/Users/Sebastian/Documents/Urestaurante/supabase/migrations/20261124210007_least_privilege_table_grants.sql) cumple rigurosamente con el principio de menor privilegio, guarda correspondencia exacta con las políticas RLS de las 19 tablas, preserva intactas las garantías de los triggers anti-escalada y de las 24 funciones SQL/RPC existentes, no rompe secuencias ni almacenamiento en `storage`, y puede aplicarse de manera segura al proyecto remoto de Supabase cuando el propietario lo autorice.
