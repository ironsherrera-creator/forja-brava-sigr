# FORJA BRAVA — SIGR
## Documento maestro de diseño funcional y visual

**Versión:** 2.0  
**Estado:** Especificación funcional y visual en elaboración  
**Producto:** Sistema Integral de Gestión de Restaurante  
**Eslogan:** El sabor que se hace a fuego.

---

# 1. Propósito del documento

Establecer la especificación funcional y visual de FORJA BRAVA — SIGR, tomando como punto de partida el software frontend existente y conservando sus componentes, identidad visual, funcionalidades aprovechables y estructura de navegación.

El documento define las experiencias del cliente, mesero y administrador, además del sitio público, sus pantallas, funcionalidades, interacciones y reglas de negocio.

La evolución será progresiva. No se reconstruirán módulos existentes sin justificación técnica o funcional.

# 2. Principio de conservación del software existente

El repositorio actual constituye la base del producto.

Se deben conservar, siempre que sea técnicamente viable:

- Landing page y estructura comercial.
- Identidad gráfica y logotipo.
- Paleta de colores y tipografías.
- Menú digital y tarjetas de productos.
- Drawer lateral del carrito.
- Checkout de cinco pasos.
- Comprobante imprimible.
- Estructura visual del panel administrativo.
- Dashboard y tarjetas KPI.
- Tablas, filtros y formularios existentes.
- Calendario de reservas.
- Estructura de caja y reportes.

Las mejoras deberán integrarse con los patrones visuales existentes.

No se debe duplicar una funcionalidad que ya esté implementada ni eliminar una pieza reutilizable sin justificarlo.

# 3. Identidad visual oficial

## 3.1. Concepto

La identidad visual es rústica premium, urbana, elegante y cálida.

Se debe transmitir la personalidad de un restaurante especializado en comida rápida colombiana preparada al fuego.

## 3.2. Paleta de colores

| Variable | Color | Aplicación |
|---|---|---|
| Carbón | #171613 | Fondos oscuros |
| Café | #35251d | Superficies oscuras |
| Madera | #68452f | Elementos secundarios |
| Crema | #f1e8d8 | Fondos cálidos |
| Papel | #e9dfcf | Superficies editoriales |
| Arena | #d6c2a3 | Bordes y detalles |
| Fuego | #c66a32 | Acciones principales |
| Fuego hover | #e07c42 | Interacción |

## 3.3. Tipografías

- Playfair Display: títulos, encabezados y elementos editoriales.
- DM Sans: textos, navegación, formularios y componentes operativos.

## 3.4. Elementos que se deben conservar

- Logotipo tipográfico FB.
- Botones rectangulares.
- Acentos terracota.
- Fotografías cálidas de alimentos.
- Fondos oscuros combinados con superficies crema.
- Bordes finos.
- Tarjetas limpias.
- Espaciado editorial en el sitio público.
- Interfaz compacta y funcional en administración.

No se debe introducir una identidad visual diferente para el cliente o el mesero.

# 4. Decisiones funcionales oficiales

Las siguientes decisiones quedan aprobadas y deben respetarse durante el diseño y desarrollo.

| Código | Tema | Decisión aprobada |
|---|---|---|
| D-01 | Inventario de mesas | Configurable desde administración |
| D-02 | Duración de reservas | Configurable desde administración |
| D-03 | Domicilio | Tarifa fija |
| D-04 | Pago en mesa | Se registra al cerrar la cuenta |
| D-05 | Permisos del mesero | Puede marcar pedidos como entregados y cancelar pedidos recién registrados |
| D-06 | Pedidos y reservas de invitados | Es obligatorio iniciar sesión |

## 4.1. Reglas derivadas

### Mesas configurables

El administrador podrá registrar mesas, definir su identificador, capacidad, zona y disponibilidad.

No se establece una cantidad fija de mesas en el sistema.

### Duración configurable de reservas

El administrador podrá establecer la duración de los turnos de reserva.

El sistema utilizará esta configuración para calcular los intervalos disponibles y evitar asignaciones incompatibles.

### Tarifa fija de domicilio

El restaurante utilizará una tarifa fija de domicilio.

El importe concreto todavía debe configurarse. No se debe inventar ni establecer un valor monetario definitivo.

### Pago al cerrar cuenta de mesa

Los pedidos asociados a una mesa podrán acumularse en su cuenta.

El pago se registrará al realizar el cierre de la cuenta, no al crear cada comanda.

### Permisos del mesero

El mesero podrá:

- Registrar pedidos en mesas.
- Consultar el estado de los pedidos de sus mesas.
- Marcar un pedido como entregado.
- Cancelar un pedido recién registrado.

No podrá cambiar los precios, administrar productos, gestionar usuarios ni acceder a reportes financieros.

El administrador conservará la responsabilidad de gestionar los estados de preparación.

### Autenticación obligatoria

Para crear pedidos o reservas, el cliente deberá iniciar sesión.

La navegación del menú público seguirá disponible sin autenticación.

# 5. Arquitectura de experiencias y navegación

El sistema tendrá cuatro experiencias conectadas:

1. Sitio público.
2. Cliente.
3. Mesero.
4. Administrador.

La navegación se organizará mediante rutas diferenciadas.

## 5.1. Mapa de navegación

### Sitio público

- Inicio.
- Menú.
- Detalle del producto.
- Carrito.
- Reservas.
- Contacto.
- Iniciar sesión.
- Registro.

### Cliente

- Dashboard.
- Mi perfil.
- Nuevo pedido.
- Checkout.
- Mis pedidos.
- Seguimiento.
- Mis reservas.
- Historial.

### Mesero

- Dashboard operativo.
- Mesas.
- Seleccionar mesa.
- Nuevo pedido.
- Pedidos registrados.

### Administrador

- Dashboard.
- Productos.
- Categorías.
- Pedidos.
- Reservas.
- Mesas.
- Usuarios.
- Caja.
- Reportes.
- Auditoría.
- Configuración.

# 6. Especificación detallada del sitio público

## 6.1. Página de inicio

**Estado actual:** implementado.

**Estrategia:** conservar y mejorar.

### Elementos

- Header fijo.
- Logotipo.
- Navegación.
- Botón para consultar menú.
- Botón de acceso a reservas.
- Hero editorial.
- Cinta animada.
- Sección de identidad.
- Menú o carta destacada.
- Producto protagonista.
- Galería de experiencia.
- Información del restaurante.
- Contacto.
- Footer.

### Mejoras

- Conectar el producto protagonista con el catálogo real.
- Actualizar dinámicamente el número de productos y categorías.
- Conectar los enlaces de contacto.
- Integrar el acceso a reservas.
- Mantener el diseño responsive.

## 6.2. Menú digital

**Estado actual:** parcial.

### Elementos

- Encabezado de carta.
- Filtros de categorías dinámicos.
- Buscador de productos.
- Tarjetas de productos.
- Fotografía.
- Nombre.
- Descripción corta.
- Precio.
- Etiqueta destacada.
- Indicador de disponibilidad.
- Botón para agregar al pedido.

### Comportamiento

Los productos y categorías deben proceder de una fuente de datos centralizada.

Los productos desactivados no se podrán agregar al carrito.

Los filtros deben generarse desde las categorías registradas, evitando categorías escritas directamente en HTML.

## 6.3. Detalle del producto

**Estado actual:** pendiente.

### Diseño

Se utilizará un modal o drawer coherente con el sistema actual.

### Información

- Fotografía ampliada.
- Nombre.
- Descripción.
- Precio.
- Ingredientes.
- Complementos disponibles.
- Selector de cantidad.
- Observaciones.
- Total actualizado.
- Botón agregar al pedido.

### Comportamiento

El precio debe recalcularse al cambiar complementos y cantidades.

Los complementos deben estar definidos explícitamente en los datos, no identificados mediante expresiones de texto o heurísticas.

## 6.4. Carrito

**Estado actual:** parcial.

### Elementos

- Drawer lateral existente.
- Productos seleccionados.
- Cantidades.
- Complementos.
- Observaciones.
- Subtotal.
- Tarifa de domicilio cuando corresponda.
- Total.
- Botón continuar.

### Mejoras

- Hidratar correctamente el carrito al cargar la página.
- Mantener sincronización entre menú y checkout.
- Evitar productos duplicados incorrectamente.
- Recalcular importes.
- Validar disponibilidad antes de confirmar.

El carrito se conservará temporalmente en LocalStorage.

## 6.5. Reservas públicas

**Estado actual:** pendiente.

### Pantalla de reserva

Campos:

- Fecha.
- Hora.
- Número de personas.
- Preferencia de zona, si existe.
- Observaciones.

### Flujo

1. El cliente inicia sesión.
2. Selecciona fecha.
3. Indica número de personas.
4. Consulta horarios disponibles.
5. El sistema verifica las mesas y capacidades.
6. Se muestran las opciones disponibles.
7. El cliente selecciona un horario.
8. Confirma la reserva.
9. El sistema registra la reserva.
10. Se presenta la confirmación.

La reserva se confirmará automáticamente cuando el sistema haya validado la disponibilidad.

No se debe mostrar una mesa como disponible si ya tiene una reserva incompatible.

## 6.6. Contacto

**Estado actual:** visual.

### Mejoras

- Configuración real del teléfono.
- Enlace de WhatsApp.
- Redes sociales.
- Ubicación.
- Horarios.
- Formulario de contacto conectado a una operación real, si se mantiene dentro del alcance.

# 7. Especificación detallada del cliente

## 7.1. Autenticación

**Estado actual:** parcial.

Se aprovecharán los formularios y patrones visuales existentes.

Pantallas:

- Registro.
- Inicio de sesión.
- Recuperación de contraseña.
- Confirmación de acceso.
- Cierre de sesión.

La autenticación definitiva se realizará mediante Supabase Auth.

## 7.2. Dashboard del cliente

**Estado actual:** pendiente.

Será una experiencia independiente del modal de perfil actual.

### Encabezado

- Logotipo.
- Saludo personalizado.
- Acceso al perfil.
- Acceso al menú.
- Cierre de sesión.

### Resumen principal

Tarjetas:

- Pedidos activos.
- Último pedido.
- Próximas reservas.
- Historial de compras.

### Navegación interna

- Resumen.
- Mis pedidos.
- Mis reservas.
- Mi perfil.

## 7.3. Mi perfil

Información:

- Nombre.
- Correo electrónico.
- Teléfono.
- Direcciones de entrega.

Acciones:

- Editar información.
- Guardar cambios.
- Cerrar sesión.

El correo y la identidad de autenticación deben gestionarse de acuerdo con las capacidades de Supabase Auth.

## 7.4. Proceso de compra

Se conservará el checkout actual de cinco pasos, ampliándolo para soportar las tres modalidades de pedido.

### Paso 1. Revisión del pedido

- Productos.
- Cantidades.
- Complementos.
- Observaciones.
- Subtotal.

### Paso 2. Modalidad

Opciones:

- Domicilio.
- Recoger en restaurante.
- Consumir en mesa.

### Paso 3. Información del servicio

Para domicilio:

- Nombre.
- Teléfono.
- Dirección.
- Barrio.
- Indicaciones.
- Tarifa fija.

Para recoger:

- Datos del cliente.
- Hora estimada de recogida, cuando corresponda.

Para mesa:

- Mesa o reserva asociada.
- Número de personas cuando corresponda.
- Información del servicio.

La disponibilidad de mesas se validará antes de asociar el pedido.

### Paso 4. Pago

Medios simulados:

- Efectivo.
- Tarjeta.
- Nequi.
- PSE.

El comportamiento dependerá de la modalidad y del momento de pago establecido.

### Paso 5. Confirmación

- Número del pedido.
- Productos.
- Modalidad.
- Total.
- Medio de pago.
- Estado inicial.
- Comprobante imprimible.

## 7.5. Pagos simulados

Los pagos serán simulaciones controladas dentro del proyecto.

El sistema registrará el medio seleccionado y el resultado simulado.

Estados propuestos:

- Pendiente.
- Confirmación simulada.
- Fallido.
- Reembolsado.

No se procesarán transacciones bancarias reales.

Los pedidos de mesa tendrán el pago pendiente hasta el cierre de la cuenta.

## 7.6. Mis pedidos

Listado de pedidos del cliente.

Cada tarjeta mostrará:

- Número de pedido.
- Fecha.
- Modalidad.
- Total.
- Estado.
- Acceso al detalle.

Filtros:

- Todos.
- Activos.
- Completados.
- Cancelados.

## 7.7. Seguimiento

Se mostrará una línea temporal:

1. Pedido recibido.
2. Pedido confirmado.
3. En preparación.
4. Listo para recoger o despachado.
5. En camino, para domicilio.
6. Entregado.

Se deberá mostrar únicamente la información correspondiente a la modalidad.

El cliente podrá consultar los cambios, pero no modificarlos.

## 7.8. Mis reservas

Listado de reservas con:

- Fecha.
- Hora.
- Personas.
- Mesa asignada, cuando corresponda.
- Estado.
- Acciones permitidas.

Se permitirá cancelar según las reglas establecidas por el restaurante.

# 8. Especificación detallada del mesero

## 8.1. Acceso

El mesero ingresará mediante autenticación.

Al identificarse su rol, será dirigido al panel operativo.

## 8.2. Dashboard operativo

Indicadores:

- Mesas disponibles.
- Mesas ocupadas.
- Mesas reservadas.
- Pedidos registrados.
- Pedidos listos para entregar.

Acciones rápidas:

- Ver mesas.
- Crear pedido.
- Consultar pedidos.

## 8.3. Gestión de mesas

La interfaz mostrará tarjetas o una cuadrícula de mesas.

Cada tarjeta incluirá:

- Número de mesa.
- Zona.
- Capacidad.
- Estado.
- Pedido activo.
- Reserva asociada, si existe.

Estados visuales:

- Disponible.
- Ocupada.
- Reservada.
- Fuera de servicio.

## 8.4. Registro de pedidos

Flujo:

1. Seleccionar mesa.
2. Consultar catálogo.
3. Filtrar por categoría.
4. Buscar productos.
5. Agregar productos.
6. Seleccionar complementos.
7. Ajustar cantidades.
8. Registrar observaciones.
9. Revisar la comanda.
10. Confirmar el pedido.

Se reutilizarán las tarjetas de productos y la lógica del carrito existentes.

## 8.5. Pedidos registrados

El mesero podrá consultar los pedidos de sus mesas.

Información:

- Número de pedido.
- Mesa.
- Hora.
- Productos.
- Estado.
- Observaciones.

Permisos:

- Marcar como entregado.
- Cancelar un pedido recién registrado.

La cancelación deberá estar restringida a pedidos que todavía no hayan avanzado a preparación.

No tendrá acceso a la gestión general de estados de preparación.

## 8.6. Cierre de cuenta

El mesero podrá consultar el total acumulado de la mesa y solicitar el cierre de la cuenta conforme al flujo operativo.

El registro definitivo del pago y el movimiento de caja deberán quedar controlados por el proceso administrativo autorizado.

# 9. Especificación detallada del administrador

## 9.1. Dashboard

**Estado actual:** implementado.

Se conservará su estructura.

### Indicadores

- Ventas del día.
- Pedidos del día.
- Pedidos pendientes.
- Reservas del día.
- Productos registrados.

### Secciones

- Últimos pedidos.
- Accesos rápidos.
- Resumen de actividad.

### Mejoras

- Ajustar la distribución de las tarjetas KPI.
- Corregir cálculos de fecha para la zona horaria del restaurante.
- Obtener los indicadores desde los datos persistidos.
- Añadir acceso a gestión de mesas y categorías.

## 9.2. Gestión de productos

**Estado actual:** parcial.

### Listado

- Imagen.
- Nombre.
- Categoría.
- Precio.
- Disponibilidad.
- Acciones.

### Formulario

- Nombre.
- Descripción.
- Categoría.
- Precio.
- Imagen.
- Etiqueta.
- Complementos.
- Disponibilidad.

Acciones:

- Crear.
- Consultar.
- Editar.
- Activar.
- Desactivar.

Se priorizará la desactivación lógica cuando existan pedidos históricos asociados.

## 9.3. Gestión de categorías

**Estado actual:** pendiente.

Funciones:

- Crear categoría.
- Editar categoría.
- Activar o desactivar.
- Ordenar.
- Consultar productos asociados.

Campos:

- Nombre.
- Descripción.
- Imagen opcional.
- Orden.
- Estado.

## 9.4. Gestión de pedidos

**Estado actual:** parcial.

La pantalla conservará la tabla existente y sus filtros.

Columnas:

- Número.
- Cliente.
- Fecha.
- Modalidad.
- Total.
- Estado.
- Pago.
- Acciones.

Filtros:

- Fecha.
- Estado.
- Modalidad.
- Cliente.
- Número de pedido.

Detalle:

- Datos del cliente.
- Productos.
- Complementos.
- Observaciones.
- Dirección o mesa.
- Importes.
- Pago.
- Historial de estados.

El administrador será responsable de actualizar los estados de preparación.

## 9.5. Gestión de reservas

**Estado actual:** parcial.

Se conservará el calendario existente.

Se añadirán:

- Disponibilidad.
- Capacidad.
- Mesa asignada.
- Duración configurable.
- Horarios de atención.
- Gestión de cancelaciones.
- Vista de ocupación.

El sistema debe validar las reservas antes de confirmarlas.

## 9.6. Gestión de mesas

**Estado actual:** pendiente.

Funciones:

- Crear mesa.
- Editar mesa.
- Desactivar mesa.
- Definir número.
- Definir zona.
- Definir capacidad.
- Consultar estado.
- Consultar reservas.
- Consultar pedidos asociados.

El administrador podrá configurar el inventario de mesas del restaurante.

## 9.7. Gestión de usuarios

**Estado actual:** pendiente.

Listado:

- Nombre.
- Correo.
- Teléfono.
- Rol.
- Estado.
- Fecha de registro.

Roles:

- Administrador.
- Mesero.
- Cliente.

Acciones:

- Consultar.
- Activar o desactivar.
- Asignar rol cuando esté autorizado.

El cliente no podrá asignarse a sí mismo un rol administrativo ni de mesero.

## 9.8. Caja

**Estado actual:** parcial.

Se conservará el diseño existente y se ampliará.

Funciones:

- Apertura de caja.
- Base inicial.
- Ingresos.
- Egresos.
- Ventas.
- Métodos de pago.
- Efectivo esperado.
- Efectivo contado.
- Diferencia.
- Cierre.
- Historial de cierres.

Los pagos digitales y el efectivo deben clasificarse correctamente para no duplicar los ingresos.

Los pedidos de mesa se registrarán como ventas cobradas al cerrar la cuenta.

## 9.9. Reportes

**Estado actual:** implementado parcialmente.

Se conservarán los filtros y la estructura gráfica.

Indicadores:

- Ventas por periodo.
- Ventas diarias.
- Productos más vendidos.
- Pedidos por modalidad.
- Métodos de pago.
- Reservas.
- Movimientos de caja.
- Cierres.

Los reportes deberán utilizar identificadores de productos y no depender únicamente de sus nombres.

## 9.10. Configuración

**Estado actual:** pendiente.

Secciones:

- Información del restaurante.
- Horarios.
- Tarifa fija de domicilio.
- Duración de reservas.
- Mesas.
- Datos de contacto.
- WhatsApp.
- Parámetros operativos.

La configuración de mesas y duración de reservas será administrable desde aquí o desde sus respectivos módulos.

# 10. Reglas de negocio generales

## 10.1. Modalidades de pedidos

Se contemplan tres modalidades:

- Domicilio.
- Recoger.
- Mesa.

Cada pedido deberá registrar su modalidad y la información específica correspondiente.

## 10.2. Reservas

- Requieren autenticación.
- Dependen de disponibilidad real.
- Deben respetar capacidad.
- Utilizan duración configurable.
- No pueden solaparse en una misma mesa.
- Se confirman automáticamente cuando se cumplen las reglas.

## 10.3. Pedidos de mesa

- Se asocian a una mesa.
- Pueden acumular varios productos.
- Pueden formar parte de una cuenta con varios pedidos.
- Se cobran al cerrar la cuenta.

## 10.4. Estados de pedido

Se utilizarán estados coherentes entre cliente y administración:

- Pendiente.
- Confirmado.
- En preparación.
- Listo.
- Despachado.
- Entregado.
- Cancelado.

Las transiciones permitidas dependerán del rol y la modalidad.

## 10.5. Pagos

Los pagos simulados no representan operaciones bancarias reales.

El estado de pago será independiente del estado de preparación.

## 10.6. Autorización

Los permisos deberán aplicarse tanto en la interfaz como en la base de datos.

Ocultar botones no constituye protección suficiente.

# 11. Criterios visuales compartidos

Todas las experiencias deberán mantener:

- Identidad visual de FORJA BRAVA.
- Tipografías oficiales.
- Paleta existente.
- Botones coherentes.
- Formularios consistentes.
- Estados visuales diferenciados.
- Diseño responsive.
- Accesibilidad básica.
- Mensajes de error claros.
- Confirmaciones de operaciones.
- Estados de carga, vacío y error.

El sitio público tendrá un diseño editorial y comercial.

El cliente tendrá un diseño sencillo y orientado a la compra.

El mesero tendrá una interfaz operativa, táctil y rápida.

El administrador tendrá una interfaz de gestión compacta y organizada.

# 12. Alcance de la siguiente etapa

La siguiente etapa consiste en completar el diseño de las pantallas, identificar componentes existentes y establecer las especificaciones de implementación.

No se autoriza todavía:

- Migración tecnológica.
- Creación de tablas.
- Cambios en autenticación.
- Implementación de Supabase.
- Refactorización.
- Eliminación de código.
- Cambios de persistencia.

Primero se aprobará el diseño y posteriormente se definirá la arquitectura de implementación.

# 13. Criterios de aceptación del diseño

El diseño se considerará aprobado cuando:

1. Se haya identificado qué elementos existentes se conservan.
2. Se hayan especificado las pantallas nuevas.
3. Se hayan definido las interacciones principales.
4. Se hayan documentado las reglas de negocio.
5. Se hayan definido los permisos por perfil.
6. Se haya establecido la navegación.
7. Se haya conservado la identidad visual.
8. Se hayan documentado los estados y mensajes.
9. Se hayan revisado los diseños en escritorio y móvil.
10. Se haya validado que no se dupliquen funcionalidades existentes.

**Este documento constituye la referencia funcional y visual de FORJA BRAVA — SIGR para las siguientes etapas de diseño, arquitectura, desarrollo y pruebas.**