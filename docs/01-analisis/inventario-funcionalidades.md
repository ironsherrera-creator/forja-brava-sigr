# Inventario de Funcionalidades y Estrategia de Evolución
## FORJA BRAVA — SIGR

Matriz maestra que clasifica cada módulo y funcionalidad del SIGR según su **estado comprobable en el repositorio actual** y la **estrategia de evolución** (`CONSERVAR`, `MEJORAR`, `REUTILIZAR`, `CREAR`, `MIGRAR/REEMPLAZAR`).

---

## 1. Matriz completa de funcionalidades

| Dominio | Funcionalidad / Módulo | Estado actual | Archivos actuales | Estrategia | Justificación / Acción concreta |
|---|---|---|---|---|---|
| **Público** | Landing comercial (Hero, Esencia, Experiencia, Footer) | Implementado y funcional | `index.html`, `css/styles.css` | **CONSERVAR** | Preservar diseño, narrativa y animaciones al portar a componentes React. |
| **Público** | Producto protagonista (`#destacado`) | Implementado parcialmente | `index.html` (`L65`) | **MEJORAR** | Conectar precio, nombre y disponibilidad al producto destacado configurado en BD. |
| **Público** | Menú digital y filtros de categoría | Implementado parcialmente | `index.html` (`L55-L61`), `js/app.js` (`L9-L51`) | **MEJORAR** | Añadir buscador, filtros generados desde tabla `categories` y contadores dinámicos. |
| **Público** | Detalle de producto y complementos | Pendiente | N/A | **CREAR** | Construir modal/drawer con ingredientes, complementos explícitos (`is_addon`), cantidad y notas. |
| **Público** | Carrito lateral (`forja-cart`) | Implementado parcialmente | `index.html` (`L81`), `js/app.js` (`L45-L56`) | **MEJORAR** / **REUTILIZAR** | Corregir hidratación inicial, soportar complementos/notas y reutilizar lógica en Mesero. |
| **Público** | Reservas públicas con disponibilidad | Pendiente | N/A | **CREAR** | Construir flujo de consulta de franjas (D-01, D-02), confirmación automática y compuerta login (D-06). |
| **Público** | Contacto y WhatsApp | Solo visual | `index.html` (`L75`, `L80`), `js/app.js` (`L68-L69`) | **MEJORAR** | Leer datos reales desde `restaurant_settings`; definir persistencia de formulario (P-03). |
| **Cliente** | Registro e inicio de sesión | Implementado parcialmente (local) | `index.html` (`L82-L100`), `js/app.js` (`L70-L84`) | **MIGRAR / REEMPLAZAR** | Conservar estética de `.auth-card`; reemplazar `localStorage` + `PBKDF2` cliente por **Supabase Auth** + recuperación de contraseña. |
| **Cliente** | Dashboard personal del cliente | Pendiente | N/A | **CREAR** | Vista independiente con pedidos activos, último pedido, próximas reservas e historial. |
| **Cliente** | Perfil y direcciones de entrega | Implementado parcialmente | `index.html` (`L101-L110`), `js/app.js` (`L85`) | **MEJORAR** | Extraer del modal de auth y añadir CRUD de direcciones de entrega. |
| **Cliente** | Checkout de 5 pasos y pagos simulados | Implementado parcialmente (local) | `index.html` (`L113-L116`), `js/checkout.js` | **MEJORAR** | Conservar 5 pasos y comprobante imprimible; añadir 3 modalidades, login obligatorio (D-06), tarifa fija (D-03), pago pendiente en mesa (D-04) y cálculo de precios en servidor. |
| **Cliente** | Mis pedidos, historial y seguimiento | Pendiente | N/A | **CREAR** | Listado filtrable y línea temporal de estados adaptada a cada modalidad (solo lectura). |
| **Cliente** | Mis reservas y cancelación | Pendiente | N/A | **CREAR** | Listado de reservas propias con mesa asignada y cancelación según política. |
| **Mesero** | Dashboard operativo | Pendiente | N/A | **CREAR** / **REUTILIZAR** | Reutilizar shell de `css/admin.css` para KPIs de salón y pedidos listos para servir. |
| **Mesero** | Mapa/cuadrícula de mesas y detalle | Pendiente | N/A | **CREAR** | Visualización en tiempo real de mesas (D-01), zonas, capacidades y reservas asociadas. |
| **Mesero** | Toma de comanda en mesa | Pendiente | Reutiliza `js/app.js` | **CREAR** / **REUTILIZAR** | Reutilizar catálogo, filtros y lógica de carrito para crear pedidos multi-producto en mesa. |
| **Mesero** | Gestión autorizada de pedidos de mesa | Pendiente | Reutiliza `js/admin.js` | **CREAR** / **REUTILIZAR** | Consultar pedidos de mesa, marcar `Entregado` y cancelar en `Pendiente` (D-05). |
| **Mesero** | Cuenta acumulada y solicitud de cierre | Pendiente | Reutiliza `.receipt` | **CREAR** | Consolidar pedidos de una mesa y enviar solicitud de cierre a Caja (D-04). |
| **Admin** | Login administrativo | Solo visual (inseguro) | `admin.html` (`L1`), `js/admin.js` (`L8-L9`) | **MIGRAR / REEMPLAZAR** | Eliminar credenciales hardcodeadas y unificar en Supabase Auth con verificación de rol + RLS. |
| **Admin** | Dashboard KPI y actividad reciente | Implementado y funcional (local) | `admin.html`, `js/admin.js` (`L11`, `L13`) | **CONSERVAR** / **MEJORAR** | Ajustar grid para 5 KPIs, usar zona horaria `America/Bogota` y leer desde PostgreSQL. |
| **Admin** | Gestión de productos | Implementado parcialmente | `js/admin.js` (`L33-L35`) | **MEJORAR** | Añadir descripción, selector de categoría, tag, complementos, carga a Supabase Storage y desactivación lógica. |
| **Admin** | Gestión de categorías | Pendiente | N/A | **CREAR** | CRUD completo de categorías con orden y estado activo/inactivo. |
| **Admin** | Gestión de pedidos y preparación | Implementado parcialmente | `js/admin.js` (`L12-L14`, `L23`, `L25`, `L29-L32`) | **MEJORAR** | Conservar tabla y filtros sin perder estado; añadir modalidad/pago, creación multi-producto y reemplazar `prompt()`. |
| **Admin** | Gestión de reservas y calendario | Implementado parcialmente | `js/admin.js` (`L15-L16`, `L24`, `L26-L27`) | **MEJORAR** | Conservar `.calendar-grid`; añadir mesa asignada, duración (D-02), modal diario en lugar de `alert()` y hora local. |
| **Admin** | Gestión de mesas | Pendiente | N/A | **CREAR** | CRUD de inventario dinámico de mesas (D-01): número, zona, capacidad y estado. |
| **Admin** | Gestión de usuarios y roles | Pendiente | N/A | **CREAR** | Listado, activación/desactivación y asignación controlada de roles (`cliente`, `mesero`, `administrador`). |
| **Admin** | Caja (apertura, movimientos, cierre) | Implementado parcialmente | `js/admin.js` (`L17`, `L28`) | **MEJORAR** | Añadir apertura/base inicial, cobro de cuentas de mesa (D-04), ingresos/egresos, arqueo y diferencia. |
| **Admin** | Reportes diarios y por periodo | Implementado parcialmente | `js/admin.js` (`L18-L19`) | **CONSERVAR** / **MEJORAR** | Conservar gráficos CSS e impresión; agrupar por `product_id`, sumar desgloses por modalidad/pago/caja y limpiar código muerto. |
| **Admin** | Configuración del restaurante | Pendiente | Constantes en `app.js` / `checkout.js` | **CREAR** | Centralizar horarios, tarifa fija de domicilio (D-03), duración de reservas (D-02), WhatsApp y contacto. |
| **Admin** | Auditoría de actividad | Pendiente | N/A | **CREAR** | Consulta filtrable e inmutable de eventos críticos del sistema. |
| **Infra** | Servidor local, bundling y almacenamiento | Implementado parcialmente | `package.json` (`L10`), `localStorage` | **MIGRAR / REEMPLAZAR** | Reemplazar `node -e` (Path Traversal) y `localStorage` de negocio por Vite + React + Supabase + RLS. |
