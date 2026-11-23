# Arquitectura Backend Gestionado (Supabase)
## FORJA BRAVA — SIGR

Define la distribución de responsabilidades del backend utilizando **Supabase** como plataforma BaaS integral (PostgreSQL, Auth, Storage, Realtime y Funciones SQL/RPC), eliminando la necesidad de mantener un servidor Express independiente en esta etapa.

---

## 1. Responsabilidades de cada servicio de Supabase

| Servicio Supabase | Responsabilidad en FORJA BRAVA — SIGR | Justificación técnica |
|---|---|---|
| **Supabase Auth** | Registro de clientes, login unificado (3 roles), sesiones JWT, refresco automático de tokens y recuperación de contraseña por correo. | Elimina el almacenamiento inseguro de contraseñas en `localStorage` (`PBKDF2` en cliente) y credenciales hardcodeadas en `admin.html`. |
| **PostgreSQL + PostgREST** | Almacenamiento relacional de los 8 dominios, consultas filtradas y relaciones con integridad referencial. | Sustituye el JSON monolítico `forja-sigr-demo` en `localStorage` por una BD transaccional multiusuario. |
| **Row Level Security (RLS)** | Autorización obligatoria a nivel de fila por rol (`cliente`, `mesero`, `administrador`) en **todas** las tablas expuestas. | Impide el acceso o alteración de datos desde la consola del navegador aunque se conozca la `anon key`. |
| **Funciones SQL / RPC (`SECURITY DEFINER`)** | Encapsular operaciones atómicas y críticas de negocio (creación de pedidos con recálculo de precios, reserva con prevención de solapamiento, cobro y cierre de cuenta de mesa, cierre de caja y reportes agregados). | Garantiza atomicidad (ACID), evita manipulación de precios y elimina condiciones de carrera sin necesidad de un backend Express. |
| **Supabase Storage** | Almacenar imágenes de productos y categorías en el bucket `product-images` (lectura pública vía CDN; escritura/eliminación restringida a `administrador` vía políticas de Storage). | Reemplaza la asignación fija `producto-adiciones.png` al crear productos en administración. |
| **Supabase Realtime** | Suscripción en vivo (WebSocket) a cambios en `orders`, `restaurant_tables` y `table_accounts`. | Permite que el cliente vea cambios de seguimiento, el mesero vea pedidos `Listo` y estado de mesas al instante, y el admin reciba nuevos pedidos y solicitudes de cierre sin recargar. |

---

## 2. Catálogo de Funciones SQL / RPC críticas

| Función RPC | Quién la invoca | Qué garantiza en el servidor |
|---|---|---|
| `create_order(...)` | `cliente` (Checkout) o `administrador` | Valida sesión (D-06), verifica que los productos y complementos estén activos, toma precios reales desde `products`, suma tarifa fija desde `restaurant_settings` si es `Domicilio` (D-03), deja pago `Pendiente` si es `Mesa` (D-04), guarda snapshots en `order_items` y registra pago simulado + auditoría de forma atómica. |
| `create_table_order(...)` | `mesero` | Valida rol `mesero`, verifica que la mesa esté activa, abre o reutiliza la cuenta abierta (`table_accounts`) de la mesa, marca la mesa como `Ocupada`, inserta pedido en estado `Pendiente` y pago `Pendiente` (D-04). |
| `update_order_status(...)` | `administrador` o `mesero` | Valida matriz de transiciones por rol y modalidad: `administrador` controla preparación; `mesero` solo puede marcar `Entregado` o `Cancelado` si el estado actual es `Pendiente` (D-05). Registra `order_status_history` y `audit_logs`. |
| `get_available_reservation_slots(...)` | Público / Autenticado | Calcula franjas disponibles para fecha + personas + zona usando horarios, inventario activo de mesas (D-01), duración configurable (D-02) y reservas existentes sin solapamiento. |
| `create_reservation(...)` | `cliente` o `administrador` | Valida sesión (D-06), bloquea fila/mesa atómicamente (`FOR UPDATE` / restricción de exclusión), asigna mesa libre compatible, crea reserva en estado `Confirmada` y registra auditoría. |
| `request_table_account_close(...)` | `mesero` | Marca `table_accounts.status = 'closing_requested'` para que aparezca en Caja (`ADM-09`) y consolida el total excluyendo pedidos cancelados. |
| `settle_table_account(...)` | `administrador` (en Caja) | Valida caja abierta, registra pago simulado único sobre la cuenta de mesa, asocia el movimiento al turno de caja sin duplicar efectivo/digital, marca la cuenta `closed`, actualiza pedidos a pago `Confirmación simulada` y libera la mesa a `Disponible`. |
| `close_cash_session(...)` | `administrador` | Calcula ventas elegibles del turno (sin duplicar), movimientos de ingreso/egreso, efectivo esperado, diferencia con efectivo contado, cierra el turno y registra auditoría. |

---

## 3. Criterio para Edge Functions (Solo cuando sean justificadas)

En la primera versión **no se requieren Edge Functions obligatorias**, salvo en un caso concreto:
- **Creación de usuarios internos (`mesero` / `administrador`) desde `ADM-08`:** Debido a que `supabase.auth.admin.createUser()` requiere la clave `service_role` (que **nunca** puede estar en el frontend), la creación de cuentas internas desde el panel administrativo deberá ejecutarse mediante una **Supabase Edge Function** (`create-staff-user`) que valide el JWT del administrador llamante antes de invocar la Admin API.
- Cualquier futura integración con pasarela de pagos real o envío de correos transaccionales personalizados también residiría en Edge Functions.
