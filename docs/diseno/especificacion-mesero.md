# Especificación Detallada — Experiencia del Mesero
## FORJA BRAVA — SIGR

Este documento especifica las 5 pantallas del panel operativo del mesero (`MES-01` a `MES-05`), diseñado para operación rápida y táctil en salón, reutilizando el catálogo de `js/app.js` y la estructura visual de `css/admin.css`, y aplicando estrictamente las decisiones **D-01**, **D-04** y **D-05**.

---

## MES-01: Dashboard operativo del mesero

1. **Nombre:** Dashboard operativo del mesero (`/mesero`).
2. **Objetivo:** Ofrecer al mesero una vista inmediata del estado del salón y de los pedidos que requieren atención o entrega en mesa.
3. **Estado actual:** Pendiente (`CREAR` reutilizando el shell visual de `admin.html` y `css/admin.css`).
4. **Archivos existentes relacionados:** Reutiliza patrones de `admin.html` (`L1`) y `css/admin.css` (`L1`).
5. **Componentes reutilizables:** `.admin-sidebar`, `.brand` (subtítulo `SIGR · SERVICIO`), `.admin-main`, `.admin-top`, `.stats-grid`, `.stat-card`, `.panel`, `.action-button`, `.badge`.
6. **Distribución visual:**
   - Sidebar izquierda fija en carbón `#171613` con 4 accesos claros: `Inicio`, `Mesas`, `Nuevo pedido`, `Pedidos`, más botón `CERRAR SESIÓN` en cabecera superior.
   - Área principal en crema `#f1e8d8`: 5 tarjetas KPI operativas (`.stats-grid` adaptable) + barra de acciones rápidas (`Ver mesas`, `Crear pedido`, `Consultar pedidos`) + panel destacado de **Pedidos listos para entregar en mesa**.
7. **Información presentada:**
   - KPIs: `Mesas disponibles`, `Mesas ocupadas`, `Mesas reservadas`, `Pedidos registrados`, `Listos para entregar` (resaltado en acento fuego `#c66a32` cuando es > 0).
   - Lista rápida de pedidos en estado `Listo` correspondientes a mesas para entrega inmediata.
8. **Acciones disponibles:** Navegar a Mesas (`MES-02`), iniciar toma de pedido (`MES-03`), consultar todos sus pedidos (`MES-04`), marcar directamente un pedido `Listo` como `Entregado` (D-05), cerrar sesión.
9. **Validaciones:** Verifica sesión activa con rol `mesero`. Solo expone operaciones de servicio en salón (nunca métricas de ventas financieras globales ni accesos administrativos).
10. **Estados de carga, vacío y error:**
    - *Carga:* Skeletons en KPIs y lista de alertas de entrega.
    - *Vacío:* En alertas: *"No hay pedidos pendientes por llevar a mesa en este momento."*
    - *Error:* Notificación `.notice` con opción de actualizar.
11. **Comportamiento responsive:** En tablet (`<= 800px`) sidebar colapsada a iconos (`66px`) con botones táctiles grandes (`>= 48px` de altura); en móvil (`<= 480px`) KPIs en 2 columnas y acciones rápidas a ancho completo.
12. **Navegación de entrada y salida:** Entrada automática al iniciar sesión con rol `mesero` en `/login`. Salida hacia `MES-02`, `MES-03`, `MES-04` o cierre de sesión hacia `/login`.
13. **Permisos requeridos:** Sesión autenticada con rol `mesero` (o `administrador` en modo supervisión si se habilita).
14. **Criterios de aceptación:**
    - No muestra menús ni cifras restringidas al administrador (precios editables, caja, reportes financieros, usuarios).
    - Permite identificar en menos de 3 segundos qué pedidos están `Listo` para llevar a la mesa.

---

## MES-02: Mapa / Cuadrícula de mesas

1. **Nombre:** Gestión visual de mesas (`/mesero/mesas`).
2. **Objetivo:** Permitir al mesero consultar la disponibilidad en tiempo real de las mesas configuradas por administración (D-01), ver reservas asociadas y seleccionar una mesa para tomar pedido o revisar su cuenta.
3. **Estado actual:** Pendiente (`CREAR` reutilizando `.cards-grid`, `.panel`, `.badge` y `.toolbar` de `css/admin.css`).
4. **Archivos existentes relacionados:** Reutiliza estilos de `css/admin.css` (`L1`, `.cards-grid`, `.panel`, `.badge`).
5. **Componentes reutilizables:** `.toolbar`, `.cards-grid`, `.panel`, `.badge` (`.green`, `.red`, neutro), `.action-button`.
6. **Distribución visual:**
   - Toolbar superior con filtro por **Zona** (ej. Todas, Salón, Terraza — generadas desde D-01), filtro por **Estado** (`Todas`, `Disponible`, `Ocupada`, `Reservada`, `Fuera de servicio`) y buscador por número de mesa.
   - Cuadrícula de tarjetas amplias y táctiles (`.cards-grid`), cada una con borde de estado claro y encabezado en `Playfair Display` con el número de mesa.
7. **Información presentada:** Por tarjeta de mesa: número/identificador, zona, capacidad (personas), badge de estado (`Disponible` verde, `Ocupada` rojo/terracota, `Reservada` arena/fuego, `Fuera de servicio` atenuado), resumen de pedido activo (cantidad de pedidos y total acumulado si está ocupada) y reserva próxima asociada (hora y nombre del cliente si existe).
8. **Acciones disponibles:**
   - En mesa `Disponible` o `Reservada` (cuando llega el cliente): botón `TOMAR PEDIDO` → `MES-03` con mesa preseleccionada.
   - En mesa `Ocupada`: botón `+ AGREGAR PEDIDO` → `MES-03` y botón `VER CUENTA / CERRAR` → `MES-05`.
   - En mesa `Fuera de servicio`: botones de pedido deshabilitados.
9. **Validaciones:** No permite iniciar pedidos en mesas `Fuera de servicio`. Si una mesa está `Reservada` para un bloque inmediato, muestra aviso visible con el nombre y hora de la reserva antes de ocuparla.
10. **Estados de carga, vacío y error:**
    - *Carga:* Cuadrícula de tarjetas skeleton.
    - *Vacío:* Si no hay mesas configuradas en el sistema: *"El administrador aún no ha configurado mesas."* Si el filtro no arroja resultados: *"No hay mesas con estos filtros."*
    - *Error:* Aviso `.notice` con botón `RECARGAR MESAS`.
11. **Comportamiento responsive:** 4 columnas en escritorio amplio, 3 en escritorio medio, 2 en tablet (`<= 800px`) y 1–2 columnas grandes en móvil (`<= 480px`) optimizadas para uso táctil.
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Mesas`) o Dashboard (`MES-01`). Salida hacia `MES-03` (con mesa seleccionada) o `MES-05` (cuenta de mesa).
13. **Permisos requeridos:** Rol `mesero` (lectura de inventario de mesas y operación de servicio; no puede crear, editar ni eliminar mesas).
14. **Criterios de aceptación:**
    - Refleja exactamente el inventario dinámico de mesas configurado en `ADM-07` (D-01).
    - Diferencia visualmente los 4 estados de mesa usando la paleta oficial de FORJA BRAVA.

---

## MES-03: Toma de pedido en mesa (Comanda)

1. **Nombre:** Nuevo pedido en mesa (`/mesero/nuevo-pedido`).
2. **Objetivo:** Permitir al mesero registrar de forma ágil un pedido multi-producto con complementos y observaciones asociado a una mesa específica.
3. **Estado actual:** Pendiente (`CREAR` / `REUTILIZAR` catálogo y lógica de carrito de `js/app.js`).
4. **Archivos existentes relacionados:** Reutiliza lógica y catálogo de `js/app.js` (`L9-L54`) y patrones de `css/styles.css` / `css/admin.css`.
5. **Componentes reutilizables:** `.filters`, `.filter-btn`, tarjetas de producto compactas, lógica `cart` (`Map`), `.cart-line`, `.cart-quantity`, `.action-button`, `.notice`.
6. **Distribución visual:**
   - Pantalla dividida en 2 paneles en escritorio/tablet horizontal (`65% / 35%`):
     - **Izquierda (Catálogo rápido):** Selector de mesa activa (si no vino preseleccionada), buscador instantáneo, pestañas de categorías activas y grilla de tarjetas compactas de productos disponibles con precio y botón táctil `+`.
     - **Derecha (Comanda en construcción):** Encabezado con `Mesa #X` y zona, lista de productos agregados con botones `− / +`, selección rápida de complementos, campo de observaciones generales o por ítem, subtotal estimado y botón `ENVIAR COMANDA A COCINA ↗`.
7. **Información presentada:** Mesa seleccionada, catálogo filtrado (solo productos activos), complementos disponibles, ítems en la comanda, cantidades, observaciones y total de la comanda.
8. **Acciones disponibles:** Cambiar/seleccionar mesa, buscar y filtrar productos, agregar/quitar productos, añadir complementos, editar observaciones, limpiar comanda y confirmar pedido.
9. **Validaciones:**
   - Mesa seleccionada obligatoria y no `Fuera de servicio`.
   - Al menos 1 producto activo con cantidad `>= 1`.
   - Precios de solo lectura (tomados del catálogo oficial; el mesero nunca edita precios).
   - Al confirmar, el pedido se registra con modalidad `Mesa`, estado inicial `Pendiente` y **pago `Pendiente` (D-04)**, acumulándose en la cuenta de la mesa.
10. **Estados de carga, vacío y error:**
    - *Carga:* Botón de confirmar deshabilitado (*"ENVIANDO COMANDA..."*) evitando duplicados por doble toque.
    - *Vacío:* En el panel derecho: *"Toca los productos para armar la comanda de esta mesa."*
    - *Error:* Mensaje claro si un producto se desactivó o falla la red, conservando los ítems en pantalla.
11. **Comportamiento responsive:** 2 columnas lado a lado en escritorio/tablet horizontal; en móvil/tablet vertical, catálogo arriba y barra inferior fija con resumen (`X ítems · $Total`) que despliega la comanda tipo drawer (reutilizando `.cart-drawer`).
12. **Navegación de entrada y salida:** Entrada desde `MES-02` (tarjeta de mesa), `MES-01` o sidebar (`Nuevo pedido`). Salida tras confirmar hacia `MES-04` (Pedidos registrados) o `MES-02` (Mesas) con notificación `.notice`.
13. **Permisos requeridos:** Rol `mesero`.
14. **Criterios de aceptación:**
    - Reutiliza el catálogo centralizado y permite múltiples productos en una sola comanda.
    - Cambia automáticamente una mesa `Disponible` a `Ocupada` al registrar su primer pedido.
    - Registra el pedido con pago `Pendiente` sin solicitar cobro inmediato (D-04).

---

## MES-04: Pedidos registrados de mesas

1. **Nombre:** Pedidos registrados (`/mesero/pedidos`).
2. **Objetivo:** Permitir al mesero consultar el estado de los pedidos de sus mesas, marcar entregas y cancelar pedidos recién registrados dentro de los límites autorizados por D-05.
3. **Estado actual:** Pendiente (`CREAR` / `REUTILIZAR` tabla y detalle de `js/admin.js`).
4. **Archivos existentes relacionados:** Reutiliza patrones de `js/admin.js` (`L12`, `L14`, `L25`) y `css/admin.css` (`L1`).
5. **Componentes reutilizables:** `.panel`, `.toolbar`, `.table-wrap`, `.badge`, `#record-dialog`, `.action-button`, `.notice`.
6. **Distribución visual:**
   - Toolbar con filtros por mesa, estado (`Todos`, `Pendiente`, `Confirmado`, `En preparación`, `Listo`, `Entregado`, `Cancelado`) y búsqueda por número de pedido.
   - Tabla operativa (`.table-wrap`) con columnas: `NÚMERO`, `MESA`, `HORA`, `PRODUCTOS`, `OBSERVACIONES`, `ESTADO`, `ACCIONES`.
7. **Información presentada:** Número de pedido (`FB-...`), mesa y zona, hora de registro, resumen de ítems y cantidades, observaciones, badge de estado actualizado por el administrador y botones de acción permitidos.
8. **Acciones disponibles (estrictamente bajo D-05):**
   - `Ver detalle`: abre `#record-dialog` con desglose completo.
   - `Marcar entregado`: visible/activo cuando el pedido de mesa está listo para entrega (ej. estado `Listo`) y pasa el pedido a `Entregado`.
   - `Cancelar`: visible/activo **únicamente cuando el estado es `Pendiente`** (recién registrado, sin haber entrado a preparación). Abre modal de confirmación con motivo opcional.
   - **Acciones prohibidas:** No existen botones ni selectores para cambiar a `Confirmado`, `En preparación` ni `Listo`.
9. **Validaciones:** Revalidación en servidor de la regla D-05: si el administrador movió el pedido a `Confirmado` o `En preparación` segundos antes de que el mesero intentara cancelarlo, la cancelación se rechaza con mensaje claro y se refresca la fila.
10. **Estados de carga, vacío y error:**
    - *Carga:* Filas skeleton en tabla.
    - *Vacío:* *"No hay pedidos registrados para estos filtros."*
    - *Error:* Aviso en `.notice` si la transición no está permitida por el estado actual del pedido.
11. **Comportamiento responsive:** Tabla con scroll horizontal en `.table-wrap` en tablet; en móvil (`<= 640px`), tarjetas apiladas por pedido con botones táctiles claros de `Marcar entregado` / `Cancelar`.
12. **Navegación de entrada y salida:** Entrada desde sidebar (`Pedidos`), `MES-01` o tras enviar comanda en `MES-03`. Salida hacia detalle en `#record-dialog` o hacia `MES-05` (Cuenta de mesa).
13. **Permisos requeridos:** Rol `mesero`.
14. **Criterios de aceptación:**
    - Cumple estrictamente D-05: solo permite `Entregado` y `Cancelado` (este último exclusivamente en estado `Pendiente`).
    - Los cambios de estado realizados por el administrador se reflejan claramente y sin recargar manualmente filtros.

---

## MES-05: Cuenta activa de mesa y Solicitud de cierre

1. **Nombre:** Cuenta activa de mesa (`/mesero/mesas/:id`).
2. **Objetivo:** Consolidar todos los pedidos acumulados en una mesa ocupada y permitir al mesero consultar el total y solicitar el cierre de cuenta para su cobro controlado en Caja (D-04).
3. **Estado actual:** Pendiente (`CREAR`).
4. **Archivos existentes relacionados:** Reutiliza estilos de `.panel`, `.checkout-summary` y `.receipt` (`css/styles.css` `L7`, `css/admin.css` `L1`).
5. **Componentes reutilizables:** `.panel`, `.table-wrap`, `.badge`, `.receipt`, `.action-button`, `@media print`.
6. **Distribución visual:**
   - Encabezado con `Mesa #X · [Zona]`, capacidad, estado actual y botones `+ AGREGAR PEDIDO` y `IMPRIMIR PRE-CUENTA`.
   - Cuerpo en 2 columnas:
     - Izquierda: lista agrupada de todos los pedidos de la cuenta actual (con su estado de preparación; los `Cancelados` tachados/excluidos del total).
     - Derecha: resumen consolidado de ítems, subtotal, total acumulado a pagar, estado de pago (`Pendiente`) y botón `SOLICITAR CIERRE DE CUENTA ↗`.
7. **Información presentada:** Pedidos acumulados en la mesa, ítems, cantidades, precios unitarios, total consolidado, estado de cada pedido y estado del cobro.
8. **Acciones disponibles:** Agregar un nuevo pedido a la misma mesa (`MES-03`), imprimir pre-cuenta (`print()`), y **Solicitar cierre de cuenta** (envía la cuenta a `ADM-09` Caja para el cobro definitivo y liberación de la mesa).
9. **Validaciones:**
   - Advierte si existen pedidos todavía `En preparación` o sin entregar antes de solicitar el cierre de cuenta.
   - El mesero **no** registra movimientos contables ni modifica el saldo de caja directamente; el cobro definitivo queda bajo control del proceso administrativo autorizado (D-04).
10. **Estados de carga, vacío y error:**
    - *Carga:* Skeleton del resumen de cuenta.
    - *Vacío:* Si la mesa está `Disponible` sin pedidos activos, muestra estado vacío con CTA `INICIAR PEDIDO EN ESTA MESA ↗`.
    - *Error:* Aviso en `.notice` si falla la solicitud de cierre.
11. **Comportamiento responsive:** 2 columnas en escritorio; apilado vertical en tablet/móvil con resumen y botón de cierre al final.
12. **Navegación de entrada y salida:** Entrada desde `MES-02` (tarjeta de mesa ocupada) o `MES-04`. Salida hacia `MES-03` (añadir más ítems) o regreso a `MES-02`.
13. **Permisos requeridos:** Rol `mesero`.
14. **Criterios de aceptación:**
    - Acumula múltiples pedidos realizados en la misma mesa en un único total consolidado (D-04).
    - Excluye pedidos `Cancelado` del total a cobrar.
    - Genera la solicitud de cierre hacia Caja sin permitir manipulación de montos ni duplicación de pagos.
