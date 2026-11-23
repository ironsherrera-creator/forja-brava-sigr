# Inventario de Pantallas y Componentes
## FORJA BRAVA — SIGR

Este inventario consolida todas las pantallas del sistema (existentes en el repositorio y nuevas requeridas por el alcance SIGR), su clasificación de evolución (**CONSERVAR**, **MEJORAR**, **REUTILIZAR**, **CREAR**), sus archivos actuales y las acciones pendientes.

---

## 1. Pantallas del Sitio Público

| ID | Pantalla | Ruta / Contenedor objetivo | Estado actual en repo | Acción | Archivos existentes relacionados | Componentes reutilizables | Acciones pendientes clave |
|---|---|---|---|---|---|---|---|
| **PUB-01** | Página de inicio (Landing) | `/` | Implementado (estático) | **CONSERVAR** / **MEJORAR** | `index.html` (`L18-L78`), `css/styles.css`, `js/app.js` | `.site-header`, `.brand`, `.hero`, `.ticker`, `.essence`, `.experience`, `.site-footer`, `.reveal` | Conectar `#destacado` al catálogo real; agregar botón de acceso a Reservas en header; optimizar PNGs a WebP y respaldar imágenes Unsplash. |
| **PUB-02** | Menú digital | `/menu` (y `#menu` en inicio) | Parcial (solo frontend) | **MEJORAR** | `index.html` (`L55-L61`), `js/app.js` (`L9-L51`, `L63`) | `.menu-toolbar`, `.filters`, `.filter-btn`, `.product-grid`, `.product-card` | Generar filtros desde entidad Categorías; añadir buscador por texto; hacer dinámicos los contadores (`13 ANTOJOS`); bloquear productos inactivos. |
| **PUB-03** | Detalle de producto | Modal / Drawer sobre carta | Pendiente | **CREAR** | `js/app.js` (`L50` tarjetas actuales) | `.auth-modal` / `.checkout-modal` (patrón de modal), `.button-fire`, `money()` | Diseñar ficha ampliada con foto, descripción, ingredientes, complementos explícitos, cantidad, observaciones y precio en vivo. |
| **PUB-04** | Carrito lateral | Drawer global | Parcial (solo frontend) | **MEJORAR** | `index.html` (`L81`), `js/app.js` (`L45`, `L53-L56`, `L64`) | `.cart-drawer`, `.cart-panel`, `.cart-line`, `.cart-quantity`, `.cart-summary` | Hidratar UI al cargar (`updateCart()`); mostrar complementos y observaciones; sincronizar con checkout; validar sesión (D-06) al continuar. |
| **PUB-05** | Reservas públicas | `/reservas` | Pendiente | **CREAR** | Ninguno en sitio público (lógica parcial en `js/admin.js` `L24`) | `.checkout-form` (estilos de formulario), `.button-fire`, `.toast` | Crear selector de fecha, personas, consulta de franjas disponibles según D-01/D-02, confirmación automática y compuerta de login (D-06). |
| **PUB-06** | Contacto y canales | `/contacto` (`#contacto`) | Visual | **MEJORAR** | `index.html` (`L75`, `L80`), `js/app.js` (`L1-L7`, `L68-L69`) | `.contact-section`, `.contact-form`, `.floating-whatsapp` | Alimentar ubicación, horario, teléfono, WhatsApp y redes desde Configuración; conectar formulario a operación real o definir su alcance. |

---

## 2. Pantallas de la Experiencia Cliente

| ID | Pantalla | Ruta / Contenedor objetivo | Estado actual en repo | Acción | Archivos existentes relacionados | Componentes reutilizables | Acciones pendientes clave |
|---|---|---|---|---|---|---|---|
| **CLI-01** | Inicio de sesión y Recuperación | `/login` (y evolución de `#auth-modal`) | Parcial (solo frontend local) | **MEJORAR** | `index.html` (`L82-L92`), `js/app.js` (`L70-L83`), `css/styles.css` (`L6`) | `.auth-card`, `.auth-tabs`, `.button-fire`, `.auth-message` | Conectar a autenticación real con redirección por rol (`cliente`, `mesero`, `admin`); agregar flujo de recuperación de contraseña. |
| **CLI-02** | Registro de cliente | `/registro` (y tab en `#auth-modal`) | Parcial (solo frontend local) | **MEJORAR** | `index.html` (`L93-L100`), `js/app.js` (`L84`), `css/styles.css` (`L6`) | `.auth-card`, validaciones base de nombre/correo/teléfono/contraseña | Integrar registro real con rol fijo `cliente` (sin autoasignación de otros roles) y confirmación de cuenta. |
| **CLI-03** | Dashboard del cliente | `/cliente` | Pendiente | **CREAR** | Ninguno (solo `.profile-view` en `index.html` `L101-L110`) | `.brand`, `.stats-grid` / `.stat-card`, `.panel` de `css/admin.css` | Construir vista independiente con saludo, KPIs personales (pedidos activos, último pedido, próximas reservas, historial) y navegación interna. |
| **CLI-04** | Mi perfil y direcciones | `/cliente/perfil` | Parcial (modal básico) | **MEJORAR** | `index.html` (`L101-L110`), `js/app.js` (`L78`, `L85-L86`) | `#profile-form`, `.logout-button`, `.toast` | Trasladar fuera del modal de auth; agregar gestión de direcciones guardadas de entrega y cambio/gestión segura de cuenta. |
| **CLI-05** | Checkout en 5 pasos y Pagos simulados | `/checkout` (o modal ampliado `#checkout-modal`) | Parcial (simulado sin sesión obligatoria) | **MEJORAR** | `index.html` (`L113-L116`), `js/checkout.js` (`L1-L17`), `css/styles.css` (`L7`) | `.checkout-shell`, `.checkout-progress`, `.checkout-summary`, `.payment-options`, `.receipt` | Exigir login (D-06); soportar 3 modalidades (`Domicilio`, `Recoger`, `Mesa`); aplicar tarifa fija (D-03); pago pendiente en mesa (D-04); eliminar XSS y recarga dura; limpiar carrito al confirmar. |
| **CLI-06** | Mis pedidos e historial | `/cliente/pedidos` | Pendiente | **CREAR** | Ninguno (`receipt()` en `js/checkout.js` `L12` es efímero) | `.panel`, `.badge`, `.receipt` (impresión de comprobante), `money()` | Listado filtrable (`Todos`, `Activos`, `Completados`, `Cancelados`) con acceso al detalle y reimpresión de comprobante. |
| **CLI-07** | Seguimiento de pedido | `/cliente/pedidos/:id` | Pendiente | **CREAR** | Ninguno | `.checkout-progress` (adaptado a línea temporal vertical/horizontal), `.badge`, `.panel` | Línea temporal de estados adaptada a modalidad (`Recibido` → `Confirmado` → `En preparación` → `Listo`/`Despachado` → `En camino` → `Entregado`), solo lectura para cliente. |
| **CLI-08** | Mis reservas | `/cliente/reservas` | Pendiente | **CREAR** | Ninguno | `.panel`, `.badge`, `.action-button`, `#record-dialog` | Listado de reservas del cliente con fecha, hora, personas, mesa asignada, estado y botón de cancelar según política vigente. |

---

## 3. Pantallas de la Experiencia Mesero

| ID | Pantalla | Ruta / Contenedor objetivo | Estado actual en repo | Acción | Archivos existentes relacionados | Componentes reutilizables | Acciones pendientes clave |
|---|---|---|---|---|---|---|---|
| **MES-01** | Dashboard operativo del mesero | `/mesero` | Pendiente | **CREAR** | Ninguno | `.admin-sidebar`, `.admin-main`, `.admin-top`, `.stats-grid`, `.stat-card`, `.panel` | Diseñar panel táctil con KPIs de salón (mesas libres/ocupadas/reservadas, pedidos registrados, listos para entregar) y accesos rápidos. |
| **MES-02** | Mapa / Cuadrícula de mesas | `/mesero/mesas` | Pendiente | **CREAR** | Ninguno | `.cards-grid`, `.panel`, `.badge` (`.green`, `.red`), `.toolbar` | Cuadrícula de mesas configuradas (D-01) filtrable por zona y estado (`Disponible`, `Ocupada`, `Reservada`, `Fuera de servicio`), mostrando pedido activo y reserva asociada. |
| **MES-03** | Toma de pedido en mesa (Comanda) | `/mesero/nuevo-pedido` | Pendiente | **CREAR** / **REUTILIZAR** | Reutiliza catálogo de `js/app.js` (`L9-L54`) y patrón de `js/checkout.js` | `.filters`, `.product-card` (versión operativa compacta), lógica `cart` (`Map`), `.cart-line` | Selección de mesa, buscador + categorías, adición de múltiples productos y complementos, observaciones por ítem/comanda y envío con estado inicial `Pendiente` y pago `Pendiente` (D-04). |
| **MES-04** | Pedidos registrados de mesas | `/mesero/pedidos` | Pendiente | **CREAR** / **REUTILIZAR** | Reutiliza estructura de tabla de `js/admin.js` (`L12`, `L14`, `L25`) | `.table-wrap`, `.toolbar`, `.badge`, `#record-dialog` (detalle de pedido) | Consulta de pedidos de sus mesas; botones autorizados por D-05: **Marcar como entregado** y **Cancelar** (solo si aún no está en preparación). |
| **MES-05** | Cuenta activa de mesa y Cierre de cuenta | `/mesero/mesas/:id` | Pendiente | **CREAR** | Ninguno | `.panel`, `.checkout-summary`, `.receipt`, `.action-button` | Acumulado de todos los pedidos de la mesa, desglose de totales y acción **Solicitar cierre de cuenta** para cobro/conciliación controlada por Caja/Admin (D-04). |

---

## 4. Pantallas de la Experiencia Administrador

| ID | Pantalla | Ruta / Contenedor objetivo | Estado actual en repo | Acción | Archivos existentes relacionados | Componentes reutilizables | Acciones pendientes clave |
|---|---|---|---|---|---|---|---|
| **ADM-01** | Acceso administrativo | `/login` (reemplaza `#login-screen` de `admin.html`) | Visual / Parcial | **MEJORAR** | `admin.html` (`L1`), `js/admin.js` (`L8-L9`), `css/admin.css` (`L1`) | `.login-screen`, `.login-card`, `.password-field` | Eliminar credenciales hardcodeadas (`admin@forjabrava.com` / `Admin123*`); unificar login con control real de rol `administrador` y añadir Google Fonts. |
| **ADM-02** | Dashboard administrativo | `/admin` | Implementado (local) | **CONSERVAR** / **MEJORAR** | `admin.html` (`L1`), `js/admin.js` (`L11`, `L13`), `css/admin.css` (`L1`) | `.admin-sidebar`, `.admin-top`, `.stats-grid`, `.stat-card`, `.panel`, `.toolbar` | Corregir grid de 5 tarjetas KPI; usar hora local (`America/Bogota`); añadir accesos rápidos a Mesas, Categorías, Usuarios y Configuración. |
| **ADM-03** | Gestión de productos | `/admin/productos` | Parcial (local) | **MEJORAR** | `js/admin.js` (`L33-L35`), `css/admin.css` (`L1`) | `.cards-grid`, `.product-admin`, `#record-dialog`, `field()` | Ampliar formulario con descripción, selector de categoría, etiqueta, marca de complemento (`is_addon`), carga de imagen y priorizar desactivación lógica. |
| **ADM-04** | Gestión de categorías | `/admin/categorias` | Pendiente | **CREAR** | Ninguno | `.panel`, `.toolbar`, `.table-wrap`, `#record-dialog`, `.badge` | CRUD completo: nombre, descripción, imagen opcional, orden de visualización, estado activo/inactivo y conteo de productos asociados. |
| **ADM-05** | Gestión de pedidos | `/admin/pedidos` | Parcial (local) | **MEJORAR** | `js/admin.js` (`L12`, `L14`, `L23`, `L25`, `L29-L32`) | `.table-wrap`, `.toolbar`, `#record-dialog`, `orderRows()`, `orderDetail()` | Preservar filtros al cambiar estado; añadir columna Modalidad y Pago; permitir pedidos manuales multi-producto; reemplazar `prompt()` por selector; gestionar todas las transiciones de preparación. |
| **ADM-06** | Gestión de reservas y Calendario | `/admin/reservas` | Parcial (local) | **MEJORAR** | `js/admin.js` (`L15-L16`, `L24`, `L26-L27`, `L31`), `css/admin.css` (`L2`) | `.calendar-grid`, `.table-wrap`, `.toolbar`, `#record-dialog` | Integrar asignación de mesa, validación de capacidad y duración configurable (D-02); reemplazar `alert()` en calendario por modal de detalle diario; corregir fecha UTC. |
| **ADM-07** | Gestión de mesas | `/admin/mesas` | Pendiente | **CREAR** | Ninguno | `.cards-grid`, `.panel`, `.badge`, `#record-dialog` | CRUD de inventario de mesas (D-01): número/identificador, zona, capacidad, estado (`Disponible`, `Ocupada`, `Reservada`, `Fuera de servicio`), reserva y pedidos asociados. |
| **ADM-08** | Gestión de usuarios y roles | `/admin/usuarios` | Pendiente | **CREAR** | Ninguno | `.panel`, `.toolbar`, `.table-wrap`, `.badge`, `#record-dialog` | Listado de usuarios (nombre, correo, teléfono, rol, estado, fecha registro), activación/desactivación y asignación controlada de roles (`administrador`, `mesero`, `cliente`). |
| **ADM-09** | Caja | `/admin/caja` | Parcial (local) | **MEJORAR** | `js/admin.js` (`L17`, `L28`), `css/admin.css` (`L1`) | `.stats-grid`, `.panel`, `.toolbar`, `.table-wrap`, `.action-button` | Incorporar apertura de caja con base inicial, ingresos/egresos manuales, cobro de cuentas de mesa cerradas (D-04), efectivo esperado vs. contado, diferencia y no perder pedidos de días anteriores. |
| **ADM-10** | Reportes | `/admin/reportes` | Implementado (local) | **CONSERVAR** / **MEJORAR** | `js/admin.js` (`L18-L19`), `css/admin.css` (`L1-L2`) | `.stats-grid`, `.report-bar`, `.panel`, `@media print` | Limpiar código muerto en `report()`; agrupar por ID de producto con monto `$`; añadir desglose por modalidad, método de pago, reservas y movimientos de caja. |
| **ADM-11** | Auditoría del sistema | `/admin/auditoria` | Pendiente | **CREAR** | Ninguno | `.panel`, `.toolbar`, `.table-wrap`, `.badge` | Consulta filtrable (usuario, rol, módulo, fecha, acción) de eventos críticos: cambios de estado, cancelaciones, cierres de caja, cambios de rol y configuración. |
| **ADM-12** | Configuración del restaurante | `/admin/configuracion` | Pendiente | **CREAR** | Constantes `CONFIG` en `js/app.js` (`L1-L7`) y `deliveryFee` en `js/checkout.js` (`L2`) | `.panel`, `.record-form`, `.action-button`, `.notice` | Formulario centralizado para datos del restaurante, horarios, tarifa fija de domicilio (D-03), duración de reservas (D-02), WhatsApp, redes y parámetros operativos. |

---

## 5. Resumen cuantitativo del inventario

| Experiencia | Total pantallas | CONSERVAR / MEJORAR | REUTILIZAR (base) | CREAR (nuevas) |
|---|---|---|---|---|
| **Sitio Público** | 6 | 4 (`PUB-01`, `PUB-02`, `PUB-04`, `PUB-06`) | — | 2 (`PUB-03`, `PUB-05`) |
| **Cliente** | 8 | 4 (`CLI-01`, `CLI-02`, `CLI-04`, `CLI-05`) | — | 4 (`CLI-03`, `CLI-06`, `CLI-07`, `CLI-08`) |
| **Mesero** | 5 | 0 | 2 (`MES-03`, `MES-04` reutilizan catálogo/tabla) | 5 (`MES-01` a `MES-05`) |
| **Administrador** | 12 | 7 (`ADM-01`, `ADM-02`, `ADM-03`, `ADM-05`, `ADM-06`, `ADM-09`, `ADM-10`) | — | 5 (`ADM-04`, `ADM-07`, `ADM-08`, `ADM-11`, `ADM-12`) |
| **TOTAL SIGR** | **31** | **15 existentes conservadas/mejoradas** | **Reutilización transversal** | **16 pantallas nuevas** |
