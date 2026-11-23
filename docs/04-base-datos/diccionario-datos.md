# Diccionario de Datos (PostgreSQL / Supabase)
## FORJA BRAVA — SIGR

Especificación detallada de las **18 tablas** del modelo relacional, sus tipos PostgreSQL, llaves primarias/foráneas, restricciones, índices y políticas de acceso RLS.

---

## 1. Dominio de Usuarios, Roles y Permisos

### 1.1. `roles`
- **Propósito:** Catálogo de roles oficiales del sistema (`cliente`, `mesero`, `administrador`).
- **Columnas:** `id (smallserial PK)`, `code (varchar(30) UNIQUE NOT NULL)`, `name (varchar(60) NOT NULL)`, `description (text)`.
- **RLS:** `SELECT` autenticados; escritura denegada desde cliente.

### 1.2. `permissions` y `role_permissions`
- **Propósito:** Matriz declarativa de permisos por rol para documentación, auditoría y validación fina.
- **Columnas `permissions`:** `id (smallserial PK)`, `code (varchar(80) UNIQUE NOT NULL)`, `description (text)`.
- **Columnas `role_permissions`:** `role_id (smallint FK -> roles.id)`, `permission_id (smallint FK -> permissions.id)`, `PRIMARY KEY (role_id, permission_id)`.
- **RLS:** `SELECT` solo `is_admin()`.

### 1.3. `profiles`
- **Propósito:** Perfil operativo y rol de cada usuario registrado en `auth.users`.
- **Columnas:** `id (uuid PK FK -> auth.users.id)`, `role_id (smallint NOT NULL FK -> roles.id)`, `full_name (varchar(120) NOT NULL)`, `email (varchar(180) NOT NULL)`, `phone (varchar(30))`, `is_active (boolean NOT NULL DEFAULT true)`, `created_at (timestamptz NOT NULL DEFAULT now())`, `updated_at (timestamptz NOT NULL DEFAULT now())`.
- **Restricciones / Índices:** Índice en `(role_id, is_active)`; trigger anti-escalamiento impide al propio usuario cambiar `role_id` o `is_active`.
- **RLS:** `SELECT` propio o `is_admin()`; `UPDATE` propio (solo `full_name`, `phone`) o `is_admin()`.

### 1.4. `customer_addresses`
- **Propósito:** Libreta de direcciones de entrega del cliente (`CLI-04`).
- **Columnas:** `id (uuid PK DEFAULT gen_random_uuid())`, `user_id (uuid NOT NULL FK -> profiles.id ON DELETE CASCADE)`, `label (varchar(60) NOT NULL)`, `address (varchar(200) NOT NULL)`, `neighborhood (varchar(100) NOT NULL)`, `directions (text)`, `is_default (boolean NOT NULL DEFAULT false)`, `created_at (timestamptz DEFAULT now())`.
- **Índices:** `idx_addresses_user (user_id)`, índice único parcial `(user_id) WHERE is_default = true`.
- **RLS:** Propietario (`user_id = auth.uid()`) o `is_admin()`.

---

## 2. Dominio de Catálogo

### 2.1. `categories`
- **Propósito:** Categorías dinámicas del menú digital (`ADM-04`).
- **Columnas:** `id (uuid PK)`, `slug (varchar(80) UNIQUE NOT NULL)`, `name (varchar(80) UNIQUE NOT NULL)`, `description (text)`, `image_url (text)`, `display_order (int NOT NULL DEFAULT 0 CHECK >= 0)`, `is_active (boolean NOT NULL DEFAULT true)`, `created_at (timestamptz DEFAULT now())`.
- **Índices:** `idx_categories_active_order (is_active, display_order)`.
- **RLS:** `SELECT` público (`is_active = true` o `is_admin()`); escritura solo `is_admin()`.

### 2.2. `products`
- **Propósito:** Productos y complementos del catálogo (`ADM-03`).
- **Columnas:** `id (uuid PK)`, `category_id (uuid NOT NULL FK -> categories.id ON DELETE RESTRICT)`, `slug (varchar(100) UNIQUE NOT NULL)`, `name (varchar(120) NOT NULL)`, `description (text NOT NULL)`, `ingredients (text)`, `price (numeric(12,2) NOT NULL CHECK (price >= 0))`, `image_url (text)`, `tag (varchar(40))`, `is_addon (boolean NOT NULL DEFAULT false)`, `is_available (boolean NOT NULL DEFAULT true)`, `created_at (timestamptz DEFAULT now())`, `updated_at (timestamptz DEFAULT now())`.
- **Índices:** `idx_products_cat_avail (category_id, is_available)`, `idx_products_addon (is_addon) WHERE is_available = true`.
- **RLS:** `SELECT` público (`is_available = true` o `is_admin()`); escritura solo `is_admin()`.

### 2.3. `product_complements`
- **Propósito:** Asociación explícita entre un producto principal y sus complementos permitidos.
- **Columnas:** `product_id (uuid FK -> products.id ON DELETE CASCADE)`, `complement_id (uuid FK -> products.id ON DELETE CASCADE)`, `PRIMARY KEY (product_id, complement_id)`, `CHECK (product_id <> complement_id)`.
- **RLS:** `SELECT` público; escritura solo `is_admin()`.

---

## 3. Dominio de Mesas y Reservas

### 3.1. `restaurant_tables`
- **Propósito:** Inventario dinámico de mesas configurable desde administración (D-01).
- **Columnas:** `id (uuid PK)`, `code (varchar(30) UNIQUE NOT NULL)`, `zone (varchar(60) NOT NULL DEFAULT 'Salón')`, `capacity (smallint NOT NULL CHECK (capacity >= 1))`, `status (varchar(25) NOT NULL CHECK (status IN ('disponible','ocupada','reservada','fuera_de_servicio')))`, `is_active (boolean NOT NULL DEFAULT true)`, `created_at (timestamptz DEFAULT now())`.
- **Índices:** `idx_tables_zone_status (zone, status) WHERE is_active = true`.
- **RLS:** `SELECT` `is_admin()` o `is_waiter()`; escritura solo `is_admin()` (cambios de ocupación vía RPCs).

### 3.2. `reservations`
- **Propósito:** Reservas confirmadas automáticamente sin solapamientos (D-02, D-06).
- **Columnas:** `id (uuid PK)`, `reservation_code (varchar(30) UNIQUE NOT NULL)`, `customer_id (uuid NOT NULL FK -> profiles.id)`, `table_id (uuid NOT NULL FK -> restaurant_tables.id ON DELETE RESTRICT)`, `customer_name (varchar(120) NOT NULL)`, `customer_phone (varchar(30) NOT NULL)`, `party_size (smallint NOT NULL CHECK (party_size >= 1))`, `reservation_date (date NOT NULL)`, `start_at (timestamptz NOT NULL)`, `end_at (timestamptz NOT NULL)`, `duration_minutes (smallint NOT NULL CHECK (duration_minutes >= 15))`, `notes (text)`, `status (varchar(20) NOT NULL CHECK (status IN ('Pendiente','Confirmada','Atendida','Cancelada')))`, `created_at (timestamptz DEFAULT now())`.
- **Restricciones / Índices:** `CHECK (end_at > start_at)`; restricción de exclusión `EXCLUDE USING gist (table_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status IN ('Pendiente','Confirmada'))`; índice `(reservation_date, status)`.
- **RLS:** `SELECT` propio, `is_waiter()` o `is_admin()`; `INSERT` vía RPC `create_reservation`; `UPDATE` propio (solo cancelar) o `is_admin()`.

---

## 4. Dominio de Cuentas de Mesa, Pedidos y Pagos Simulados

### 4.1. `table_accounts`
- **Propósito:** Cuenta acumulada de una mesa para agrupar múltiples pedidos y cobrar al cierre (D-04).
- **Columnas:** `id (uuid PK)`, `table_id (uuid NOT NULL FK -> restaurant_tables.id)`, `opened_by (uuid NOT NULL FK -> profiles.id)`, `status (varchar(25) NOT NULL CHECK (status IN ('open','closing_requested','closed','cancelled')))`, `total_amount (numeric(12,2) NOT NULL DEFAULT 0 CHECK >= 0)`, `opened_at (timestamptz NOT NULL DEFAULT now())`, `closing_requested_at (timestamptz)`, `closed_at (timestamptz)`, `closed_by (uuid FK -> profiles.id)`.
- **Restricciones:** Índice único parcial `(table_id) WHERE status IN ('open','closing_requested')` (garantiza máximo 1 cuenta abierta por mesa).
- **RLS:** `SELECT` `is_waiter()` o `is_admin()`; mutaciones vía RPCs.

### 4.2. `orders`
- **Propósito:** Pedidos individuales de las tres modalidades (`domicilio`, `recoger`, `mesa`).
- **Columnas:** `id (uuid PK)`, `order_number (varchar(30) UNIQUE NOT NULL)`, `client_request_id (uuid UNIQUE)` *(idempotencia)*, `customer_id (uuid FK -> profiles.id)`, `waiter_id (uuid FK -> profiles.id)`, `table_id (uuid FK -> restaurant_tables.id)`, `table_account_id (uuid FK -> table_accounts.id)`, `reservation_id (uuid FK -> reservations.id)`, `modality (varchar(20) NOT NULL CHECK (modality IN ('domicilio','recoger','mesa')))`, `customer_name (varchar(120) NOT NULL)`, `customer_email (varchar(180))`, `customer_phone (varchar(30))`, `delivery_address (varchar(200))`, `delivery_neighborhood (varchar(100))`, `delivery_directions (text)`, `pickup_eta (time)`, `notes (text)`, `subtotal (numeric(12,2) NOT NULL CHECK >= 0)`, `delivery_fee (numeric(12,2) NOT NULL DEFAULT 0 CHECK >= 0)`, `total (numeric(12,2) NOT NULL CHECK >= 0)`, `status (varchar(25) NOT NULL CHECK (status IN ('Pendiente','Confirmado','En preparación','Listo','Despachado','Entregado','Cancelado')))`, `payment_status (varchar(30) NOT NULL CHECK (payment_status IN ('Pendiente','Confirmación simulada','Fallido','Reembolsado')))`, `created_at (timestamptz NOT NULL DEFAULT now())`, `updated_at (timestamptz NOT NULL DEFAULT now())`.
- **Restricciones / Índices:** `CHECK (total = subtotal + delivery_fee)`; `CHECK (modality <> 'mesa' OR table_id IS NOT NULL)`; `CHECK (modality <> 'domicilio' OR (delivery_address IS NOT NULL AND delivery_neighborhood IS NOT NULL))`; índices en `(created_at DESC)`, `(status, modality)`, `(customer_id)`, `(table_account_id)`.
- **RLS:** `SELECT` propietario, `is_admin()` o (`is_waiter()` y `modality = 'mesa'`); mutaciones vía RPCs.

### 4.3. `order_items`
- **Propósito:** Líneas de pedido con snapshots inmutables de precio y nombre.
- **Columnas:** `id (uuid PK)`, `order_id (uuid NOT NULL FK -> orders.id ON DELETE CASCADE)`, `product_id (uuid NOT NULL FK -> products.id ON DELETE RESTRICT)`, `product_name_snapshot (varchar(120) NOT NULL)`, `unit_price_snapshot (numeric(12,2) NOT NULL CHECK >= 0)`, `quantity (smallint NOT NULL CHECK >= 1)`, `addons_snapshot (jsonb NOT NULL DEFAULT '[]'::jsonb)`, `addons_total (numeric(12,2) NOT NULL DEFAULT 0 CHECK >= 0)`, `line_total (numeric(12,2) NOT NULL CHECK >= 0)`, `notes (varchar(200))`.
- **Índices:** `idx_order_items_order (order_id)`, `idx_order_items_product (product_id)`.

### 4.4. `order_status_history`
- **Propósito:** Trazabilidad cronológica de cambios de estado para seguimiento (`CLI-07`) y auditoría.
- **Columnas:** `id (uuid PK)`, `order_id (uuid NOT NULL FK -> orders.id ON DELETE CASCADE)`, `previous_status (varchar(25))`, `new_status (varchar(25) NOT NULL)`, `changed_by (uuid NOT NULL FK -> profiles.id)`, `reason (text)`, `changed_at (timestamptz NOT NULL DEFAULT now())`.

### 4.5. `payments`
- **Propósito:** Registro de pagos simulados (directos en domicilio/recoger o consolidados al cerrar cuenta de mesa).
- **Columnas:** `id (uuid PK)`, `order_id (uuid FK -> orders.id)`, `table_account_id (uuid FK -> table_accounts.id)`, `method (varchar(25) NOT NULL CHECK (method IN ('Efectivo','Tarjeta','Nequi','PSE')))`, `status (varchar(30) NOT NULL CHECK (status IN ('Pendiente','Confirmación simulada','Fallido','Reembolsado')))`, `amount (numeric(12,2) NOT NULL CHECK >= 0)`, `transaction_ref (varchar(60) UNIQUE NOT NULL)`, `is_simulated (boolean NOT NULL DEFAULT true)`, `disclaimer (text NOT NULL)`, `paid_at (timestamptz)`, `created_at (timestamptz NOT NULL DEFAULT now())`.
- **Restricciones:** `CHECK ((order_id IS NOT NULL) <> (table_account_id IS NOT NULL))` *(un pago pertenece a un pedido individual O a una cuenta de mesa, nunca ambos -> evita doble contabilización)*; índice único parcial por `order_id` y por `table_account_id` donde `status = 'Confirmación simulada'`.

---

## 5. Dominio de Caja, Configuración y Auditoría

### 5.1. `cash_sessions`
- **Propósito:** Turnos de caja (apertura, base inicial, arqueo y cierre).
- **Columnas:** `id (uuid PK)`, `opened_by (uuid NOT NULL FK -> profiles.id)`, `closed_by (uuid FK -> profiles.id)`, `status (varchar(15) NOT NULL CHECK (status IN ('open','closed')))`, `opening_balance (numeric(12,2) NOT NULL CHECK >= 0)`, `expected_cash (numeric(12,2))`, `counted_cash (numeric(12,2))`, `difference (numeric(12,2))`, `total_cash_sales (numeric(12,2) DEFAULT 0)`, `total_digital_sales (numeric(12,2) DEFAULT 0)`, `notes (text)`, `opened_at (timestamptz NOT NULL DEFAULT now())`, `closed_at (timestamptz)`.
- **Restricciones:** Índice único parcial `(status) WHERE status = 'open'` (solo 1 caja abierta a la vez).
- **RLS:** Exclusivo `is_admin()`.

### 5.2. `cash_movements`
- **Propósito:** Movimientos detallados dentro de un turno de caja (ventas en efectivo/digitales, ingresos y egresos manuales).
- **Columnas:** `id (uuid PK)`, `cash_session_id (uuid NOT NULL FK -> cash_sessions.id ON DELETE RESTRICT)`, `payment_id (uuid UNIQUE FK -> payments.id)`, `movement_type (varchar(20) NOT NULL CHECK (movement_type IN ('sale','manual_income','manual_expense')))`, `payment_method (varchar(25) NOT NULL)`, `amount (numeric(12,2) NOT NULL CHECK (amount > 0))`, `concept (varchar(200) NOT NULL)`, `created_by (uuid NOT NULL FK -> profiles.id)`, `created_at (timestamptz NOT NULL DEFAULT now())`.
- **Restricciones:** `payment_id UNIQUE` impide registrar un mismo pago dos veces en caja.
- **RLS:** Exclusivo `is_admin()`.

### 5.3. `restaurant_settings`
- **Propósito:** Configuración singleton editable en `ADM-12` (reemplaza `CONFIG` y `deliveryFee`).
- **Columnas:** `id (smallint PK DEFAULT 1 CHECK (id = 1))`, `restaurant_name (varchar(120) NOT NULL)`, `location (varchar(200) NOT NULL)`, `phone (varchar(40) NOT NULL)`, `whatsapp_number (varchar(30))`, `instagram_url (text)`, `facebook_url (text)`, `business_hours (jsonb NOT NULL)`, `fixed_delivery_fee (numeric(12,2) NOT NULL DEFAULT 0 CHECK >= 0)`, `reservation_duration_minutes (smallint NOT NULL DEFAULT 90 CHECK >= 15)`, `reservation_cancel_cutoff_minutes (smallint NOT NULL DEFAULT 60 CHECK >= 0)`, `featured_product_id (uuid FK -> products.id ON DELETE SET NULL)`, `updated_at (timestamptz DEFAULT now())`, `updated_by (uuid FK -> profiles.id)`.

### 5.4. `audit_logs`
- **Propósito:** Bitácora inmutable de acciones críticas (`ADM-11`).
- **Columnas:** `id (uuid PK)`, `actor_id (uuid FK -> profiles.id)`, `actor_role (varchar(30))`, `entity_name (varchar(60) NOT NULL)`, `entity_id (uuid)`, `action (varchar(60) NOT NULL)`, `old_data (jsonb)`, `new_data (jsonb)`, `created_at (timestamptz NOT NULL DEFAULT now())`.
- **Índices:** `idx_audit_entity_date (entity_name, created_at DESC)`, `idx_audit_actor (actor_id, created_at DESC)`.
- **RLS:** `SELECT` solo `is_admin()`; `UPDATE`/`DELETE` denegados.
