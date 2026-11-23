# Mapa de Navegación y Rutas React
## FORJA BRAVA — SIGR

Define la arquitectura de rutas objetivo para la SPA en React (`react-router-dom`), los layouts asociados, la protección por rol y las reglas de redirección sin implementar código en esta fase.

---

## 1. Tabla maestra de rutas

### 1.1. Experiencia Pública (`PublicLayout`)

| Ruta | Pantalla | Perfil permitido | Protección | Redirecciones / Comportamiento |
|---|---|---|---|---|
| `/` | Inicio (Landing comercial) | Público (todos) | Ninguna | Muestra botón `MI CUENTA` o `MI CUENTA · Nombre` si hay sesión. |
| `/menu` | Menú digital completo | Público (todos) | Ninguna | Sincroniza estado de categoría/búsqueda en query params (`?cat=&q=`). |
| `/reservas` | Reservas públicas | Público (consulta) / Autenticado (confirmar) | Parcial (D-06) | Al pulsar `Confirmar reserva` sin sesión, redirige a `/login?redirect=/reservas` conservando selección. |
| `/contacto` | Contacto y ubicación | Público (todos) | Ninguna | Puede renderizar vista dedicada o desplazar a `#contacto`. |
| `/login` | Inicio de sesión unificado | No autenticados | `GuestOnlyRoute` | Si ya tiene sesión activa, redirige según rol (`/cliente`, `/mesero`, `/admin`). Si trae `?redirect=`, retorna al destino tras login. |
| `/registro` | Registro de cliente | No autenticados | `GuestOnlyRoute` | Si ya tiene sesión activa, redirige a su dashboard. Crea rol `cliente`. |
| `/recuperar-contrasena` | Recuperación y restablecimiento | Público | Ninguna | Gestiona solicitud de enlace y actualización de contraseña vía Supabase Auth. |

### 1.2. Experiencia Cliente (`ClientLayout`)

| Ruta | Pantalla | Perfil permitido | Protección | Redirecciones |
|---|---|---|---|---|
| `/checkout` | Checkout en 5 pasos | `cliente` (y opcionalmente roles internos comprando como cliente) | `ProtectedRoute` (D-06) | Sin sesión → `/login?redirect=/checkout`. Carrito vacío → `/menu`. |
| `/cliente` | Dashboard del cliente | `cliente` | `ProtectedRoute(['cliente'])` | Sin sesión → `/login`. Otro rol → su dashboard. |
| `/cliente/perfil` | Mi perfil y direcciones | `cliente` | `ProtectedRoute(['cliente'])` | Sin sesión → `/login`. |
| `/cliente/pedidos` | Mis pedidos e historial | `cliente` | `ProtectedRoute(['cliente'])` | Sin sesión → `/login`. |
| `/cliente/pedidos/:orderId` | Detalle y seguimiento de pedido | `cliente` (propietario) | `ProtectedRoute(['cliente'])` + RLS | Si el pedido no pertenece al usuario → vista `404` / enlace a `/cliente/pedidos`. |
| `/cliente/reservas` | Mis reservas | `cliente` | `ProtectedRoute(['cliente'])` | Sin sesión → `/login`. |
| `/cliente/reservas/:reservationId` | Detalle de reserva | `cliente` (propietario) | `ProtectedRoute(['cliente'])` + RLS | Si no pertenece al usuario → `/cliente/reservas`. |

### 1.3. Experiencia Mesero (`WaiterLayout` con `AppSidebar`)

| Ruta | Pantalla | Perfil permitido | Protección | Redirecciones |
|---|---|---|---|---|
| `/mesero` | Dashboard operativo | `mesero` | `ProtectedRoute(['mesero'])` | Sin sesión → `/login`. Cliente → `/cliente`. Admin → `/admin`. |
| `/mesero/mesas` | Mapa / Cuadrícula de mesas | `mesero` | `ProtectedRoute(['mesero'])` | Permite filtrar por zona/estado y abrir mesa. |
| `/mesero/mesas/:tableId` | Detalle de mesa y Cuenta acumulada | `mesero` | `ProtectedRoute(['mesero'])` | Muestra pedidos activos de la mesa y solicitud de cierre de cuenta (D-04). |
| `/mesero/nuevo-pedido` | Selector de productos y Comanda | `mesero` | `ProtectedRoute(['mesero'])` | Acepta `?mesa=:tableId` para preseleccionar mesa. |
| `/mesero/pedidos` | Pedidos registrados de mesas | `mesero` | `ProtectedRoute(['mesero'])` | Acciones limitadas a D-05 (`Entregado` y `Cancelar` si `Pendiente`). |

### 1.4. Experiencia Administrador (`AdminLayout` con `AppSidebar`)

| Ruta | Pantalla | Perfil permitido | Protección | Redirecciones |
|---|---|---|---|---|
| `/admin` | Dashboard administrativo | `administrador` | `ProtectedRoute(['administrador'])` | Sin sesión → `/login`. Cliente/Mesero → vista `403` o su dashboard. |
| `/admin/productos` | Gestión de productos | `administrador` | `ProtectedRoute(['administrador'])` | Incluye creación/edición en modal o ruta `/admin/productos/nuevo` y `/admin/productos/:id/editar`. |
| `/admin/categorias` | Gestión de categorías | `administrador` | `ProtectedRoute(['administrador'])` | — |
| `/admin/pedidos` | Gestión de pedidos | `administrador` | `ProtectedRoute(['administrador'])` | Detalle en modal o `/admin/pedidos/:orderId`. |
| `/admin/reservas` | Gestión de reservas y Calendario | `administrador` | `ProtectedRoute(['administrador'])` | — |
| `/admin/mesas` | Gestión de inventario de mesas | `administrador` | `ProtectedRoute(['administrador'])` | — |
| `/admin/usuarios` | Gestión de usuarios y roles | `administrador` | `ProtectedRoute(['administrador'])` | — |
| `/admin/caja` | Caja (apertura, movimientos, cierre) | `administrador` | `ProtectedRoute(['administrador'])` | Sub-vistas o pestañas: Turno activo, Cuentas por cobrar, Movimientos, Historial de cierres. |
| `/admin/reportes` | Reportes de ventas y operación | `administrador` | `ProtectedRoute(['administrador'])` | — |
| `/admin/configuracion` | Configuración global del restaurante | `administrador` | `ProtectedRoute(['administrador'])` | — |
| `/admin/auditoria` | Auditoría de actividad | `administrador` | `ProtectedRoute(['administrador'])` | Solo lectura. |

### 1.5. Rutas del sistema
- `/acceso-denegado` (`403`): Mensaje claro con botón para volver al dashboard correspondiente al rol.
- `*` (`404`): Página no encontrada con identidad FORJA BRAVA y retorno a `/`.

---

## 2. Diagrama de navegación y protección por rol

```mermaid
flowchart TD
    Root[/ Sitio Público] --> Menu[/menu]
    Root --> Res[/reservas]
    Root --> Login[/login]
    Menu --> Cart[Drawer Carrito]
    Cart -->|Sin sesión D-06| Login
    Cart -->|Autenticado| Checkout[/checkout]
    Res -->|Confirmar sin sesión D-06| Login
    Login -->|Rol cliente| CliDash[/cliente]
    Login -->|Rol mesero| MesDash[/mesero]
    Login -->|Rol administrador| AdmDash[/admin]
    CliDash --> CliSub[Perfil / Pedidos / Seguimiento / Reservas]
    MesDash --> MesSub[Mesas / Cuenta Mesa / Comanda / Pedidos]
    AdmDash --> AdmSub[Productos / Categorías / Pedidos / Reservas / Mesas / Usuarios / Caja / Reportes / Config / Auditoría]
```
