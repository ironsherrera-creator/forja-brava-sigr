# Especificación UI/UX — Experiencia del Cliente
## FORJA BRAVA — SIGR

Especificación detallada de las pantallas autenticadas del rol `cliente` (cubriendo las 18 dimensiones obligatorias). Todas heredan la paleta cálida (`#f1e8d8`, `#faf6ee`, `#171613`, `#c66a32`) y tipografías oficiales.

---

## 1. Dashboard del cliente

1. **Nombre:** Dashboard del cliente (`/cliente`).
2. **Objetivo:** Centralizar el resumen personal del cliente: pedidos activos, último pedido, próximas reservas e historial de compras.
3. **Perfil autorizado:** `cliente`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno (evoluciona más allá del modal `.profile-view` en `index.html` `L101-L110`).
6. **Elementos que se reutilizan:** `BrandLogo`, `TopBar`, `KpiGrid` / `KpiCard`, `Panel`, `StatusBadge`, `Button`.
7. **Distribución visual:**
```text
[ Barra superior (#171613): FB | Hola, [Nombre] | Menú · Reservar · Carrito (n) | Cerrar sesión ]
[ Navegación cliente (#faf6ee): Resumen | Mis pedidos | Mis reservas | Mi perfil ]
[ KPIs (4 tarjetas): Pedidos activos | Último pedido | Próximas reservas | Historial de compras ]
[ Panel Izq: Seguimiento rápido pedido activo ] [ Panel Der: Próxima reserva confirmada ]
```
8. **Componentes de interfaz:** `TopBar`, pestañas de navegación, `KpiGrid`, `Panel`, `OrderTimeline` (resumen), `StatusBadge`, `Button`.
9. **Información que se muestra:** Conteo de pedidos activos, estado del último pedido, detalle de la próxima reserva (fecha, hora, mesa asignada) y cantidad total de pedidos completados.
10. **Acciones disponibles:** Ir a `/menu`, ir a `/reservas`, abrir seguimiento del pedido activo, navegar a `Mis pedidos`, `Mis reservas` o `Mi perfil`, cerrar sesión.
11. **Validaciones:** Sesión activa con rol `cliente`; consultas filtradas por `auth.uid()` vía RLS.
12. **Estados de carga:** `SkeletonBlock` en las 4 tarjetas KPI y 2 paneles.
13. **Estados vacíos:** Para cuentas nuevas sin actividad, bienvenida con accesos directos `EXPLORAR MENÚ ↗` y `RESERVAR MESA ↗`.
14. **Mensajes de error:** Banner en `#f3d7ca` con botón `REINTENTAR`.
15. **Mensajes de éxito:** Toast al regresar de actualizar perfil o confirmar reserva/pedido.
16. **Comportamiento responsive:** 4 KPIs en escritorio, 2 columnas en tablet/móvil; pestañas con scroll horizontal en móvil.
17. **Navegación de entrada y salida:** Entrada al iniciar sesión como cliente o pulsar `MI CUENTA`. Salida hacia `/cliente/perfil`, `/cliente/pedidos`, `/cliente/reservas`, `/menu`, `/reservas`.
18. **Criterios de aceptación:** Independiente del panel administrativo; solo muestra información propia del usuario.

---

## 2. Mi perfil y Direcciones de entrega

1. **Nombre:** Mi perfil y Direcciones (`/cliente/perfil`).
2. **Objetivo:** Permitir editar datos personales y gestionar direcciones guardadas para agilizar pedidos a domicilio.
3. **Perfil autorizado:** `cliente`.
4. **Estado actual:** Implementado parcialmente (`MEJORAR`: extraer de modal y agregar libreta de direcciones).
5. **Archivo o componente existente relacionado:** `index.html` (`L101-L110`), `js/app.js` (`L78`, `L85-L86`).
6. **Elementos que se reutilizan:** `#profile-form`, `Panel`, `ModalDialog`, `Button`, `ToastNotice`.
7. **Distribución visual:** 2 paneles en `#faf6ee`: izquierda *Datos personales* (nombre, correo readonly, teléfono, guardar); derecha *Direcciones de entrega* (lista de tarjetas de dirección + botón `+ Nueva dirección`).
8. **Componentes de interfaz:** Formularios con validación Zod, tarjetas de dirección con badge `Predeterminada`, `ModalDialog` para alta/edición/borrado, `Button`.
9. **Información que se muestra:** Nombre completo, correo de cuenta, teléfono, direcciones guardadas (alias, dirección, barrio, indicaciones).
10. **Acciones disponibles:** Guardar datos personales, agregar/editar/eliminar dirección, marcar dirección predeterminada, solicitar cambio de contraseña, cerrar sesión.
11. **Validaciones:** Nombre `>= 2`; teléfono `[+0-9 ()-]{7,24}`; dirección y barrio obligatorios; columna `role` inmutable por el cliente.
12. **Estados de carga:** Botón `GUARDAR` deshabilitado durante petición.
13. **Estados vacíos:** En direcciones: *"No tienes direcciones guardadas todavía"* + CTA `+ Agregar dirección`.
14. **Mensajes de error:** Errores por campo en `#a64225`.
15. **Mensajes de éxito:** Toast *"Perfil actualizado correctamente"* / *"Dirección guardada"*.
16. **Comportamiento responsive:** 2 columnas en escritorio (`>= 900px`); 1 columna en móvil.
17. **Navegación de entrada y salida:** Entrada desde navegación interna de `/cliente`. Salida hacia otras secciones de `/cliente`.
18. **Criterios de aceptación:** Cambios de nombre/teléfono y direcciones predeterminadas se pre-llenan automáticamente en el Checkout.

---

## 3. Checkout de 5 pasos y Pagos simulados

1. **Nombre:** Checkout (`/checkout`).
2. **Objetivo:** Completar pedidos de `Domicilio`, `Recoger` o `En mesa`, ejecutar el pago simulado correspondiente y emitir comprobante imprimible.
3. **Perfil autorizado:** Usuario autenticado (`cliente`, D-06).
4. **Estado actual:** Implementado parcialmente (`MEJORAR` con D-03, D-04, D-06 y 3 modalidades).
5. **Archivo o componente existente relacionado:** `index.html` (`L113-L116`), `js/checkout.js` (`L1-L17`), `css/styles.css` (`L7`).
6. **Elementos que se reutilizan:** `.checkout-shell`, `.checkout-progress`, `.checkout-summary`, `.payment-options`, `PrintableReceipt`, `Button`.
7. **Distribución visual:** Contenedor centrado en `#e9dfcf` (`min(820px, 100%)`) con barra de 5 pasos:
   - *Paso 1 (Revisión):* Ítems, cantidades, complementos explícitos (`is_addon`), notas y subtotal.
   - *Paso 2 (Modalidad):* 3 tarjetas seleccionables (`Domicilio`, `Recoger en restaurante`, `Consumir en mesa`).
   - *Paso 3 (Servicio):* Campos dinámicos según modalidad (dirección + tarifa fija D-03 en Domicilio; hora estimada en Recoger; mesa disponible/reserva en Mesa).
   - *Paso 4 (Pago simulado):* `Efectivo`, `Tarjeta`, `Nequi`, `PSE` con aviso explícito *"Simulación controlada · Sin cobro real"*. En modalidad **Mesa**, muestra aviso claro de **pago `Pendiente` hasta cierre de cuenta (D-04)**.
   - *Paso 5 (Confirmación):* Comprobante imprimible (`PrintableReceipt`) con número `FB-...`, estado inicial `Pendiente`, pago y botón `VER SEGUIMIENTO`.
8. **Componentes de interfaz:** Stepper 5 pasos, tarjetas de selección, formularios Zod, resumen de importes, `PrintableReceipt`, `Button`.
9. **Información que se muestra:** Productos, complementos, notas, subtotal, tarifa fija de domicilio (D-03), total calculado en servidor, modalidad, medio y estado de pago simulado.
10. **Acciones disponibles:** Ajustar/agregar complementos en Paso 1, avanzar/retroceder, elegir dirección guardada o nueva, simular pago (aprobado o fallo controlado para pruebas), imprimir comprobante, ir a seguimiento.
11. **Validaciones:** Sesión activa (D-06); carrito no vacío; dirección y barrio obligatorios en domicilio; mesa/reserva libre en mesa; precios y tarifa recalculados en servidor vía RPC `create_order`.
12. **Estados de carga:** Botón bloqueado con *"PROCESANDO PEDIDO..."* previniendo envíos duplicados (clave de idempotencia).
13. **Estados vacíos:** Si el carrito está vacío, redirige a `/menu` con aviso.
14. **Mensajes de error:** Si el pago simulado resulta `Fallido` o un producto se agotó, muestra alerta en `#a64225` conservando carrito y formulario para reintentar.
15. **Mensajes de éxito:** Confirmación visual *"¡Pedido confirmado!"*, limpieza inmediata del carrito y comprobante listo.
16. **Comportamiento responsive:** Stepper con `flex-wrap`; tarjetas en columna única en `<= 700px`; `@media print` limpio.
17. **Navegación de entrada y salida:** Entrada desde Drawer de Carrito. Salida hacia `/cliente/pedidos/:orderId`, `/cliente` o `/` (sin `window.location.reload()`).
18. **Criterios de aceptación:** Cumple D-03, D-04 y D-06; sin XSS; limpia el carrito exactamente al confirmarse el pedido en BD.

---

## 4. Mis pedidos e Historial

1. **Nombre:** Mis pedidos (`/cliente/pedidos`).
2. **Objetivo:** Mostrar los pedidos activos e históricos del cliente con filtros rápidos.
3. **Perfil autorizado:** `cliente`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno.
6. **Elementos que se reutilizan:** `Panel`, `FilterToolbar`, `StatusBadge`, `EmptyState`, `money()`.
7. **Distribución visual:** Barra de filtros (`Todos`, `Activos`, `Completados`, `Cancelados`) + lista cronológica descendente de tarjetas en `#faf6ee`.
8. **Componentes de interfaz:** Pestañas de filtro, tarjetas de pedido, `StatusBadge` (preparación y pago), `Button` (`link`).
9. **Información que se muestra:** Número `FB-...`, fecha/hora local, modalidad, cantidad de productos, total, estado de preparación y estado de pago.
10. **Acciones disponibles:** Filtrar pedidos, abrir **Detalle y seguimiento** (`/cliente/pedidos/:orderId`).
11. **Validaciones:** Solo lectura de pedidos propios (`customer_id = auth.uid()`).
12. **Estados de carga:** 3 `SkeletonBlock`.
13. **Estados vacíos:** Mensaje por filtro + CTA `EXPLORAR MENÚ ↗`.
14. **Mensajes de error:** Banner con reintento.
15. **Mensajes de éxito:** N/A (pantalla de consulta).
16. **Comportamiento responsive:** Fila horizontal en escritorio; tarjeta apilada en móvil.
17. **Navegación de entrada y salida:** Entrada desde `/cliente`. Salida hacia `/cliente/pedidos/:orderId` o `/menu`.
18. **Criterios de aceptación:** Muestra pedidos de las 3 modalidades separando claramente estado de preparación y estado de pago.

---

## 5. Detalle y Seguimiento de pedido

1. **Nombre:** Seguimiento de pedido (`/cliente/pedidos/:orderId`).
2. **Objetivo:** Permitir al cliente seguir en tiempo real/actualizado el avance de su pedido y consultar/imprimir su comprobante.
3. **Perfil autorizado:** `cliente` propietario del pedido.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno (adapta `.checkout-progress` y `.receipt` de `css/styles.css` `L7`).
6. **Elementos que se reutilizan:** `OrderTimeline`, `Panel`, `StatusBadge`, `PrintableReceipt`, `Button`.
7. **Distribución visual:** Panel superior con línea temporal `OrderTimeline` en `#c66a32` + panel inferior en 2 columnas (ítems/totales a la izquierda; entrega/mesa + pago simulado a la derecha).
8. **Componentes de interfaz:** `OrderTimeline`, `StatusBadge`, `PrintableReceipt`, `Button`.
9. **Información que se muestra:** Pasos exactos según modalidad (`Recibido` → `Confirmado` → `En preparación` → `Listo` → `En camino` [solo Domicilio] → `Entregado`, o `Cancelado`), hora de cada cambio, detalle completo del pedido y comprobante.
10. **Acciones disponibles:** Actualizar vista (o suscripción Realtime), imprimir comprobante, volver a `Mis pedidos`. **Sin edición de estados.**
11. **Validaciones:** Control RLS asegurando propiedad del pedido.
12. **Estados de carga:** `SkeletonBlock` de línea temporal y resumen.
13. **Estados vacíos:** Estado `404` amigable si el ID no existe o no pertenece al cliente.
14. **Mensajes de error:** Aviso si se interrumpe la conexión Realtime con botón de refresco manual.
15. **Mensajes de éxito:** Actualización visual inmediata cuando el administrador avanza el estado.
16. **Comportamiento responsive:** Línea temporal horizontal en escritorio; vertical en móvil (`<= 700px`).
17. **Navegación de entrada y salida:** Entrada desde Checkout Paso 5, Dashboard o Mis pedidos. Salida hacia `/cliente/pedidos`.
18. **Criterios de aceptación:** Filtra pasos por modalidad; estrictamente de solo lectura para el cliente.

---

## 6. Mis reservas y Detalle de reserva

1. **Nombre:** Mis reservas (`/cliente/reservas` y `/cliente/reservas/:reservationId`).
2. **Objetivo:** Consultar reservas próximas e históricas, ver la mesa asignada y cancelar reservas permitidas.
3. **Perfil autorizado:** `cliente`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno.
6. **Elementos que se reutilizan:** `Panel`, `StatusBadge`, `ModalDialog`, `Button`, `EmptyState`, `ToastNotice`.
7. **Distribución visual:** Encabezado con `+ NUEVA RESERVA ↗`, bloque *Próximas reservas* y bloque *Historial* en tarjetas `#faf6ee`; detalle ampliado con código `RS-...`, zona y mesa asignada.
8. **Componentes de interfaz:** Tarjetas de reserva, `StatusBadge`, `ModalDialog` de confirmación de cancelación, `Button`.
9. **Información que se muestra:** Código `RS-...`, fecha, hora inicio/fin (según duración D-02), personas, mesa y zona asignadas, observaciones y estado (`Pendiente`, `Confirmada`, `Atendida`, `Cancelada`).
10. **Acciones disponibles:** Crear nueva reserva (`/reservas`), ver detalle y cancelar reserva activa.
11. **Validaciones:** Cancelación permitida solo si la reserva es propia, está en `Pendiente`/`Confirmada` y respeta la ventana de anticipación (P-02).
12. **Estados de carga:** `SkeletonBlock` de lista; botón bloqueado al cancelar.
13. **Estados vacíos:** *"Aún no tienes reservas"* + CTA `RESERVAR MESA ↗`.
14. **Mensajes de error:** Aviso si ya pasó la ventana permitida para cancelar o falla la operación.
15. **Mensajes de éxito:** Toast *"Reserva cancelada. La mesa fue liberada."*
16. **Comportamiento responsive:** Filas horizontales en escritorio; tarjetas apiladas en móvil.
17. **Navegación de entrada y salida:** Entrada desde `/cliente` o confirmación en `/reservas`. Salida hacia `/reservas` o `/cliente`.
18. **Criterios de aceptación:** Cancelar una reserva libera de inmediato el bloque horario de esa mesa para otros clientes.
