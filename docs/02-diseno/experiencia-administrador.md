# Especificación UI/UX — Experiencia del Administrador
## FORJA BRAVA — SIGR

Especificación integral de las pantallas del rol `administrador`, conservando el shell de `admin.html` / `css/admin.css` y cubriendo las 18 dimensiones obligatorias por módulo.

---

## 1. Dashboard administrativo

1. **Nombre:** Panel principal (`/admin`).
2. **Objetivo:** Mostrar KPIs diarios en hora local (`America/Bogota`), actividad reciente, estado de caja y accesos rápidos.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Implementado y funcional en local (`CONSERVAR` / `MEJORAR`).
5. **Archivo o componente existente relacionado:** `admin.html` (`L1`), `js/admin.js` (`L11`, `L13`), `css/admin.css` (`L1`).
6. **Elementos que se reutilizan:** `AppSidebar`, `TopBar`, `KpiGrid`, `Panel`, `StatusBadge`, `Button`.
7. **Distribución visual:** Sidebar izquierda `#171613` (11 secciones + enlace a sitio público) + TopBar + 5 `KpiCard` alineadas en `auto-fit` + panel de últimos pedidos y accesos rápidos.
8. **Componentes de interfaz:** `AppSidebar`, `TopBar`, `KpiGrid`, `Panel`, `StatusBadge`, `Button`.
9. **Información que se muestra:** Ventas hoy, pedidos hoy, pendientes, reservas hoy, productos activos, estado de turno de caja y últimos pedidos (con modalidad y pago).
10. **Acciones disponibles:** Navegar a cualquier módulo, inspeccionar pedidos recientes, cerrar sesión.
11. **Validaciones:** Cálculos sobre fecha local `America/Bogota`; solo rol `administrador`.
12. **Estados de carga:** `SkeletonBlock` en KPIs y lista.
13. **Estados vacíos:** *"Aún no hay actividad registrada hoy."*
14. **Mensajes de error:** `ToastNotice` con botón reintentar.
15. **Mensajes de éxito:** N/A (pantalla de consulta).
16. **Comportamiento responsive:** Sidebar `66px` en `<= 800px`; KPIs en 2 columnas; cabecera apilada en móvil.
17. **Navegación de entrada y salida:** Entrada post-login admin. Salida hacia los 10 submódulos administrativos y `/`.
18. **Criterios de aceptación:** 5 KPIs sin desalineación; tipografías `Playfair Display` + `DM Sans` cargadas; métricas exactas en horario nocturno colombiano.

---

## 2. Productos (Listado + Crear / Editar producto)

1. **Nombre:** Gestión de productos (`/admin/productos`, modal/vista Crear y Editar).
2. **Objetivo:** Administrar el catálogo completo de productos y complementos del restaurante.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Implementado parcialmente (`MEJORAR`).
5. **Archivo o componente existente relacionado:** `js/admin.js` (`L33-L35`), `css/admin.css` (`L1`, `.cards-grid`, `.product-admin`).
6. **Elementos que se reutilizan:** `FilterToolbar`, `ProductCard` (`admin`), `ModalDialog`, `StatusBadge`, `Button`.
7. **Distribución visual:** Toolbar (buscador, categoría, disponibilidad, `+ Agregar producto`) + cuadrícula 3 columnas de `.product-admin`; formulario de creación/edición en `ModalDialog` (`lg`) con vista previa de imagen.
8. **Componentes de interfaz:** `FilterToolbar`, tarjetas `.product-admin`, `ModalDialog`, inputs/selects/checkboxes, uploader de imagen a Supabase Storage, `Button`.
9. **Información que se muestra:** Imagen, nombre, descripción, categoría, precio, etiqueta, indicador `is_addon`, complementos vinculados y disponibilidad.
10. **Acciones disponibles:** Crear, editar, subir imagen, activar/desactivar (desactivación lógica priorizada) y eliminar (solo sin pedidos históricos).
11. **Validaciones:** Nombre `>= 2`, descripción obligatoria, categoría válida (`ADM-04`), precio `>= 1`, archivo imagen válido (`WebP/PNG/JPG <= 2 MB`).
12. **Estados de carga:** Skeleton en grilla; progreso al subir imagen y guardar.
13. **Estados vacíos:** *"No hay productos para estos filtros"* + CTA `+ Agregar producto`.
14. **Mensajes de error:** Validación inline y bloqueo con aviso si se intenta borrar un producto con ventas históricas.
15. **Mensajes de éxito:** `ToastNotice` *"Producto guardado"* / *"Disponibilidad actualizada"*.
16. **Comportamiento responsive:** 3 columnas en escritorio, 2 en `<= 800px`, 1 en `<= 480px`.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Productos`). Modales internos sin perder filtros.
18. **Criterios de aceptación:** Soporta descripción, selector de categoría, etiqueta, imagen en Storage y complementos explícitos.

---

## 3. Categorías

1. **Nombre:** Gestión de categorías (`/admin/categorias`).
2. **Objetivo:** Crear, ordenar y activar/desactivar las categorías del menú y del mesero.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno (reemplaza `categoryMap` en `js/app.js` `L28`).
6. **Elementos que se reutilizan:** `Panel`, `FilterToolbar`, `DataTable`, `ModalDialog`, `StatusBadge`, `Button`.
7. **Distribución visual:** Toolbar (`+ Nueva categoría`, filtro estado) + tabla (`ORDEN`, `NOMBRE`, `DESCRIPCIÓN`, `PRODUCTOS`, `ESTADO`, `ACCIONES`).
8. **Componentes de interfaz:** `DataTable`, `ModalDialog`, `StatusBadge`, `Button`.
9. **Información que se muestra:** Orden numérico, nombre, descripción, imagen opcional, conteo de productos asociados y estado.
10. **Acciones disponibles:** Crear, editar, reordenar, activar/desactivar, ver productos filtrados por esa categoría.
11. **Validaciones:** Nombre único `>= 2`; orden `>= 0`; aviso si tiene productos activos antes de desactivar.
12. **Estados de carga:** Skeleton en tabla.
13. **Estados vacíos:** *"No hay categorías creadas"* + `+ Nueva categoría`.
14. **Mensajes de error:** Error por nombre/slug duplicado.
15. **Mensajes de éxito:** `ToastNotice` confirmando creación/edición.
16. **Comportamiento responsive:** `.table-wrap` con scroll horizontal.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Categorías`). Enlace hacia `/admin/productos?cat=:id`.
18. **Criterios de aceptación:** Impacto inmediato en filtros de `PUB-02` y `MES-03`.

---

## 4. Pedidos y Detalle de pedido

1. **Nombre:** Gestión de pedidos (`/admin/pedidos` y modal/vista Detalle).
2. **Objetivo:** Gestionar todos los pedidos (`Domicilio`, `Recoger`, `Mesa`), controlar sus estados de preparación y consultar su historial.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Implementado parcialmente (`MEJORAR`).
5. **Archivo o componente existente relacionado:** `js/admin.js` (`L12`, `L14`, `L23`, `L25`, `L29-L32`).
6. **Elementos que se reutilizan:** `KpiGrid`, `FilterToolbar`, `DataTable`, `ModalDialog`, `OrderTimeline`, `StatusBadge`.
7. **Distribución visual:** KPIs del día + toolbar (`Número/cliente`, `Fecha`, `Estado`, `Modalidad`, `+ Nuevo pedido`) + tabla (`NÚMERO`, `CLIENTE`, `FECHA`, `MODALIDAD`, `TOTAL`, `ESTADO`, `PAGO`, `ACCIONES`).
8. **Componentes de interfaz:** `DataTable`, `<select>` inline de estado, `ModalDialog` de detalle con `<select>` (sin `prompt()`) y creador de pedido multi-producto.
9. **Información que se muestra:** Datos del cliente, mesa/dirección, ítems, complementos, observaciones, subtotal, tarifa fija, total, estado de preparación, estado de pago simulado e historial de estados.
10. **Acciones disponibles:** Filtrar sin perder estado, actualizar estados de preparación (`Pendiente` → `Confirmado` → `En preparación` → `Listo` → `Despachado` → `Entregado` / `Cancelado`), marcar reembolso simulado tras cancelación, crear pedido manual multi-producto.
11. **Validaciones:** Transiciones válidas por modalidad (`Despachado` solo `Domicilio`); al menos 1 producto en pedido manual.
12. **Estados de carga:** Skeleton en tabla; indicador en fila durante actualización.
13. **Estados vacíos:** *"No hay pedidos para estos filtros."*
14. **Mensajes de error:** `ToastNotice` si falla transición o validación.
15. **Mensajes de éxito:** `ToastNotice` *"Estado actualizado a [Estado]"*.
16. **Comportamiento responsive:** Toolbar `flex-wrap` y `.table-wrap`.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Pedidos`). Modales internos de detalle y creación.
18. **Criterios de aceptación:** Preserva filtros activos al cambiar estados; elimina `window.prompt()`; registra historial y auditoría.

---

## 5. Reservas y Calendario

1. **Nombre:** Gestión de reservas y Calendario (`/admin/reservas`).
2. **Objetivo:** Administrar reservas, revisar ocupación diaria/mensual, asignar mesas y validar disponibilidad según D-01 y D-02.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Implementado parcialmente (`MEJORAR`).
5. **Archivo o componente existente relacionado:** `js/admin.js` (`L15-L16`, `L24`, `L26-L27`, `L31`), `css/admin.css` (`L2`, `.calendar-grid`).
6. **Elementos que se reutilizan:** `ReservationCalendar` (`.calendar-grid`), `FilterToolbar`, `DataTable`, `ModalDialog`, `StatusBadge`.
7. **Distribución visual:** Toolbar (`Nombre/teléfono`, `Desde`, `Hasta`, `Estado`, `+ Nueva reserva`, toggle `Calendario`) + calendario mensual interactivo + tabla de reservas.
8. **Componentes de interfaz:** `ReservationCalendar`, `DataTable`, `ModalDialog` (alta/edición y detalle diario en reemplazo de `alert()`).
9. **Información que se muestra:** Código `RS-...`, cliente, teléfono, fecha, hora y duración (D-02), personas, mesa/zona asignada, estado y observaciones.
10. **Acciones disponibles:** Crear/editar reserva con selección de mesa disponible, cambiar estado (`Pendiente`, `Confirmada`, `Atendida`, `Cancelada`), cancelar, navegar meses y abrir ocupación del día en modal.
11. **Validaciones:** Fecha `>=` hoy (`America/Bogota`), personas `>= 1`, mesa con capacidad suficiente y sin solapamiento según duración configurada (D-02).
12. **Estados de carga:** Skeleton en calendario y tabla.
13. **Estados vacíos:** *"No hay reservas para este criterio."*
14. **Mensajes de error:** Alerta clara por solapamiento o capacidad insuficiente.
15. **Mensajes de éxito:** `ToastNotice` *"Reserva registrada/actualizada"*.
16. **Comportamiento responsive:** Calendario 7 columnas adaptables y `.table-wrap`.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Reservas`). Modales internos.
18. **Criterios de aceptación:** Conserva `.calendar-grid`; reemplaza `alert()` por `ModalDialog`; aplica D-01 y D-02.

---

## 6. Mesas

1. **Nombre:** Gestión de mesas (`/admin/mesas`).
2. **Objetivo:** Configurar libremente el inventario de mesas del restaurante (D-01) y monitorear su estado.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno (comparte `TableCard` con `MES-02`).
6. **Elementos que se reutilizan:** `FilterToolbar`, `TableCard`, `ModalDialog`, `StatusBadge`, `Button`.
7. **Distribución visual:** Toolbar (`Zona`, `Estado`, `+ Nueva mesa`) + cuadrícula `.cards-grid` de mesas.
8. **Componentes de interfaz:** `TableCard`, `ModalDialog`, `StatusBadge`, `Button`.
9. **Información que se muestra:** Número/identificador, zona, capacidad, estado (`Disponible`, `Ocupada`, `Reservada`, `Fuera de servicio`), reserva próxima y cuenta activa.
10. **Acciones disponibles:** Crear mesa, editar (número, zona, capacidad), activar/desactivar (`Fuera de servicio`), consultar reservas y pedidos asociados.
11. **Validaciones:** Identificador único; capacidad `>= 1`; advertencia si la mesa tiene cuenta abierta o reservas confirmadas antes de desactivarla.
12. **Estados de carga:** Skeleton en cuadrícula.
13. **Estados vacíos:** *"Aún no hay mesas configuradas"* + `+ Crear mesa`.
14. **Mensajes de error:** Error por código duplicado o intento de borrado con historial.
15. **Mensajes de éxito:** `ToastNotice` *"Mesa guardada correctamente"*.
16. **Comportamiento responsive:** 3–4 columnas en escritorio, 2 en tablet, 1 en móvil.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Mesas`) o Configuración.
18. **Criterios de aceptación:** Inventario 100% dinámico sin límite fijo (D-01), sincronizado con Reservas y Mesero.

---

## 7. Usuarios y Roles

1. **Nombre:** Gestión de usuarios y roles (`/admin/usuarios`).
2. **Objetivo:** Consultar cuentas registradas, gestionar su estado y asignar roles autorizados (`administrador`, `mesero`, `cliente`).
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno.
6. **Elementos que se reutilizan:** `FilterToolbar`, `DataTable`, `ModalDialog`, `StatusBadge`, `Button`.
7. **Distribución visual:** Toolbar (`Buscar`, `Rol`, `Estado`, `+ Crear usuario interno`) + tabla (`NOMBRE`, `CORREO`, `TELÉFONO`, `ROL`, `ESTADO`, `REGISTRO`, `ACCIONES`).
8. **Componentes de interfaz:** `DataTable`, `ModalDialog`, `StatusBadge`, `Button`.
9. **Información que se muestra:** Datos de perfil, rol actual, estado activo/inactivo y fecha de registro.
10. **Acciones disponibles:** Consultar, crear cuenta de mesero/administrador, cambiar rol con confirmación, activar/desactivar cuenta.
11. **Validaciones:** Prohibido desactivar o degradar al último administrador activo; los cambios generan registro obligatorio en `Auditoría`.
12. **Estados de carga:** Skeleton en tabla.
13. **Estados vacíos:** *"No se encontraron usuarios."*
14. **Mensajes de error:** Aviso si se intenta auto-bloquear el último admin o correo duplicado.
15. **Mensajes de éxito:** `ToastNotice` *"Rol/estado actualizado"*.
16. **Comportamiento responsive:** `.table-wrap`.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Usuarios`).
18. **Criterios de aceptación:** Solo administradores pueden asignar roles; protege integridad administrativa.

---

## 8. Caja (Apertura, Movimientos, Cobro de Mesas y Cierre)

1. **Nombre:** Caja (`/admin/caja`).
2. **Objetivo:** Operar turnos de caja completos: apertura con base inicial, cobro de cuentas de mesa cerradas (D-04), ingresos/egresos, arqueo y cierre sin duplicar ventas.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Implementado parcialmente (`MEJORAR`).
5. **Archivo o componente existente relacionado:** `js/admin.js` (`L17`, `L28`), `css/admin.css` (`L1`).
6. **Elementos que se reutilizan:** `KpiGrid`, `Panel`, `DataTable`, `ModalDialog`, `StatusBadge`, `Button`.
7. **Distribución visual:** Banner de estado del turno (`Caja abierta/cerrada`) → 5 KPIs (`Base inicial`, `Efectivo`, `Digital`, `Movimientos`, `Efectivo esperado`) → Panel *Cuentas de mesa por cobrar* (D-04) → Panel *Movimientos del turno* (`+ Ingreso`, `+ Egreso`) → Panel *Arqueo y cierre* (`Efectivo contado`, `Diferencia`, `Cerrar caja`) → Tabla *Historial de cierres*.
8. **Componentes de interfaz:** `KpiGrid`, `Panel`, `DataTable`, `ModalDialog` (reemplaza `confirm()`), `Button`.
9. **Información que se muestra:** Base inicial, ventas clasificadas por medio de pago (efectivo vs. tarjeta/Nequi/PSE), ingresos/egresos manuales, cuentas de mesa esperando cobro, efectivo esperado vs. contado y diferencia.
10. **Acciones disponibles:** Abrir caja, cobrar y cerrar cuenta de mesa (liberando la mesa), registrar ingreso/egreso manual, realizar arqueo y cerrar turno, ver historial de cierres.
11. **Validaciones:** Base `>= 0`; movimientos `> 0` con concepto; no duplicar cobros digitales en efectivo esperado; un pedido/cuenta solo puede incluirse en un cierre; sin pérdida de pedidos por cambio de fecha UTC.
12. **Estados de carga:** Botones bloqueados durante cobro/cierre transaccional.
13. **Estados vacíos:** Estado *Caja cerrada* con botón único `ABRIR CAJA`; mensaje si no hay cuentas por cobrar ni movimientos.
14. **Mensajes de error:** Alerta si se intenta operar con caja cerrada o cerrar existiendo error de datos.
15. **Mensajes de éxito:** `ToastNotice` *"Caja abierta"*, *"Cuenta de Mesa #X cobrada"* y *"Cierre registrado"*.
16. **Comportamiento responsive:** KPIs 2 columnas en móvil; tablas en `.table-wrap`.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Caja`).
18. **Criterios de aceptación:** Cuentas de mesa solo suman en ventas cobradas al cerrarse (D-04); arqueo exacto; trazabilidad en Auditoría.

---

## 9. Reportes

1. **Nombre:** Reportes (`/admin/reportes`).
2. **Objetivo:** Analizar ventas diarias y por periodo, productos más vendidos (por ID), modalidades, medios de pago, reservas y cierres de caja, con salida imprimible/PDF.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Implementado parcialmente (`CONSERVAR` / `MEJORAR`).
5. **Archivo o componente existente relacionado:** `js/admin.js` (`L18-L19`, `L30`), `css/admin.css` (`L1-L2`, `.report-bar`, `@media print`).
6. **Elementos que se reutilizan:** `KpiGrid`, `Panel`, `.report-bar`, `DataTable`, `@media print`.
7. **Distribución visual:** Toolbar (`Desde`, `Hasta`, presets `Hoy`/`7 días`/`Mes`, `Imprimir / PDF`) + 4 KPIs + barras por estado/modalidad/pago + tabla de productos más vendidos + resumen de reservas y cierres.
8. **Componentes de interfaz:** `FilterToolbar`, `KpiGrid`, gráficos de barras CSS, `DataTable`, `Button`.
9. **Información que se muestra:** Ventas totales y diarias, pedidos, ticket promedio, cancelados, desglose por modalidad, desglose por método de pago, ranking por `product_id` (unidades + monto `$`), reservas y cierres de caja.
10. **Acciones disponibles:** Cambiar rango de fechas, usar presets rápidos, imprimir/exportar PDF.
11. **Validaciones:** `Desde <= Hasta`; exclusión de pedidos `Cancelado`; agrupación por `product_id`.
12. **Estados de carga:** Skeleton al recalcular el periodo.
13. **Estados vacíos:** *"Sin registros entregados/cobrados en este rango."*
14. **Mensajes de error:** Aviso si `Desde > Hasta` o falla la consulta agregada.
15. **Mensajes de éxito:** N/A (pantalla analítica).
16. **Comportamiento responsive:** KPIs 2 columnas en móvil; `@media print` oculta navegación.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Reportes`).
18. **Criterios de aceptación:** Elimina código muerto de `report()`; usa `product_id` y hora local `America/Bogota`.

---

## 10. Configuración y Auditoría

### 10.1. Configuración (`/admin/configuracion`)
1. **Nombre:** Configuración del restaurante (`/admin/configuracion`).
2. **Objetivo:** Administrar parámetros globales sin editar código fuente.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** `CONFIG` en `js/app.js` (`L1-L7`) y `deliveryFee` en `js/checkout.js` (`L2`).
6. **Elementos que se reutilizan:** `Panel`, formularios Zod, `Button`, `ToastNotice`.
7. **Distribución visual:** 3 paneles en `#faf6ee`: *Datos del restaurante y contacto*, *Horarios de atención*, *Parámetros operativos (tarifa fija domicilio D-03, duración de reservas D-02, ventana de cancelación, producto destacado)*.
8. **Componentes de interfaz:** Inputs, selectores de hora, selector de producto destacado, `Button`.
9. **Información que se muestra:** Valores activos y última fecha de modificación.
10. **Acciones disponibles:** Editar y guardar configuración; enlace rápido a `Mesas` (`ADM-07`).
11. **Validaciones:** Tarifa fija `>= 0`; duración reserva `>= 15` min; apertura `<` cierre; WhatsApp numérico válido.
12. **Estados de carga:** Botón guardando.
13. **Estados vacíos:** Carga valores base iniciales del restaurante.
14. **Mensajes de error:** Errores inline en `#a64225`.
15. **Mensajes de éxito:** `ToastNotice` *"Configuración actualizada"*.
16. **Comportamiento responsive:** 2 columnas en escritorio; 1 en móvil.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Configuración`).
18. **Criterios de aceptación:** Cambios impactan en vivo en Checkout (D-03), Reservas (D-02) y Sitio Público.

### 10.2. Auditoría (`/admin/auditoria`)
1. **Nombre:** Auditoría de actividad (`/admin/auditoria`).
2. **Objetivo:** Proveer registro inmutable de acciones críticas del sistema.
3. **Perfil autorizado:** `administrador`.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno.
6. **Elementos que se reutilizan:** `FilterToolbar`, `DataTable`, `ModalDialog`, `StatusBadge`.
7. **Distribución visual:** Toolbar (`Usuario`, `Rol`, `Entidad`, `Fecha desde/hasta`) + tabla cronológica descendente.
8. **Componentes de interfaz:** `FilterToolbar`, `DataTable`, `ModalDialog` (diff antes/después).
9. **Información que se muestra:** Fecha/hora local, actor y rol, entidad, acción y detalle resumido.
10. **Acciones disponibles:** Filtrar y ver detalle en modal (estrictamente solo lectura).
11. **Validaciones:** Inmutable (sin `UPDATE` ni `DELETE` en interfaz ni en RLS).
12. **Estados de carga:** Skeleton en tabla.
13. **Estados vacíos:** *"No hay eventos de auditoría en este periodo."*
14. **Mensajes de error:** `ToastNotice` con reintento.
15. **Mensajes de éxito:** N/A.
16. **Comportamiento responsive:** `.table-wrap`.
17. **Navegación de entrada y salida:** Entrada desde sidebar (`Auditoría`).
18. **Criterios de aceptación:** Registra cambios de estado, cancelaciones de mesero/admin, cierres de caja, cambios de rol y configuración.
