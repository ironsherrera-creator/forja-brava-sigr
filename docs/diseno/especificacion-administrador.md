# Especificación Detallada — Experiencia del Administrador
## FORJA BRAVA — SIGR

Este documento especifica las 12 pantallas del panel administrativo (`ADM-01` a `ADM-12`), conservando la estructura y estética de `admin.html` y `css/admin.css`, completando los módulos parciales y especificando los módulos nuevos requeridos por el alcance SIGR y las decisiones **D-01 a D-06**.

---

## ADM-01: Acceso administrativo (Login unificado)

1. **Nombre:** Acceso administrativo (`/login` reemplazando `#login-screen` de `admin.html`).
2. **Objetivo:** Validar la identidad del administrador de forma segura antes de dar acceso al panel SIGR.
3. **Estado actual:** Visual / Parcial (`MEJORAR` eliminando credenciales hardcodeadas y unificando con `CLI-01`).
4. **Archivos existentes relacionados:** `admin.html` (`L1`, `#login-screen`), `js/admin.js` (`L8-L9`), `css/admin.css` (`L1`).
5. **Componentes reutilizables:** `.login-screen`, `.login-card`, `.brand`, `.password-field`, `.button-fire`, `.error-text`.
6. **Distribución visual:** Mantiene la estética de `.login-screen` (fondo degradado sobre `hero-forja-brava.png` y tarjeta crema `#f1e8d8`) unificada en el acceso `/login`.
7. **Información presentada:** Logotipo `FORJA BRAVA`, campos de correo y contraseña (vacíos por defecto, **sin valores precargados**), y enlace de recuperación.
8. **Acciones disponibles:** Iniciar sesión, alternar visibilidad de contraseña (`VER`), recuperar contraseña, volver al sitio público.
9. **Validaciones:** Autenticación real en servidor y validación estricta de rol `administrador` para acceder a `/admin/*`.
10. **Estados de carga, vacío y error:** Botón en estado cargando; errores claros en `.error-text`; redirección automática si un usuario `cliente` o `mesero` intenta abrir `/admin/*`.
11. **Comportamiento responsive:** Tarjeta `min(440px, 100%)` con padding `42px` en escritorio y `28px` en móvil (`<= 480px`).
12. **Navegación de entrada y salida:** Entrada por `/login` o redirección al intentar entrar a `/admin` sin sesión. Salida hacia `ADM-02` (`/admin`).
13. **Permisos requeridos:** Acceso público al formulario; autorización rol `administrador` para ingresar al panel.
14. **Criterios de aceptación:**
    - Ninguna credencial administrativa aparece en HTML ni JS.
    - No es posible acceder al panel manipulando `sessionStorage` ni quitando atributos `hidden` del DOM.

---

## ADM-02: Dashboard administrativo

1. **Nombre:** Panel principal (`/admin`).
2. **Objetivo:** Presentar los indicadores operativos y comerciales del día, la actividad reciente y accesos rápidos a todos los módulos SIGR.
3. **Estado actual:** Implementado en local (`CONSERVAR` estructura / `MEJORAR` layout de KPIs, zona horaria y navegación).
4. **Archivos existentes relacionados:** `admin.html` (`L1`), `js/admin.js` (`L11`, `L13`), `css/admin.css` (`L1`).
5. **Componentes reutilizables:** `.admin-sidebar`, `.admin-main`, `.admin-top`, `.stats-grid`, `.stat-card`, `.panel`, `.toolbar`, `.action-button`.
6. **Distribución visual:**
   - Sidebar fija izquierda en carbón `#171613` (`245px`) con navegación completa: `Panel principal`, `Productos`, `Categorías`, `Pedidos`, `Reservas`, `Mesas`, `Usuarios`, `Caja`, `Reportes`, `Auditoría`, `Configuración`, y enlace `↗ Ver sitio público`.
   - Cabecera `.admin-top` con título de vista y usuario autenticado + `CERRAR SESIÓN`.
   - Rejilla `.stats-grid` ajustada (`repeat(auto-fit, minmax(180px, 1fr))`) para las 5 tarjetas KPI + panel de actividad reciente y accesos rápidos.
7. **Información presentada:** `VENTAS HOY` (hora local `America/Bogota`), `PEDIDOS HOY`, `PENDIENTES`, `RESERVAS HOY`, `PRODUCTOS`, listado de últimos pedidos (con modalidad, estado y total) y estado de caja (abierta/cerrada).
8. **Acciones disponibles:** Navegar a cualquier módulo desde sidebar o accesos rápidos, abrir detalle de un pedido reciente, cerrar sesión.
9. **Validaciones:** Cálculos diarios basados estrictamente en fecha local `America/Bogota` y datos persistidos.
10. **Estados de carga, vacío y error:** Skeleton en KPIs; mensaje *"Aún no hay actividad hoy"* si no existen pedidos; `.notice` en caso de fallo.
11. **Comportamiento responsive:** En `<= 800px` sidebar colapsada a `66px` con iconos y KPIs en 2 columnas; en `<= 480px` padding compacto y cabecera apilada.
12. **Navegación de entrada y salida:** Entrada post-login admin. Salida hacia `ADM-03` a `ADM-12` y `/`.
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - Las 5 tarjetas KPI se alinean sin dejar una tarjeta huérfana.
    - Carga correctamente las tipografías `Playfair Display` y `DM Sans`.
    - Los cálculos de "HOY" son exactos después de las 7:00 p. m. hora Colombia.

---

## ADM-03: Gestión de productos

1. **Nombre:** Gestión de productos (`/admin/productos`).
2. **Objetivo:** Administrar el catálogo completo de productos y complementos visibles en el sitio público y en el panel del mesero.
3. **Estado actual:** Parcial (`MEJORAR` completando campos de formulario y carga de imagen).
4. **Archivos existentes relacionados:** `js/admin.js` (`L33-L35`), `css/admin.css` (`L1`, `.cards-grid`, `.product-admin`).
5. **Componentes reutilizables:** `.panel`, `.toolbar`, `.cards-grid`, `.product-admin`, `#record-dialog`, `.badge`, `.action-button`.
6. **Distribución visual:** Toolbar con buscador, filtro por categoría, filtro por disponibilidad y botón `+ Agregar producto`; cuadrícula de 3 columnas (`.cards-grid`) con tarjetas `.product-admin`.
7. **Información presentada:** Imagen, nombre, categoría, precio, etiqueta (si tiene), indicador de complemento (`is_addon`), badge de disponibilidad (`Activo`/`Inactivo`) y acciones.
8. **Acciones disponibles:** Crear, editar, activar/desactivar (desactivación lógica priorizada cuando existen pedidos históricos) y eliminar (solo si no tiene pedidos asociados).
9. **Validaciones:** Nombre obligatorio (`>= 2`); categoría seleccionada desde lista real de `ADM-04`; precio numérico `>= 1`; descripción obligatoria; imagen validada en formato/peso (WebP/PNG/JPG) al subir archivo; flag explícito de complemento y lista de complementos sugeridos.
10. **Estados de carga, vacío y error:** Skeleton en tarjetas y botón guardando; estado vacío si no hay productos en el filtro; error claro si se intenta eliminar un producto con historial (sugiriendo desactivar).
11. **Comportamiento responsive:** 3 columnas en escritorio, 2 en tablet (`<= 800px`), 1 en móvil (`<= 480px`).
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Productos`) o Dashboard. Modal `#record-dialog` para creación/edición.
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - El formulario incluye todos los campos: Nombre, Descripción, Categoría (selector), Precio, Imagen, Etiqueta, Complementos y Disponibilidad.
    - Prioriza desactivación lógica sobre borrado físico para preservar integridad histórica de reportes.

---

## ADM-04: Gestión de categorías

1. **Nombre:** Gestión de categorías (`/admin/categorias`).
2. **Objetivo:** Administrar las categorías que estructuran el menú digital, el panel del mesero y el catálogo administrativo.
3. **Estado actual:** Pendiente (`CREAR`).
4. **Archivos existentes relacionados:** Ninguno (reemplaza el `categoryMap` de `js/app.js` `L28`).
5. **Componentes reutilizables:** `.panel`, `.toolbar`, `.table-wrap`, `#record-dialog`, `.badge`, `.action-button`.
6. **Distribución visual:** Panel con toolbar (`+ Nueva categoría`, filtro de estado) y tabla con columnas: `ORDEN`, `NOMBRE`, `DESCRIPCIÓN`, `PRODUCTOS ASOCIADOS`, `ESTADO`, `ACCIONES`.
7. **Información presentada:** Orden de visualización, nombre, descripción, imagen opcional, cantidad de productos asociados y estado (`Activa`/`Inactiva`).
8. **Acciones disponibles:** Crear, editar, reordenar (subir/bajar o número de orden), activar/desactivar y consultar productos asociados.
9. **Validaciones:** Nombre único obligatorio (`>= 2`), orden entero `>= 0`; advertencia si se desactiva una categoría con productos activos.
10. **Estados de carga, vacío y error:** Skeleton en tabla; vacío con CTA `+ Nueva categoría`; error si el nombre ya existe.
11. **Comportamiento responsive:** `.table-wrap` con desplazamiento horizontal en pantallas estrechas.
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Categorías`). Salida hacia `ADM-03` filtrada por esa categoría al consultar productos asociados.
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - Cualquier categoría creada y activada aparece automáticamente como filtro en el menú público (`PUB-02`) y en `MES-03`.

---

## ADM-05: Gestión de pedidos

1. **Nombre:** Gestión de pedidos (`/admin/pedidos`).
2. **Objetivo:** Centralizar todos los pedidos (`Domicilio`, `Recoger`, `Mesa`) y permitir al administrador controlar todos los estados de preparación y su detalle.
3. **Estado actual:** Parcial (`MEJORAR` preservación de filtros, columnas faltantes, creación multi-producto y modal de detalle).
4. **Archivos existentes relacionados:** `js/admin.js` (`L12`, `L14`, `L23`, `L25`, `L29-L30`, `L32`).
5. **Componentes reutilizables:** `.stats-grid`, `.panel`, `.toolbar`, `.table-wrap`, `#record-dialog`, `.badge`.
6. **Distribución visual:** KPIs resumidos + panel con toolbar de filtros (`Número o cliente`, `Fecha`, `Estado`, `Modalidad`) y botón `+ Nuevo pedido` + tabla de pedidos.
7. **Información presentada:** Columnas: `NÚMERO`, `CLIENTE`, `FECHA`, `MODALIDAD` (con número de mesa si aplica), `TOTAL`, `ESTADO` (selector de preparación), `PAGO` (badge de estado de pago simulado), `ACCIONES` (`Ver detalle`). En modal detalle: datos cliente, ítems, complementos, observaciones, dirección o mesa, importes, pago e historial de cambios de estado.
8. **Acciones disponibles:** Filtrar pedidos sin perder filtros al operar, cambiar estado de preparación (`Pendiente`, `Confirmado`, `En preparación`, `Listo`, `Despachado`, `Entregado`, `Cancelado`), ver detalle, cambiar estado dentro del detalle mediante `<select>` (sin `prompt()`), registrar reembolso simulado si se cancela un pedido pagado, y crear pedido manual multi-producto.
9. **Validaciones:** Transiciones coherentes con la modalidad (ej. `Despachado` solo en `Domicilio`); en pedido manual, al menos 1 producto activo y modalidad definida.
10. **Estados de carga, vacío y error:** Skeleton en filas; estado vacío *"No hay pedidos para estos filtros"*; error en `.notice` si falla una actualización.
11. **Comportamiento responsive:** Toolbar con `flex-wrap` y tabla dentro de `.table-wrap`.
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Pedidos`) o Dashboard. Modal `#record-dialog` para detalle y creación.
13. **Permisos requeridos:** Rol `administrador` (único responsable de estados de preparación).
14. **Criterios de aceptación:**
    - Al cambiar el estado de un pedido, los filtros escritos en la barra superior **no se borran**.
    - Elimina el uso de `window.prompt()` en el modal de detalle.
    - Muestra historial de cambios de estado y distingue claramente las 3 modalidades.

---

## ADM-06: Gestión de reservas y Calendario

1. **Nombre:** Gestión de reservas (`/admin/reservas`).
2. **Objetivo:** Administrar reservas de clientes, visualizar ocupación diaria/mensual en calendario, asignar o reasignar mesas y aplicar la duración configurable (D-02).
3. **Estado actual:** Parcial (`MEJORAR` calendario, asignación de mesas, validaciones y hora local).
4. **Archivos existentes relacionados:** `js/admin.js` (`L15-L16`, `L24`, `L26-L27`, `L31`), `css/admin.css` (`L2`, `.calendar-grid`).
5. **Componentes reutilizables:** `.stats-grid`, `.panel`, `.toolbar`, `.calendar-grid`, `.table-wrap`, `#record-dialog`, `.badge`.
6. **Distribución visual:** Toolbar con filtros (`Nombre o teléfono`, `Desde`, `Hasta`, `Estado`), botón `+ Nueva reserva` y toggle `Calendario`; vista de ocupación mensual `.calendar-grid` + tabla de reservas.
7. **Información presentada:** Código (`RS-...`), cliente/teléfono, fecha, hora y duración (D-02), personas, **mesa asignada**, estado (`Pendiente`, `Confirmada`, `Atendida`, `Cancelada`) y observaciones.
8. **Acciones disponibles:** Crear/editar reserva con validación de disponibilidad, cambiar estado, cancelar, navegar meses en calendario y abrir **modal de detalle diario** al hacer clic en un día (reemplazando `alert()`).
9. **Validaciones:** Fecha `>=` hoy en `America/Bogota`; `personas >= 1`; horario dentro de atención; mesa asignada con capacidad suficiente y sin solapamiento según duración configurada (D-02).
10. **Estados de carga, vacío y error:** Skeleton en tabla/calendario; vacío *"No hay reservas"*; error claro si la mesa/horario elegido se solapa con otra reserva activa.
11. **Comportamiento responsive:** Calendario en 7 columnas adaptables (`minmax(32px, 1fr)`) y tabla en `.table-wrap`.
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Reservas`) o Dashboard. Modales en `#record-dialog`.
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - Conserva `.calendar-grid` y reemplaza `alert()` por un modal limpio de ocupación del día.
    - Impide registrar reservas solapadas en la misma mesa respetando D-01 y D-02.

---

## ADM-07: Gestión de mesas

1. **Nombre:** Gestión de mesas (`/admin/mesas`).
2. **Objetivo:** Configurar el inventario dinámico de mesas del restaurante (D-01), su capacidad, zona y estado operativo, y consultar ocupación en vivo.
3. **Estado actual:** Pendiente (`CREAR`).
4. **Archivos existentes relacionados:** Ninguno (comparte modelo visual con `MES-02`).
5. **Componentes reutilizables:** `.panel`, `.toolbar`, `.cards-grid`, `.badge`, `#record-dialog`, `.action-button`.
6. **Distribución visual:** Toolbar con filtro por zona, filtro por estado y botón `+ Nueva mesa`; cuadrícula `.cards-grid` mostrando todas las mesas con su estado, reservas del día y pedido activo.
7. **Información presentada:** Número/identificador único de mesa, zona (ej. Salón, Terraza, Barra), capacidad de personas, estado (`Disponible`, `Ocupada`, `Reservada`, `Fuera de servicio`), reserva próxima y cuenta/pedidos asociados.
8. **Acciones disponibles:** Crear mesa, editar mesa (número, zona, capacidad), cambiar disponibilidad (`Activa` / `Fuera de servicio`), consultar reservas y pedidos asociados.
9. **Validaciones:** Identificador único obligatorio; capacidad entera `>= 1`; no permitir desactivar (`Fuera de servicio`) una mesa que tenga una cuenta abierta sin cerrar sin advertencia previa.
10. **Estados de carga, vacío y error:** Skeleton en cuadrícula; estado vacío con CTA `+ Crear primera mesa`; error si el número de mesa ya existe.
11. **Comportamiento responsive:** 3–4 columnas en escritorio, 2 en tablet (`<= 800px`), 1 en móvil (`<= 480px`).
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Mesas`) o desde `ADM-12` (`Configuración`). Modales en `#record-dialog`.
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - Permite agregar, editar y desactivar mesas libremente sin cantidad fija (D-01).
    - Los cambios se reflejan inmediatamente en el motor de reservas (`PUB-05`, `ADM-06`) y en el panel del mesero (`MES-02`).

---

## ADM-08: Gestión de usuarios y roles

1. **Nombre:** Gestión de usuarios (`/admin/usuarios`).
2. **Objetivo:** Administrar las cuentas registradas en el sistema, activar o desactivar accesos y asignar roles autorizados (`administrador`, `mesero`, `cliente`).
3. **Estado actual:** Pendiente (`CREAR`).
4. **Archivos existentes relacionados:** Ninguno.
5. **Componentes reutilizables:** `.panel`, `.toolbar`, `.table-wrap`, `.badge`, `#record-dialog`, `.action-button`.
6. **Distribución visual:** Toolbar con buscador (nombre o correo), filtro por rol (`Todos`, `Administrador`, `Mesero`, `Cliente`), filtro por estado (`Activo`/`Inactivo`) y botón `+ Crear usuario interno` (para meseros/administradores); tabla de usuarios.
7. **Información presentada:** Nombre completo, correo electrónico, teléfono, rol (badge diferenciado), estado (`Activo`/`Inactivo`) y fecha de registro.
8. **Acciones disponibles:** Consultar perfil, crear usuario interno (`mesero` / `administrador`), cambiar rol (con confirmación), activar o desactivar cuenta.
9. **Validaciones:** Un administrador no puede desactivarse ni quitarse el rol a sí mismo si es el único administrador activo; el rol jamás puede ser autoasignado por un cliente; toda modificación de rol o estado se registra en `ADM-11` (Auditoría).
10. **Estados de carga, vacío y error:** Skeleton en tabla; estado vacío para filtros sin coincidencia; error claro ante operaciones restringidas.
11. **Comportamiento responsive:** `.table-wrap` con scroll horizontal en móvil.
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Usuarios`). Modal `#record-dialog` para creación/edición de rol.
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - Permite gestionar los 3 roles oficiales del SIGR.
    - Bloquea la auto-desactivación del último administrador y registra auditoría de cambios de rol.

---

## ADM-09: Caja

1. **Nombre:** Gestión de caja (`/admin/caja`).
2. **Objetivo:** Controlar la apertura de turno, base inicial, cobro de cuentas de mesa cerradas (D-04), movimientos de ingresos/egresos, arqueo de efectivo y cierre de caja sin duplicar ingresos.
3. **Estado actual:** Parcial (`MEJORAR` ampliando cierre básico de `js/admin.js`).
4. **Archivos existentes relacionados:** `js/admin.js` (`L17`, `L28`), `css/admin.css` (`L1`).
5. **Componentes reutilizables:** `.stats-grid`, `.panel`, `.toolbar`, `.table-wrap`, `#record-dialog`, `.action-button`, `.notice`.
6. **Distribución visual:**
   - Estado superior del turno de caja (`Caja Abierta` con hora/base o `Caja Cerrada` con botón `Abrir caja`).
   - Tarjetas KPI del turno: `Base inicial`, `Ventas efectivo`, `Ventas digitales`, `Ingresos/Egresos`, `Efectivo esperado`.
   - Panel de **Cuentas de mesa por cobrar** (solicitudes provenientes de `MES-05`, D-04).
   - Panel de **Movimientos del turno** (con botones `+ Ingreso` / `+ Egreso`) + sección **Arqueo y cierre** (campo `Efectivo contado`, cálculo automático de `Diferencia`, observaciones y `Cerrar caja`) + tabla **Historial de cierres**.
7. **Información presentada:** Base inicial, ventas clasificadas por método de pago (sin duplicar efectivo vs. digital), movimientos manuales, cuentas de mesa pendientes de cobro, efectivo esperado, efectivo contado, diferencia y cierres históricos.
8. **Acciones disponibles:** Abrir turno con base inicial, registrar cobro de cuenta de mesa (liberando la mesa), registrar ingreso/egreso manual con concepto, ejecutar arqueo y cerrar turno de caja, consultar historial de cierres.
9. **Validaciones:** Base inicial `>= 0`; monto de movimiento `> 0` con concepto obligatorio; no permitir cierre si no hay caja abierta; incluir pedidos entregados/cobrados pendientes de cierre incluso si cruzaron medianoche (corrige bug UTC de `js/admin.js`).
10. **Estados de carga, vacío y error:** Estado de caja cerrada bloqueando operaciones hasta abrir turno; confirmación modal (en lugar de `confirm()` nativo) al cerrar caja; avisos en `.notice`.
11. **Comportamiento responsive:** KPIs en 2 columnas en tablet/móvil y tablas en `.table-wrap`.
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Caja`). Modales en `#record-dialog`.
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - Los pedidos de mesa solo se contabilizan como venta cobrada al cerrar la cuenta (D-04).
    - Clasifica efectivo y pagos digitales sin duplicar totales.
    - Calcula automáticamente `Diferencia = Efectivo contado - Efectivo esperado`.

---

## ADM-10: Reportes

1. **Nombre:** Reportes (`/admin/reportes`).
2. **Objetivo:** Proveer indicadores claros de ventas diarias y por periodo, desempeño de productos, modalidades, métodos de pago, reservas y cierres de caja, con soporte de impresión/PDF.
3. **Estado actual:** Implementado parcialmente (`CONSERVAR` estética e impresión / `MEJORAR` desgloses y agrupación por ID).
4. **Archivos existentes relacionados:** `js/admin.js` (`L18-L19`, `L30`), `css/admin.css` (`L1-L2`, `.report-bar`, `@media print`).
5. **Componentes reutilizables:** `.stats-grid`, `.panel`, `.toolbar`, `.report-bar`, `.table-wrap`, `@media print`.
6. **Distribución visual:** Toolbar con selectores de fecha (`Desde`, `Hasta`), accesos rápidos (`Hoy`, `Últimos 7 días`, `Este mes`) y botón `Imprimir / PDF`; 4 tarjetas KPI + bloques visuales de barras y tablas desglosadas.
7. **Información presentada:** Ventas del periodo, ventas diarias, pedidos totales, ticket promedio, cancelados, gráfico de barras por estado, **pedidos por modalidad** (`Domicilio`, `Recoger`, `Mesa`), **desglose por método de pago**, **productos más vendidos** (agrupados por `product_id` mostrando unidades y monto `$`), resumen de reservas y movimientos/cierres de caja del rango.
8. **Acciones disponibles:** Filtrar por rango de fechas, imprimir/exportar PDF (`window.print()`).
9. **Validaciones:** Rango coherente (`Desde <= Hasta`); exclusión de pedidos `Cancelado` de ventas y rankings; fechas evaluadas en `America/Bogota`.
10. **Estados de carga, vacío y error:** Skeleton al recalcular rango; mensajes claros por sección si el rango no tiene registros; aviso en error.
11. **Comportamiento responsive:** KPIs en 2 columnas en móvil; `@media print` oculta sidebar y botones dejando un informe limpio.
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Reportes`) o Dashboard.
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - Agrupa productos por identificador único (no por nombre) mostrando unidades y ventas.
    - Elimina el código muerto existente en `report()` (`js/admin.js` `L18`).

---

## ADM-11: Auditoría del sistema

1. **Nombre:** Auditoría (`/admin/auditoria`).
2. **Objetivo:** Proveer trazabilidad de solo lectura sobre las operaciones críticas realizadas por administradores y meseros.
3. **Estado actual:** Pendiente (`CREAR`).
4. **Archivos existentes relacionados:** Ninguno.
5. **Componentes reutilizables:** `.panel`, `.toolbar`, `.table-wrap`, `.badge`, `#record-dialog`.
6. **Distribución visual:** Panel con toolbar de filtros (`Usuario`, `Rol`, `Módulo/Entidad`, `Fecha desde/hasta`) y tabla cronológica descendente.
7. **Información presentada:** Fecha y hora local, usuario y rol que ejecutó la acción, módulo (`Pedidos`, `Reservas`, `Mesas`, `Usuarios`, `Caja`, `Configuración`), acción realizada (ej. cambio de estado, cancelación de mesero, cierre de caja, cambio de rol) y acceso al detalle (antes/después).
8. **Acciones disponibles:** Filtrar registros y abrir modal `#record-dialog` para ver el detalle técnico/funcional del cambio. **Solo lectura** (sin editar ni eliminar registros).
9. **Validaciones:** Solo lectura inmutable.
10. **Estados de carga, vacío y error:** Skeleton en tabla; vacío *"No hay eventos de auditoría en este rango"*; error con reintento.
11. **Comportamiento responsive:** `.table-wrap` con scroll horizontal.
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Auditoría`).
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - Registra y muestra cambios de estado de pedidos, cancelaciones (incluidas las del mesero bajo D-05), cierres de caja y cambios de rol.
    - Ningún usuario puede editar o borrar filas desde la interfaz.

---

## ADM-12: Configuración del restaurante

1. **Nombre:** Configuración (`/admin/configuracion`).
2. **Objetivo:** Centralizar todos los parámetros editables del restaurante que hoy viven quemados en constantes del código (`CONFIG` y `deliveryFee`), además de parámetros de D-01, D-02 y D-03.
3. **Estado actual:** Pendiente (`CREAR`).
4. **Archivos existentes relacionados:** Constantes `CONFIG` en `js/app.js` (`L1-L7`) y `deliveryFee` en `js/checkout.js` (`L2`).
5. **Componentes reutilizables:** `.panel`, `.record-form`, `.action-button`, `.notice`.
6. **Distribución visual:** Formulario organizado en paneles temáticos sobre `#faf6ee`:
   - *Información general y contacto:* Nombre comercial, dirección física, teléfono, WhatsApp, enlaces de Instagram/Facebook, producto destacado del inicio (`#destacado`).
   - *Horarios de atención:* Horario de apertura y cierre por día de la semana (usado por sitio público y motor de reservas).
   - *Operación y tarifas:* **Tarifa fija de domicilio** (D-03, valor numérico editable por el restaurante), **Duración estándar de turno de reserva en minutos** (D-02), ventana de anticipación para cancelar reservas y acceso directo a *Gestión de Mesas* (`ADM-07`, D-01).
7. **Información presentada:** Valores actuales vigentes en producción y fecha de última actualización.
8. **Acciones disponibles:** Editar parámetros por sección, guardar cambios y navegar al inventario de mesas (`ADM-07`).
9. **Validaciones:** Tarifa fija de domicilio numérica `>= 0`; duración de reserva entera `>= 15` minutos; horario de apertura menor que horario de cierre; formato válido de WhatsApp (solo dígitos con indicativo, ej. `57300...`) y URLs válidas en redes sociales.
10. **Estados de carga, vacío y error:** Botón en estado guardando; notificación `.notice` al guardar correctamente; mensajes inline en `#a64225` por campo inválido.
11. **Comportamiento responsive:** Campos en 2 columnas en escritorio y 1 columna en móvil (`<= 700px`).
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Configuración`). Enlace interno hacia `ADM-07` (`Mesas`).
13. **Permisos requeridos:** Rol `administrador`.
14. **Criterios de aceptación:**
    - Actualizar la tarifa fija de domicilio (D-03) o la duración de reservas (D-02) impacta inmediatamente en el Checkout (`CLI-05`) y en el motor de Reservas (`PUB-05`, `ADM-06`).
    - Actualizar datos de contacto o producto destacado impacta inmediatamente en `PUB-01` y `PUB-06`.
