# Especificación Detallada — Experiencia del Cliente
## FORJA BRAVA — SIGR

Este documento especifica las 8 pantallas de la experiencia del cliente (`CLI-01` a `CLI-08`), incorporando la autenticación obligatoria para pedidos y reservas (**D-06**), la tarifa fija de domicilio (**D-03**), el pago en mesa al cierre (**D-04**), las 3 modalidades de pedido y los pagos simulados.

---

## CLI-01: Inicio de sesión y Recuperación de contraseña

1. **Nombre:** Inicio de sesión (`/login` y evolución de `#auth-modal`).
2. **Objetivo:** Autenticar de forma segura a clientes, meseros y administradores y redirigir a cada usuario a su experiencia correspondiente según su rol.
3. **Estado actual:** Parcial (`MEJORAR` autenticación real, redirección por rol y recuperación de contraseña).
4. **Archivos existentes relacionados:** `index.html` (`L82-L92`), `admin.html` (`L1`, `#login-screen`), `css/styles.css` (`L6`), `js/app.js` (`L70-L83`).
5. **Componentes reutilizables:** `.auth-card`, `.auth-tabs`, `.password-field` (de `admin.css`), `.button-fire`, `.auth-message`.
6. **Distribución visual:** Tarjeta centrada en papel `#e9dfcf` / crema `#f1e8d8` (ancho `min(480px, 100%)`) sobre fondo carbón/hero degradado o backdrop modal; logotipo `FB`, pestañas `INICIAR SESIÓN` / `REGISTRARME`, campos de correo y contraseña con botón mostrar/ocultar, enlace `¿Olvidaste tu contraseña?` y botón primario `.button-fire`.
7. **Información presentada:** Instrucción contextual si viene redirigido desde Checkout o Reservas (*"Inicia sesión para completar tu pedido/reserva"*), campos de acceso y mensajes de estado.
8. **Acciones disponibles:** Iniciar sesión, mostrar/ocultar contraseña, cambiar a Registro (`CLI-02`), iniciar flujo de recuperación de contraseña (envío de enlace por correo) y volver al sitio público.
9. **Validaciones:** Correo con formato válido y obligatorio; contraseña obligatoria; validación real de credenciales y estado activo de cuenta en servidor.
10. **Estados de carga, vacío y error:**
    - *Carga:* Botón deshabilitado con texto *"INGRESANDO..."*.
    - *Vacío:* Validación inline en campos requeridos.
    - *Error:* Mensaje genérico en `.auth-message` (*"El correo o la contraseña no son correctos"* o *"Tu cuenta está inactiva"*), sin exponer detalles técnicos.
11. **Comportamiento responsive:** Tarjeta centrada con padding `32px` en escritorio y `24px` con ancho `100%` en móvil (`<= 480px`).
12. **Navegación de entrada y salida:** Entrada desde botón `MI CUENTA`, ruta `/login`, o compuerta automática desde Checkout/Reservas (D-06). Salida según rol: `cliente` → destino previo o `/cliente`; `mesero` → `/mesero`; `administrador` → `/admin`.
13. **Permisos requeridos:** Acceso público (visitantes no autenticados).
14. **Criterios de aceptación:**
    - Unifica el acceso de los 3 roles eliminando las credenciales quemadas de `admin.html`.
    - Incluye flujo funcional de recuperación de contraseña.
    - Tras iniciar sesión desde Checkout o Reservas, retorna al paso donde quedó sin perder el carrito.

---

## CLI-02: Registro de cliente

1. **Nombre:** Registro de cliente (`/registro` y pestaña `REGISTRARME`).
2. **Objetivo:** Permitir a nuevos clientes crear su cuenta personal para realizar pedidos, reservas y seguimiento.
3. **Estado actual:** Parcial (`MEJORAR` migrando de `forja-clientes-demo` a autenticación real).
4. **Archivos existentes relacionados:** `index.html` (`L93-L100`), `css/styles.css` (`L6`), `js/app.js` (`L84`).
5. **Componentes reutilizables:** `.auth-card`, `.auth-tabs`, `.button-fire`, `.auth-message`, `.toast`.
6. **Distribución visual:** Misma tarjeta editorial de `CLI-01` con pestaña `REGISTRARME` activa y campos en bloque: Nombre completo, Correo electrónico, Teléfono, Contraseña y Confirmar contraseña.
7. **Información presentada:** Etiquetas claras, requisitos de contraseña (mínimo 8 caracteres) y retroalimentación de validación.
8. **Acciones disponibles:** Crear cuenta, mostrar/ocultar contraseñas, alternar a Iniciar sesión (`CLI-01`).
9. **Validaciones:** Nombre `>= 2` caracteres; correo electrónico válido y no registrado previamente; teléfono con formato `[+0-9 ()-]{7,24}`; contraseña `>= 8` caracteres; coincidencia exacta con confirmación; **rol asignado automáticamente en servidor como `cliente`** (nunca seleccionable desde la interfaz).
10. **Estados de carga, vacío y error:**
    - *Carga:* Botón deshabilitado (*"CREANDO CUENTA..."*).
    - *Vacío:* Validación por campo antes de enviar.
    - *Error:* Avisos claros para correo duplicado, contraseñas distintas o error de red.
11. **Comportamiento responsive:** Scroll vertical fluido dentro de la tarjeta (`max-height: 90vh`) en dispositivos móviles.
12. **Navegación de entrada y salida:** Entrada desde `MI CUENTA` → `REGISTRARME` o `/registro`. Salida hacia confirmación de acceso y redirección al flujo previo (Checkout/Reservas) o Dashboard del cliente (`CLI-03`).
13. **Permisos requeridos:** Acceso público.
14. **Criterios de aceptación:**
    - Nunca permite que un usuario se registre con rol `mesero` o `administrador`.
    - Impide correos duplicados (insensible a mayúsculas/minúsculas).
    - Conserva el carrito activo tras completar el registro.

---

## CLI-03: Dashboard del cliente

1. **Nombre:** Dashboard del cliente (`/cliente`).
2. **Objetivo:** Brindar al cliente un espacio personal independiente del modal de perfil actual para consultar de un vistazo sus pedidos activos, último pedido, próximas reservas y accesos rápidos.
3. **Estado actual:** Pendiente (`CREAR` reutilizando el lenguaje de `.stats-grid` y `.panel` sobre crema `#f1e8d8`).
4. **Archivos existentes relacionados:** Ninguno (sustituye la limitación de `.profile-view` en `index.html` `L101-L110`).
5. **Componentes reutilizables:** `.brand`, `.stats-grid`, `.stat-card`, `.panel`, `.badge`, `.button-fire`, `.action-button`.
6. **Distribución visual:**
   - Encabezado en carbón `#171613` (o barra superior limpia) con logotipo `FB`, saludo personalizado (`Hola, [Nombre]`), enlaces rápidos (`Menú`, `Reservar`) y botón `CERRAR SESIÓN`.
   - Navegación interna por pestañas o barra lateral ligera: `Resumen`, `Mis pedidos`, `Mis reservas`, `Mi perfil`.
   - Cuerpo en crema `#f1e8d8` con 4 tarjetas KPI (`.stats-grid`: Pedidos activos, Último pedido, Próximas reservas, Historial de compras) y dos paneles inferiores: *Seguimiento rápido de pedido activo* y *Próxima reserva confirmada*.
7. **Información presentada:** Conteo de pedidos activos, resumen del último pedido con estado en `.badge`, próxima reserva (fecha, hora, personas, mesa asignada) y total histórico de pedidos.
8. **Acciones disponibles:** Ir a hacer nuevo pedido (`/menu`), solicitar nueva reserva (`/reservas`), abrir seguimiento de pedido activo (`CLI-07`), navegar a `Mis pedidos`, `Mis reservas` o `Mi perfil`, cerrar sesión.
9. **Validaciones:** Verifica sesión activa y rol válido; solo consulta registros pertenecientes al `user_id` autenticado.
10. **Estados de carga, vacío y error:**
    - *Carga:* Tarjetas KPI y paneles en skeleton.
    - *Vacío:* Para clientes nuevos sin pedidos ni reservas, mostrar bienvenida cálida con botones `EXPLORAR MENÚ ↗` y `RESERVAR MESA ↗`.
    - *Error:* Mensaje amigable con botón de reintento si falla la consulta.
11. **Comportamiento responsive:** 4 tarjetas KPI en escritorio, 2 columnas en tablet/móvil (`<= 800px`), navegación interna en pestañas horizontales deslizables en móvil.
12. **Navegación de entrada y salida:** Entrada al pulsar `MI CUENTA · [Nombre]` en header o al iniciar sesión como cliente. Salida hacia `/menu`, `/reservas`, `CLI-04`, `CLI-06`, `CLI-07`, `CLI-08` o cierre de sesión hacia `/`.
13. **Permisos requeridos:** Sesión autenticada (rol `cliente`).
14. **Criterios de aceptación:**
    - Es una vista independiente y diferenciada del panel administrativo.
    - Muestra únicamente información propia del cliente autenticado.
    - Permite acceder en un clic al seguimiento de cualquier pedido activo.

---

## CLI-04: Mi perfil y direcciones de entrega

1. **Nombre:** Mi perfil (`/cliente/perfil`).
2. **Objetivo:** Permitir al cliente consultar y actualizar sus datos personales y administrar sus direcciones habituales para agilizar pedidos a domicilio.
3. **Estado actual:** Parcial (`MEJORAR` sacándolo del modal `#auth-modal` y añadiendo direcciones de entrega).
4. **Archivos existentes relacionados:** `index.html` (`L101-L110`), `js/app.js` (`L78`, `L85-L86`).
5. **Componentes reutilizables:** `#profile-form`, `.panel`, `.record-form`, `.button-fire`, `.logout-button`, `.toast`.
6. **Distribución visual:** Dos paneles en superficie `#faf6ee` con borde `#e1d3bc`:
   - Panel 1 (*Datos personales*): Nombre completo, Correo electrónico (solo lectura / gestionado por proveedor auth), Teléfono, botón `GUARDAR CAMBIOS ↗`.
   - Panel 2 (*Mis direcciones de entrega*): Listado de direcciones guardadas (alias, dirección, barrio, indicaciones, marca de predeterminada) con botón `+ Agregar dirección`, editar y eliminar.
7. **Información presentada:** Datos actuales del perfil, estado de última actualización y libreta de direcciones guardadas.
8. **Acciones disponibles:** Editar nombre y teléfono, agregar/editar/eliminar/marcar predeterminada una dirección de entrega, cerrar sesión.
9. **Validaciones:** Nombre `>= 2` caracteres; teléfono válido (`[+0-9 ()-]{7,24}`); dirección y barrio obligatorios al guardar una dirección; el cliente **no puede modificar su propio rol**.
10. **Estados de carga, vacío y error:**
    - *Carga:* Botón `GUARDAR` deshabilitado durante persistencia.
    - *Vacío:* En direcciones, texto *"Aún no tienes direcciones guardadas"* con botón para crear la primera.
    - *Error:* Mensajes inline en `#a64225` ante fallos de validación o conexión.
11. **Comportamiento responsive:** Dos columnas en escritorio (`>= 900px`), apilado vertical en móvil.
12. **Navegación de entrada y salida:** Entrada desde navegación interna de `CLI-03`. Salida hacia otras pestañas de `/cliente` o cierre de sesión.
13. **Permisos requeridos:** Sesión autenticada (solo lectura/edición de su propio perfil).
14. **Criterios de aceptación:**
    - Los cambios de nombre y teléfono se reflejan inmediatamente en el saludo del header y en futuros checkouts.
    - Las direcciones guardadas aparecen como selección rápida en el Paso 3 del checkout a domicilio.

---

## CLI-05: Checkout en 5 pasos y Pagos simulados

1. **Nombre:** Proceso de compra / Checkout (`/checkout` o `#checkout-modal` ampliado).
2. **Objetivo:** Guiar al cliente autenticado en la confirmación de su pedido para cualquiera de las 3 modalidades (`Domicilio`, `Recoger`, `Mesa`), aplicar las reglas de pago simulado y emitir el comprobante imprimible.
3. **Estado actual:** Parcial (`MEJORAR` incorporando D-03, D-04, D-06, 3 modalidades y corrección de defectos).
4. **Archivos existentes relacionados:** `index.html` (`L113-L116`), `js/checkout.js` (`L1-L17`), `css/styles.css` (`L7`).
5. **Componentes reutilizables:** `.checkout-shell`, `.checkout-head`, `.checkout-progress`, `.checkout-form`, `.checkout-summary`, `.payment-options`, `.receipt`, `@media print`.
6. **Distribución visual:** Contenedor editorial en papel `#e9dfcf` (ancho `min(760px, 100%)`) con barra de progreso de 5 etapas en la parte superior y resumen lateral/inferior constante:
   - **Paso 1 — Revisión del pedido:** Lista de productos, cantidades, complementos explícitos disponibles (sin regex de Salchipapas), observaciones y subtotal.
   - **Paso 2 — Modalidad:** Tres tarjetas seleccionables: `Domicilio`, `Recoger en restaurante`, `Consumir en mesa`.
   - **Paso 3 — Información del servicio:**
     - *Domicilio:* Datos pre-llenados del perfil + selector de dirección guardada o nueva (dirección, barrio, indicaciones) + línea visible con **tarifa fija de domicilio** (D-03).
     - *Recoger:* Datos del cliente pre-llenados + dirección del restaurante + hora estimada de recogida (cuando corresponda).
     - *Mesa:* Selector de mesa disponible validada o reserva activa del cliente + número de personas.
   - **Paso 4 — Pago simulado:** Selección de medio (`Efectivo`, `Tarjeta`, `Nequi`, `PSE`) con aviso visible *"Simulación controlada · No ingreses datos bancarios reales"*. Para modalidad **Mesa**, informa explícitamente que **el pago queda `Pendiente` hasta el cierre de cuenta (D-04)**. Para medios digitales en Domicilio/Recoger, permite confirmar simulación (y opcionalmente probar estado `Fallido` en pruebas).
   - **Paso 5 — Confirmación y Comprobante:** Código `FB-...`, detalle completo, modalidad, medio y estado de pago, estado inicial `Pendiente`, botón `IMPRIMIR COMPROBANTE`, botón `SEGUIR MI PEDIDO` y `FINALIZAR`.
7. **Información presentada:** Desglose de ítems, complementos, observaciones, subtotal, tarifa fija de domicilio (si aplica), total calculado desde precios oficiales, estado de pago y número de orden.
8. **Acciones disponibles:** Agregar/quitar complementos en Paso 1, avanzar/retroceder entre pasos, seleccionar modalidad y datos de servicio, ejecutar pago simulado, imprimir comprobante y pasar al seguimiento.
9. **Validaciones:**
   - **D-06:** Bloqueado si no hay sesión activa.
   - Carrito no vacío y productos activos.
   - Campos obligatorios según modalidad (dirección y barrio en domicilio; mesa/reserva válida y disponible en mesa).
   - Recálculo de precios y tarifa fija exclusivamente en servidor al confirmar.
   - Escapado seguro de todo texto ingresado por el usuario (eliminación de XSS detectado en `js/checkout.js`).
10. **Estados de carga, vacío y error:**
    - *Carga:* Estado *"Registrando pedido..."* evitando doble envío al pulsar confirmar.
    - *Vacío:* Si el carrito se vacía, impedir avanzar y ofrecer botón `VOLVER AL MENÚ`.
    - *Error:* Si el pago simulado resulta `Fallido` o una mesa deja de estar disponible, mostrar mensaje claro en `.checkout-error` sin borrar el carrito ni los datos diligenciados.
11. **Comportamiento responsive:** Stepper con ajuste `flex-wrap`, tarjetas de modalidad y opciones de pago en fila en escritorio y apiladas a `100%` en móvil (`<= 700px`). Mantiene `@media print` limpio para el Paso 5.
12. **Navegación de entrada y salida:** Entrada desde `PUB-04` (Carrito). Salida hacia `CLI-07` (`Seguimiento`), `CLI-03` (`Dashboard`) o `/` sin recarga dura (`window.location.reload()` eliminado).
13. **Permisos requeridos:** Sesión autenticada (D-06).
14. **Criterios de aceptación:**
    - Limpia el carrito inmediatamente al confirmar la creación del pedido (no solo al pulsar `FINALIZAR`).
    - Pre-llena automáticamente nombre, correo y teléfono del cliente autenticado.
    - Aplica tarifa fija en domicilio (D-03) y deja pago `Pendiente` en modalidad mesa (D-04).

---

## CLI-06: Mis pedidos e historial

1. **Nombre:** Mis pedidos (`/cliente/pedidos`).
2. **Objetivo:** Permitir al cliente consultar sus pedidos en curso y su historial completo de compras con acceso al detalle y comprobante.
3. **Estado actual:** Pendiente (`CREAR`).
4. **Archivos existentes relacionados:** Ninguno (reutiliza el formato de comprobante de `js/checkout.js` `L12`).
5. **Componentes reutilizables:** `.panel`, `.toolbar`, `.filter-btn` / filtros de pestaña, `.badge`, `.receipt`, `money()`.
6. **Distribución visual:** Cabecera con pestañas de filtro (`Todos`, `Activos`, `Completados`, `Cancelados`) y listado de tarjetas limpias en `#faf6ee` con borde `#e1d3bc`, ordenadas del pedido más reciente al más antiguo.
7. **Información presentada:** Por tarjeta: número de pedido (`FB-...`), fecha y hora local, modalidad (`Domicilio`, `Recoger`, `Mesa`), resumen de cantidad de ítems, total, badge de estado de preparación y badge de estado de pago.
8. **Acciones disponibles:** Filtrar por grupo de estado, abrir **Seguimiento / Detalle** (`CLI-07`) y reimprimir comprobante.
9. **Validaciones:** Solo muestra pedidos donde `customer_id` coincide con el usuario autenticado.
10. **Estados de carga, vacío y error:**
    - *Carga:* 3 tarjetas skeleton.
    - *Vacío:* Mensaje contextual según filtro (ej. *"No tienes pedidos activos en este momento"*) + CTA `HACER UN PEDIDO ↗`.
    - *Error:* Aviso con botón de reintento.
11. **Comportamiento responsive:** Tarjetas horizontales en escritorio; contenido apilado en 2 bloques (encabezado + pie con total y botón) en móvil.
12. **Navegación de entrada y salida:** Entrada desde `CLI-03` (`Dashboard`). Salida hacia `CLI-07` (`Seguimiento`) o `/menu`.
13. **Permisos requeridos:** Sesión autenticada (`cliente`).
14. **Criterios de aceptación:**
    - Refleja los pedidos de las 3 modalidades.
    - Separa claramente estado de preparación y estado de pago.

---

## CLI-07: Seguimiento de pedido

1. **Nombre:** Seguimiento de pedido (`/cliente/pedidos/:id`).
2. **Objetivo:** Mostrar al cliente la evolución en tiempo real/actualizada del estado de su pedido según la modalidad elegida, junto con el detalle completo.
3. **Estado actual:** Pendiente (`CREAR`).
4. **Archivos existentes relacionados:** Ninguno (adapta el indicador `.checkout-progress` de `css/styles.css` `L7`).
5. **Componentes reutilizables:** `.panel`, `.badge`, `.receipt`, `.checkout-progress` (adaptado a línea temporal), `@media print`.
6. **Distribución visual:**
   - Panel superior con número de pedido, fecha, modalidad y **línea temporal visual** en acento fuego `#c66a32` mostrando hitos completados, estado actual destacado y pasos pendientes.
   - Panel inferior dividido en 2 columnas: desglose de productos/complementos/observaciones/totales a la izquierda; datos de entrega o mesa + información de pago simulado a la derecha.
7. **Información presentada:**
   - Línea temporal filtrada por modalidad:
     - *Domicilio:* `Recibido` → `Confirmado` → `En preparación` → `Listo` → `En camino (Despachado)` → `Entregado`.
     - *Recoger:* `Recibido` → `Confirmado` → `En preparación` → `Listo para recoger` → `Entregado`.
     - *Mesa:* `Recibido` → `Confirmado` → `En preparación` → `Listo` → `Entregado`.
   - Si el pedido fue `Cancelado`, mostrar estado cancelado con fecha/hora y motivo si aplica.
8. **Acciones disponibles:** Actualizar/consultar estado, imprimir comprobante y volver a `Mis pedidos` (`CLI-06`). **Sin acciones de edición de estado** (solo lectura para cliente).
9. **Validaciones:** Verifica propiedad del pedido (`customer_id === usuario actual`); si no corresponde o no existe, retorna vista de no encontrado/no autorizado.
10. **Estados de carga, vacío y error:**
    - *Carga:* Skeleton de línea temporal y detalle.
    - *Vacío / No encontrado:* Mensaje *"No encontramos este pedido"* con botón para volver a `Mis pedidos`.
    - *Error:* Aviso de error de conexión con botón `RECARGAR ESTADO`.
11. **Comportamiento responsive:** Línea temporal horizontal en escritorio; línea temporal vertical compacta en móvil (`<= 700px`).
12. **Navegación de entrada y salida:** Entrada desde `CLI-05` (Paso 5), `CLI-03` o `CLI-06`. Salida hacia `CLI-06` (`Mis pedidos`).
13. **Permisos requeridos:** Sesión autenticada (`cliente` propietario del pedido).
14. **Criterios de aceptación:**
    - Oculta pasos irrelevantes para la modalidad (ej. nunca muestra `En camino` en pedidos `Recoger` o `Mesa`).
    - El cliente puede visualizar cambios realizados por el administrador o entregas del mesero, pero jamás modificarlos.

---

## CLI-08: Mis reservas

1. **Nombre:** Mis reservas (`/cliente/reservas`).
2. **Objetivo:** Permitir al cliente consultar sus reservas próximas e históricas y cancelar aquellas permitidas por la política del restaurante.
3. **Estado actual:** Pendiente (`CREAR`).
4. **Archivos existentes relacionados:** Ninguno.
5. **Componentes reutilizables:** `.panel`, `.badge`, `.action-button`, `#record-dialog` (confirmación de cancelación), `.toast`.
6. **Distribución visual:** Encabezado con botón `+ NUEVA RESERVA ↗` y listado de tarjetas de reserva sobre `#faf6ee`, separando visualmente *Próximas reservas* e *Historial*.
7. **Información presentada:** Código de reserva (`RS-...`), fecha, hora de inicio y duración estimada (D-02), número de personas, mesa y zona asignadas (cuando corresponda), observaciones y badge de estado (`Pendiente`, `Confirmada`, `Atendida`, `Cancelada`).
8. **Acciones disponibles:** Crear nueva reserva (`PUB-05`) y cancelar reserva activa con modal de confirmación.
9. **Validaciones:** Solo permite cancelar reservas propias en estado `Pendiente` o `Confirmada` y dentro de la ventana de anticipación permitida por la configuración del restaurante.
10. **Estados de carga, vacío y error:**
    - *Carga:* Skeleton de listado.
    - *Vacío:* Mensaje *"Aún no tienes reservas registradas"* con botón `RESERVAR UNA MESA ↗`.
    - *Error:* Aviso si falla la cancelación o ya venció el plazo permitido.
11. **Comportamiento responsive:** Tarjetas con información en fila en escritorio y apilada en móvil con botón `Cancelar` de ancho completo.
12. **Navegación de entrada y salida:** Entrada desde `CLI-03` (`Dashboard`) o tras confirmar en `PUB-05`. Salida hacia `PUB-05` (nueva reserva) o `CLI-03`.
13. **Permisos requeridos:** Sesión autenticada (`cliente` propietario).
14. **Criterios de aceptación:**
    - Al cancelar una reserva, cambia su estado a `Cancelada` y libera inmediatamente el bloque horario de la mesa asignada.
    - Muestra la mesa asignada y la confirmación automática obtenida en `PUB-05`.
