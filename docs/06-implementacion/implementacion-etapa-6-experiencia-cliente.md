# Implementación de la Etapa 6 — Experiencia del Cliente, Checkout, Pedidos, Seguimiento, Historial y Reservas
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Estado:** COMPLETADO (implementado en React 19 + Supabase/PostgreSQL con RLS y RPCs transaccionales, validado con ESLint, Vitest, Vite build y Playwright E2E).  
**Stack:** React 19 · Vite 8 · Tailwind CSS v4 · React Router 7 · Zod 4 · `@supabase/supabase-js` v2 · PostgreSQL 17 (RLS + `GRANT` mínimos + RPCs `SECURITY DEFINER`) · Supabase Realtime.

---

## 1. Objetivo

Entregar el ecosistema privado completo del cliente autenticado en **FORJA BRAVA — SIGR**, permitiendo gestionar su perfil y direcciones de entrega, completar pedidos reales en un checkout transaccional con pagos simulados y sin manipulación de precios en frontend, seguir el avance de sus pedidos en tiempo real, consultar su historial histórico inmutable y crear o cancelar reservas en vivo según disponibilidad real.

---

## 2. Rutas y pantallas implementadas

| Ruta | Página | Funcionalidades principales |
| :--- | :--- | :--- |
| `/cliente/perfil` | `src/pages/client/ClientProfilePage.jsx` | Edición de nombre y teléfono en `profiles`, cambio oficial de correo vía `supabase.auth.updateUser({ email })` con confirmación y protección visual/BD contra cambio de rol o estado. |
| `/cliente/direcciones` | `src/pages/client/ClientAddressesPage.jsx` | CRUD completo de `customer_addresses` con etiqueta, dirección, barrio e indicaciones, dirección predeterminada única y confirmación de eliminación. |
| `/checkout` | `src/pages/client/CheckoutPage.jsx` | Conciliación en vivo del carrito contra Supabase, selector de modalidad (`domicilio`, `para_llevar`, `en_mesa` gobernado por `allow_client_table_orders` / D-07), selección o alta rápida de dirección, tarifa fija de domicilio D-03, métodos de pago simulados (`Efectivo`, `Tarjeta`, `Nequi`, `PSE`) sin captura de tarjetas, aceptación de condiciones, clave idempotente `client_request_id` y confirmación transaccional con limpieza de carrito. |
| `/cliente/pedidos` | `src/pages/client/ClientOrdersPage.jsx` | Listado de pedidos del cliente con pestañas de estado (`Todos`, `Pendientes`, `En curso`, `Entregados`, `Cancelados`), totales reales y acceso a detalle y seguimiento. |
| `/cliente/pedidos/:id` | `src/pages/client/ClientOrderDetailPage.jsx` | Detalle histórico completo con snapshots de `order_items`, `order_item_complements`, pago asociado, dirección capturada y trazabilidad `order_status_history`. |
| `/cliente/seguimiento` y `/cliente/seguimiento/:id` | `src/pages/client/ClientTrackingPage.jsx` | Línea de tiempo en tiempo real (`Pendiente` → `Confirmado` → `En preparación` → `Listo` → `Despachado` → `Entregado` o `Cancelado`) mediante Supabase Realtime + respaldo por actualización periódica. |
| `/cliente/historial` | `src/pages/client/ClientHistoryPage.jsx` | Consulta histórica de solo lectura con buscador por código, filtro por estado, filtro por fecha (`America/Bogota`) y paginación. |
| `/cliente/reservas` y `/cliente/reservas/:id` | `src/pages/client/ClientReservationsPage.jsx` | Consulta de franjas reales vía RPC `get_available_reservation_slots`, creación sin selección manual de mesa vía `create_reservation`, detalle y cancelación respetando la ventana de corte `cancel_reservation`. |

---

## 3. Arquitectura de servicios, hooks y esquemas

- **Validación Zod (`src/schemas/clientSchemas.js`):**
  - `emailChangeSchema`, `addressSchema`, `checkoutSchema`, `reservationRequestSchema`.
- **Utilidades horarias (`src/utils/formatDate.js` y `src/utils/orderStatus.js`):**
  - Formateo estricto en zona horaria `America/Bogota` (`formatDateBogota`, `formatDateTimeBogota`, `getTodayBogotaISO`, `formatSlotTime`) y mapeo visual de estados de pedido.
- **Servicios conectados a Supabase:**
  - `src/services/profileService.js`: cambio oficial de correo en Supabase Auth.
  - `src/services/addressService.js`: CRUD sobre `customer_addresses` y marca de dirección predeterminada con RPC `set_default_customer_address` (Migración 08) y respaldo seguro compatible con RLS cuando la migración local aún no ha sido aplicada remotamente.
  - `src/services/orderService.js`: envío de `create_order` con `p_client_request_id` (UUID idempotente), consulta de pedidos propios y detalle completo por ID (respetando aislamiento RLS).
  - `src/services/orderTrackingService.js`: suscripción Supabase Realtime a `orders` y `order_status_history` con respaldo por *polling* cada 20 s.
  - `src/services/reservationService.js`: consumo de `get_available_reservation_slots`, `create_reservation`, `cancel_reservation` y listado histórico del cliente.
- **Hooks de estado:** `src/hooks/useAddresses.js`, `src/hooks/useOrders.js`, `src/hooks/useReservations.js`.

---

## 4. Reglas de negocio y seguridad aplicadas

1. **Cero confianza en totales del frontend:** el checkout envía únicamente `product_id`, `quantity` y `complement_id[]` al RPC `public.create_order`; PostgreSQL recalcula subtotales, complementos, domicilio fijo (D-03) y total final, guardando snapshots inmutables en `order_items` y `order_item_complements`.
2. **Idempotencia:** cada intento de checkout genera un `client_request_id` UUID que previene pedidos duplicados por doble clic o reintento de red.
3. **Pagos simulados claros (D-05):** los métodos `Efectivo`, `Tarjeta`, `Nequi` y `PSE` muestran un aviso explícito de pago simulado y jamás capturan PAN, CVV ni credenciales bancarias.
4. **Control de modalidad en mesa (D-07):** el modo `en_mesa` se bloquea automáticamente cuando `restaurant_settings.allow_client_table_orders = false`, tanto en UI como en el RPC SQL.
5. **Aislamiento RLS:** ningún cliente puede leer pedidos, direcciones o reservas de otro usuario; un intento directo por URL a un pedido ajeno retorna estado de error controlado sin fuga de datos.

---

## 5. Verificación y pruebas automatizadas

- **Pruebas unitarias (`tests/unit/stage6And7SchemasAndOrderRpc.test.js`):** validación de esquemas Zod (`addressSchema`, `checkoutSchema`, `reservationRequestSchema`) y verificación de payload hacia `create_order` (sin precios del cliente y con `p_client_request_id`).
- **Pruebas de integración (`tests/integration/clientAndAdminFlows.test.jsx`):** checkout a domicilio con dirección guardada, bloqueo D-07 de modalidad en mesa y flujo de consulta/creación de reserva.
- **Pruebas E2E Playwright (`tests/e2e/stages-6-and-7.spec.js`):** escenarios de login cliente, perfil, direcciones, checkout domicilio + pago simulado `Nequi`, confirmación, pedidos, seguimiento, historial, bloqueo de pedido ajeno y creación/concurrencia de reservas.
