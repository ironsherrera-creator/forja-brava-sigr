# Especificación UI/UX — Experiencia del Mesero
## FORJA BRAVA — SIGR

Especificación detallada de las pantallas operativas del rol `mesero`, diseñadas para rapidez táctil en salón, reutilizando el shell de `css/admin.css` y el catálogo/carrito de `js/app.js`, bajo cumplimiento estricto de **D-01**, **D-04** y **D-05**.

---

## 1. Dashboard operativo del mesero

1. **Nombre:** Dashboard operativo (`/mesero`).
2. **Objetivo:** Mostrar en tiempo real el estado del salón y destacar los pedidos en estado `Listo` para llevar a mesa.
3. **Perfil autorizado:** `mesero`.
4. **Estado actual:** Pendiente (`CREAR` reutilizando shell de `admin.html` / `css/admin.css`).
5. **Archivo o componente existente relacionado:** Patrón de `admin.html` (`L1`) y `css/admin.css` (`L1`).
6. **Elementos que se reutilizan:** `AppSidebar` (subtítulo `SIGR · SERVICIO`), `TopBar`, `KpiGrid`, `Panel`, `StatusBadge`, `Button`.
7. **Distribución visual:**
```text
[ Sidebar (#171613): FB | Inicio · Mesas · Nuevo pedido · Pedidos ]
[ TopBar: SERVICIO EN SALÓN | Mesero [Nombre] | Cerrar sesión ]
[ KPIs (5): Mesas disponibles | Ocupadas | Reservadas | Pedidos activos | Listos para entregar ]
[ Acciones rápidas: Ver mesas | Nuevo pedido | Consultar pedidos ]
[ Panel destacado: Pedidos LISTOS para entregar en mesa (con botón directo "Marcar entregado") ]
```
8. **Componentes de interfaz:** `AppSidebar`, `TopBar`, `KpiGrid`, `Panel`, `StatusBadge`, `Button` (`action`).
9. **Información que se muestra:** Conteo en vivo de mesas por estado, pedidos registrados en el turno y alertas prioritarias de pedidos `Listo` en mesa.
10. **Acciones disponibles:** Ir a Mesas, crear pedido en mesa, consultar pedidos, marcar pedido `Listo` como `Entregado` (D-05), cerrar sesión.
11. **Validaciones:** Solo muestra datos de servicio en salón; cero acceso a métricas financieras, caja, precios editables ni usuarios.
12. **Estados de carga:** `SkeletonBlock` en KPIs y alertas.
13. **Estados vacíos:** *"No hay pedidos listos pendientes de entrega en este momento."*
14. **Mensajes de error:** `ToastNotice` oscuro con botón de refresco si cae la suscripción Realtime.
15. **Mensajes de éxito:** `ToastNotice` *"Pedido FB-... marcado como entregado en Mesa #X"*.
16. **Comportamiento responsive:** Sidebar colapsada a `66px` en `<= 800px`; botones táctiles `>= 48px`; KPIs en 2 columnas en móvil.
17. **Navegación de entrada y salida:** Entrada al iniciar sesión como `mesero`. Salida hacia `/mesero/mesas`, `/mesero/nuevo-pedido`, `/mesero/pedidos`.
18. **Criterios de aceptación:** Actualización rápida (Realtime) cuando el administrador cambia un pedido a `Listo`; respeta límites de D-05.

---

## 2. Mapa / Cuadrícula de mesas

1. **Nombre:** Mesas (`/mesero/mesas`).
2. **Objetivo:** Consultar disponibilidad del inventario dinámico de mesas (D-01), identificar zonas/capacidades y seleccionar una mesa para atenderla.
3. **Perfil autorizado:** `mesero`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Estilos `.cards-grid`, `.panel`, `.badge` en `css/admin.css` (`L1`).
6. **Elementos que se reutilizan:** `FilterToolbar`, `TableCard`, `StatusBadge`, `Button`, `EmptyState`.
7. **Distribución visual:** Toolbar con filtro por Zona, filtro por Estado (`Todas`, `Disponible`, `Ocupada`, `Reservada`, `Fuera de servicio`) y buscador de mesa + cuadrícula de `TableCard` de alto contraste.
8. **Componentes de interfaz:** `FilterToolbar`, `TableCard`, `StatusBadge` (`green` Disponible, `red` Ocupada, `fire` Reservada, `neutral` Fuera de servicio), `Button`.
9. **Información que se muestra:** Número/identificador, zona, capacidad, estado actual, cantidad de pedidos activos + total acumulado (si ocupada) y reserva próxima (hora y cliente si existe).
10. **Acciones disponibles:** En `Disponible`/`Reservada`: `TOMAR PEDIDO`. En `Ocupada`: `+ PEDIDO` y `VER CUENTA`. En `Fuera de servicio`: deshabilitado.
11. **Validaciones:** Impide abrir comanda en mesa `Fuera de servicio`; muestra alerta informativa si se ocupa una mesa que tiene reserva confirmada próxima.
12. **Estados de carga:** Cuadrícula de `SkeletonBlock`.
13. **Estados vacíos:** Si no hay mesas creadas en `ADM-07`: *"No hay mesas configuradas todavía."*
14. **Mensajes de error:** `ToastNotice` si falla la lectura de ocupación.
15. **Mensajes de éxito:** Feedback visual inmediato al cambiar de estado tras crear pedido.
16. **Comportamiento responsive:** 4 columnas en escritorio, 2 en tablet (`<= 800px`), 1–2 en móvil (`<= 480px`).
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Mesas`). Salida hacia `/mesero/nuevo-pedido?mesa=:id` o `/mesero/mesas/:id`.
18. **Criterios de aceptación:** Refleja en vivo el inventario configurado por el administrador (D-01).

---

## 3. Selector de productos, Comanda y Confirmación de pedido

1. **Nombre:** Nuevo pedido en mesa (`/mesero/nuevo-pedido`).
2. **Objetivo:** Registrar pedidos multi-producto en mesa con complementos, cantidades y observaciones en pocos toques.
3. **Perfil autorizado:** `mesero`.
4. **Estado actual:** Pendiente (`CREAR` / `REUTILIZAR` catálogo y lógica de carrito de `js/app.js`).
5. **Archivo o componente existente relacionado:** `js/app.js` (`L9-L54`), `css/styles.css` (`L1`), `css/admin.css` (`L1`).
6. **Elementos que se reutilizan:** `CategoryFilterBar`, `ProductCard` (modo `waiter` compacto), `QuantityStepper`, `Drawer` (móvil), `Button`, `ModalDialog`.
7. **Distribución visual:**
```text
[ Izquierda 65%: Selector Mesa #X | Buscador | Categorías | Grilla táctil de productos activos ]
[ Derecha 35% (Panel Comanda): Mesa #X | Ítems + Complementos + Cantidades | Observaciones | Total | ENVIAR COMANDA ]
```
8. **Componentes de interfaz:** Selector de mesa, `CategoryFilterBar`, `ProductCard` (`waiter`), modal rápido de complementos, `QuantityStepper`, textarea observaciones, `Button`.
9. **Información que se muestra:** Mesa elegida y zona, productos disponibles con precio de solo lectura, complementos explícitos, detalle de la comanda y total estimado.
10. **Acciones disponibles:** Elegir mesa, buscar/filtrar productos, sumar/restar cantidades, añadir complementos, escribir notas de cocina, vaciar comanda y confirmar envío.
11. **Validaciones:** Mesa activa seleccionada obligatoria; `>= 1` ítem activo con cantidad `>= 1`; precios inmutables calculados en servidor; crea pedido modalidad `Mesa`, estado `Pendiente` y pago `Pendiente` (D-04).
12. **Estados de carga:** Botón bloqueado (*"ENVIANDO..."*) con prevención de doble clic.
13. **Estados vacíos:** En panel comanda: *"Toca productos del menú para armar la comanda."*
14. **Mensajes de error:** Alerta clara si un producto fue desactivado o si la mesa pasó a `Fuera de servicio`.
15. **Mensajes de éxito:** `ToastNotice` *"Comanda FB-... registrada en Mesa #X"* y limpieza de la comanda.
16. **Comportamiento responsive:** Split 65/35 en escritorio/tablet horizontal; barra inferior fija con resumen que abre `Drawer` de comanda en móvil.
17. **Navegación de entrada y salida:** Entrada desde `Mesas` o sidebar. Salida hacia `/mesero/pedidos` o `/mesero/mesas/:id`.
18. **Criterios de aceptación:** Reutiliza catálogo centralizado; acumula el pedido en la cuenta abierta de la mesa (o abre una nueva cuenta si estaba libre) con pago `Pendiente` (D-04).

---

## 4. Pedidos registrados y Detalle del pedido

1. **Nombre:** Pedidos registrados (`/mesero/pedidos`).
2. **Objetivo:** Consultar los pedidos de mesas atendidas, ver su estado actualizado por el administrador, marcar entregas y cancelar pedidos recién registrados (D-05).
3. **Perfil autorizado:** `mesero`.
4. **Estado actual:** Pendiente (`CREAR` / `REUTILIZAR` tabla y modal detalle de `js/admin.js`).
5. **Archivo o componente existente relacionado:** Patrón de `js/admin.js` (`L12`, `L14`, `L25`).
6. **Elementos que se reutilizan:** `FilterToolbar`, `DataTable`, `StatusBadge`, `ModalDialog`, `Button`, `ToastNotice`.
7. **Distribución visual:** Toolbar (`Mesa`, `Estado`, `Número`) + tabla con columnas `NÚMERO`, `MESA`, `HORA`, `PRODUCTOS`, `OBSERVACIONES`, `ESTADO`, `ACCIONES`.
8. **Componentes de interfaz:** `FilterToolbar`, `DataTable`, `StatusBadge`, `ModalDialog` (detalle y confirmación de cancelación), `Button`.
9. **Información que se muestra:** Código `FB-...`, mesa, hora local, resumen de ítems, observaciones, estado actual de preparación y acciones permitidas.
10. **Acciones disponibles (estrictamente D-05):**
    - `Ver detalle`: abre `ModalDialog` con ítems, complementos y notas.
    - `Marcar entregado`: habilitado cuando el pedido está listo para servir (pasa a `Entregado`).
    - `Cancelar`: habilitado **exclusivamente en estado `Pendiente`** (antes de entrar a preparación).
11. **Validaciones:** Revalidación en BD/RPC de D-05; rechaza cancelación si el pedido ya pasó a `Confirmado` o `En preparación`.
12. **Estados de carga:** `SkeletonBlock` en filas; botón de fila bloqueado durante mutación.
13. **Estados vacíos:** *"No hay pedidos registrados para estos filtros."*
14. **Mensajes de error:** `ToastNotice` *"Este pedido ya entró en preparación y no puede ser cancelado por mesero."*
15. **Mensajes de éxito:** `ToastNotice` confirmando entrega o cancelación.
16. **Comportamiento responsive:** `.table-wrap` en tablet; tarjetas apiladas con botones táctiles en móvil (`<= 640px`).
17. **Navegación de entrada y salida:** Entrada desde sidebar o tras confirmar comanda. Salida hacia detalle en `ModalDialog` o cuenta de mesa.
18. **Criterios de aceptación:** No existen controles para modificar estados de preparación (`Confirmado`, `En preparación`, `Listo`); cumple D-05 tanto en UI como en RLS/RPC.

---

## 5. Detalle de mesa, Cuenta acumulada y Solicitud de cierre

1. **Nombre:** Cuenta de mesa (`/mesero/mesas/:tableId`).
2. **Objetivo:** Mostrar la cuenta acumulada de todos los pedidos activos de la mesa y solicitar su cierre para cobro en Caja (D-04).
3. **Perfil autorizado:** `mesero`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Patrones de `.panel` (`css/admin.css`) y `.receipt` (`css/styles.css` `L7`).
6. **Elementos que se reutilizan:** `Panel`, `StatusBadge`, `PrintableReceipt`, `ModalDialog`, `Button`, `ToastNotice`.
7. **Distribución visual:** Cabecera (`Mesa #X · Zona` + `+ AGREGAR PEDIDO` + `IMPRIMIR PRE-CUENTA`) + 2 columnas: lista de pedidos acumulados de la cuenta a la izquierda; total consolidado, estado de cuenta (`Abierta` / `Cierre solicitado`) y botón `SOLICITAR CIERRE DE CUENTA ↗` a la derecha.
8. **Componentes de interfaz:** `Panel`, lista de pedidos con `StatusBadge`, resumen financiero, `PrintableReceipt`, `ModalDialog` de confirmación, `Button`.
9. **Información que se muestra:** Todos los pedidos de la cuenta activa (los `Cancelados` tachados y excluidos del monto), desglose de ítems, subtotal, total consolidado y estado de pago (`Pendiente`).
10. **Acciones disponibles:** Añadir nueva comanda a la mesa (`/mesero/nuevo-pedido?mesa=:tableId`), imprimir pre-cuenta (`print()`), y **Solicitar cierre de cuenta** (notifica a Caja `ADM-09`).
11. **Validaciones:** Advierte si aún existen pedidos `Pendiente` o `En preparación` antes de solicitar el cierre; impide al mesero editar importes o registrar pagos contables directamente.
12. **Estados de carga:** Skeleton de resumen; botón bloqueado al enviar solicitud.
13. **Estados vacíos:** Si la mesa está `Disponible` sin cuenta abierta, botón `INICIAR PEDIDO EN MESA ↗`.
14. **Mensajes de error:** `ToastNotice` si falla la solicitud o la cuenta ya fue cerrada.
15. **Mensajes de éxito:** `ToastNotice` *"Cierre de cuenta solicitado para Mesa #X. Disponible en Caja para cobro."*
16. **Comportamiento responsive:** 2 columnas en escritorio; 1 columna en móvil con total y CTA visibles.
17. **Navegación de entrada y salida:** Entrada desde `Mesas` o `Pedidos`. Salida hacia `Nuevo pedido` o regreso a `Mesas`.
18. **Criterios de aceptación:** Acumula múltiples comandas en una sola cuenta (D-04), excluye cancelados y transfiere el cobro final a Caja sin duplicar ventas.
