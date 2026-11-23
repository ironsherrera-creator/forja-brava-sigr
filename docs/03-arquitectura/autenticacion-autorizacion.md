# Autenticación, Autorización y Matriz de Permisos
## FORJA BRAVA — SIGR

Establece el diseño de seguridad de acceso para los tres roles oficiales (`cliente`, `mesero`, `administrador`) mediante **Supabase Auth** y **Row Level Security (RLS)** en PostgreSQL.

---

## 1. Flujos de identidad (Supabase Auth)

1. **Registro (`cliente`):** `supabase.auth.signUp()` dispara un trigger SQL (`handle_new_user`) en `auth.users` que crea el registro en `public.profiles` asignando **siempre** `role = 'cliente'` e `is_active = true`.
2. **Inicio de sesión unificado:** `supabase.auth.signInWithPassword()` obtiene el JWT; el frontend consulta `public.profiles` del propio `auth.uid()`, valida `is_active = true` y redirige según rol (`/cliente`, `/mesero`, `/admin`).
3. **Recuperación de contraseña:** `supabase.auth.resetPasswordForEmail()` envía enlace seguro a `/recuperar-contrasena`, donde el usuario define su nueva contraseña con `supabase.auth.updateUser()`.
4. **Cierre de sesión:** `supabase.auth.signOut()` revoca sesión local y limpia estado sensible en memoria.

---

## 2. Protección de roles (Anti-escalamiento)

- **Regla crítica:** Un usuario jamás puede modificar su propia columna `role` ni `is_active`.
- En PostgreSQL, un trigger `BEFORE UPDATE` sobre `public.profiles` (junto con la política RLS) bloquea cualquier intento de cambiar `role` o `is_active` si `public.current_user_role() <> 'administrador'`.
- Se definen funciones SQL auxiliares `STABLE SECURITY DEFINER`:
  - `public.current_user_role()` → retorna `'cliente' | 'mesero' | 'administrador'` del `auth.uid()` activo (o `NULL` si está inactivo).
  - `public.is_admin()` → `public.current_user_role() = 'administrador'`.
  - `public.is_waiter()` → `public.current_user_role() = 'mesero'`.

---

## 3. Matriz completa de permisos por rol

| Módulo / Operación | Visitante | Cliente | Mesero | Administrador |
|---|---|---|---|---|
| Ver landing, menú público, categorías y detalle de producto | Sí | Sí | Sí | Sí |
| Armar carrito temporal en navegador | Sí | Sí | — | — |
| Consultar franjas disponibles de reserva | Sí | Sí | Sí | Sí |
| Crear pedido (`Domicilio` / `Recoger` / `Mesa`) vía Checkout (D-06) | **No** | **Sí** | No | Sí (manual) |
| Crear reserva pública con confirmación automática (D-06) | **No** | **Sí** | No | Sí |
| Ver / editar su propio perfil y direcciones | No | **Sí** | Solo su perfil | Sí |
| Ver historial y seguimiento de sus propios pedidos | No | **Sí (solo lectura)** | No | Todos |
| Cancelar su propia reserva (dentro de ventana permitida) | No | **Sí** | No | Todas |
| Ver inventario y estado de mesas en vivo (D-01) | No | Solo disponibles al reservar/pedir | **Sí (lectura)** | **Sí (CRUD)** |
| Registrar pedidos multi-producto en mesa (`Mesa`) | No | En Checkout | **Sí** | Sí |
| Consultar pedidos registrados de mesas | No | Solo los suyos | **Sí** | Todos |
| Cambiar estados de preparación (`Confirmado`, `En preparación`, `Listo`, `Despachado`) | No | No | **No** (D-05) | **Sí** |
| Marcar pedido de mesa como `Entregado` (D-05) | No | No | **Sí** | **Sí** |
| Cancelar pedido recién registrado (`Pendiente`) (D-05) | No | No | **Sí (solo `Pendiente`)** | **Sí** |
| Cancelar pedido ya en preparación | No | No | **No** (D-05) | **Sí** |
| Solicitar cierre de cuenta acumulada de mesa (D-04) | No | No | **Sí** | Sí |
| Administrar productos, precios, categorías e imágenes | No | No | **No** | **Sí** |
| Administrar inventario de mesas (D-01) | No | No | **No** | **Sí** |
| Administrar usuarios y asignar roles | No | No | **No** | **Sí** |
| Operar Caja (apertura, cobro de cuentas de mesa, ingresos/egresos, cierre) | No | No | **No** | **Sí** |
| Consultar Reportes financieros, Configuración y Auditoría | No | No | **No** | **Sí** |

---

## 4. Resumen de Políticas RLS obligatorias por tabla

| Tabla | `SELECT` | `INSERT` | `UPDATE` | `DELETE` |
|---|---|---|---|---|
| `categories`, `products`, `product_complements` | Público (`is_active`/`is_available` o `is_admin()`) | Solo `is_admin()` | Solo `is_admin()` | Solo `is_admin()` |
| `restaurant_settings` | Público (campos no sensibles) | Solo `is_admin()` | Solo `is_admin()` | Denegado |
| `profiles` | `id = auth.uid()` o `is_admin()` | Vía trigger Auth / `is_admin()` | Propio (sin `role`/`is_active`) o `is_admin()` | Denegado (desactivación lógica) |
| `customer_addresses` | `user_id = auth.uid()` o `is_admin()` | `user_id = auth.uid()` | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `restaurant_tables` | `is_admin()` o `is_waiter()` (y RPC de disponibilidad) | Solo `is_admin()` | Solo `is_admin()` (ocupación vía RPC) | Solo `is_admin()` |
| `table_accounts` | `is_admin()` o `is_waiter()` | Vía RPC autorizada | Vía RPC autorizada | Denegado |
| `orders`, `order_items`, `order_status_history` | `customer_id = auth.uid()` o `is_admin()` o (`is_waiter()` y `modality = 'mesa'`) | Vía RPC `create_order` / `create_table_order` | Vía RPC `update_order_status` | Denegado |
| `payments` | Propietario del pedido o `is_admin()` | Vía RPC `create_order` / `settle_table_account` | Solo `is_admin()` (reembolso simulado) | Denegado |
| `reservations` | `customer_id = auth.uid()` o `is_admin()` o `is_waiter()` | Vía RPC `create_reservation` | Propio (solo cancelar) o `is_admin()` | Denegado |
| `cash_sessions`, `cash_movements` | Solo `is_admin()` | Solo `is_admin()` | Solo `is_admin()` | Denegado |
| `audit_logs` | Solo `is_admin()` | Solo triggers / RPCs internas | Denegado (inmutable) | Denegado (inmutable) |
