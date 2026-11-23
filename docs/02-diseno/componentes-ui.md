# Catálogo de Componentes UI Compartidos
## FORJA BRAVA — SIGR

Define el inventario de componentes reutilizables (derivados de `index.html`, `admin.html`, `css/styles.css` y `css/admin.css`) que conformarán `src/components/` en la implementación React + Tailwind CSS v4.

---

## 1. Componentes de identidad y navegación

| Componente | Origen actual | Clasificación | Props / Variantes principales | Experiencias que lo usan |
|---|---|---|---|---|
| `BrandLogo` | `.brand` (`index.html` `L19`, `admin.html` `L1`) | **CONSERVAR / REUTILIZAR** | `subtitle` (`COCINA AL FUEGO`, `SIGR · SERVICIO`, `SIGR · ADMIN`), `size` (`sm`, `md`, `lg`), `to` | Todas (4) |
| `PublicHeader` | `.site-header` (`index.html` `L18-L27`) | **MEJORAR** | Estado `scrolled`, contador carrito reactivo, botón `RESERVAR`, estado de sesión (`MI CUENTA` vs `MI CUENTA · Nombre`), menú móvil | Público, Cliente |
| `AppSidebar` | `.admin-sidebar` (`admin.html` `L1`, `css/admin.css` `L1`) | **REUTILIZAR** | `items[]` filtrados por rol (`mesero` o `administrador`), ruta activa, enlace `Ver sitio público`, colapso automático `<= 800px` | Mesero, Administrador |
| `TopBar` | `.admin-top` (`admin.html` `L1`) | **REUTILIZAR** | `kicker`, `title`, nombre y rol del usuario autenticado, botón `CERRAR SESIÓN` | Cliente, Mesero, Administrador |

---

## 2. Botones, etiquetas y retroalimentación

| Componente | Origen actual | Clasificación | Variantes y estados | Experiencias que lo usan |
|---|---|---|---|---|
| `Button` | `.button.button-fire`, `.action-button`, `.under-link`, `.link-button` | **CONSERVAR / REUTILIZAR** | `variant`: `fire` (editorial 50px), `action` (operativo compacto), `outline`, `ghost`, `danger`, `link`; `loading`, `disabled` | Todas (4) |
| `StatusBadge` | `.badge`, `.badge.green`, `.badge.red` (`css/admin.css` `L1`) | **REUTILIZAR** | `tone`: `neutral` (`#eee0ca`), `success` (`#d8ead7`), `danger` (`#f3d7ca`), `fire` (`#f3dfca` + borde `#c66a32`) | Todas (4) |
| `ToastNotice` | `.toast` (`index.html` `L117`) y `.notice` (`admin.html` `L1`) | **CONSERVAR / REUTILIZAR** | `theme`: `light` (sobre oscuro) / `dark` (sobre claro); `aria-live="polite"`, auto-cierre 2.5–3s | Todas (4) |
| `EmptyState` | `.cart-empty`, `.empty-state` | **REUTILIZAR** | Icono `✳`, título/mensaje contextual, CTA opcional | Todas (4) |
| `SkeletonBlock` | Nuevo (no existe actualmente) | **CREAR** | Variantes `card`, `kpi`, `table-row`, `timeline` con tonos `#2c2924` (oscuro) o `#e9dfcf` (claro) | Todas (4) |

---

## 3. Contenedores, tarjetas, tablas y modales

| Componente | Origen actual | Clasificación | Uso y comportamiento | Experiencias que lo usan |
|---|---|---|---|---|
| `Panel` | `.panel` (`css/admin.css` `L1`) | **CONSERVAR / REUTILIZAR** | Superficie `#faf6ee`, borde `#e1d3bc`, padding `20px`, título opcional en `Playfair Display` | Cliente, Mesero, Administrador |
| `KpiCard` / `KpiGrid` | `.stats-grid`, `.stat-card` (`js/admin.js` `L11`) | **MEJORAR / REUTILIZAR** | Grid adaptable (`auto-fit, minmax(180px, 1fr)`) que soporta 4 o 5 tarjetas sin descuadre | Cliente, Mesero, Administrador |
| `DataTable` + `FilterToolbar` | `.toolbar` + `.table-wrap > table` (`css/admin.js` `L12-L16`) | **MEJORAR / REUTILIZAR** | Preserva filtros en estado React sin perder foco ni texto al mutar filas; scroll horizontal automático | Mesero, Administrador |
| `ModalDialog` | `#record-dialog`, `.auth-modal`, `.checkout-modal` | **MEJORAR / REUTILIZAR** | Diálogo accesible con cierre `Escape`, backdrop click, focus trap y tamaños `sm` (480px), `md` (600px), `lg` (760px). Reemplaza `alert()`, `confirm()` y `prompt()`. | Todas (4) |
| `Drawer` | `.cart-drawer` (`index.html` `L81`) | **CONSERVAR / REUTILIZAR** | Panel deslizable derecho (`min(440px, 100%)`) en papel `#e9dfcf` con cabecera y pie fijos | Público, Cliente, Mesero (móvil) |

---

## 4. Componentes de dominio compartidos

| Componente | Origen actual | Clasificación | Reutilización clave |
|---|---|---|---|
| `ProductCard` | `.product-card` (`js/app.js` `L50`) y `.product-admin` (`js/admin.js` `L33`) | **MEJORAR / REUTILIZAR** | 3 modos: `public` (editorial oscuro), `waiter` (compacto táctil para comanda), `admin` (con acciones CRUD y estado). |
| `CategoryFilterBar` | `.filters`, `.filter-btn` (`index.html` `L58`) | **MEJORAR / REUTILIZAR** | Dinámica desde tabla `categories` + campo de búsqueda; compartida entre `PUB-02` y `MES-03`. |
| `QuantityStepper` | `.cart-quantity` (`js/app.js` `L54`) | **CONSERVAR / REUTILIZAR** | Botones `−` / `+` accesibles; usado en Carrito, Detalle de producto y Comanda del mesero. |
| `OrderTimeline` | Inspirado en `.checkout-progress` (`css/styles.css` `L7`) | **CREAR** | Línea temporal de estados filtrada por modalidad (`Domicilio`, `Recoger`, `Mesa`); usada en `CLI-07` y detalle de pedido. |
| `TableCard` | Nuevo sobre `.panel` + `.badge` | **CREAR** | Tarjeta de mesa (número, zona, capacidad, estado, reserva y cuenta activa); compartida entre `MES-02` y `ADM-07`. |
| `ReservationCalendar` | `.calendar-grid` (`js/admin.js` `L26`, `css/admin.css` `L2`) | **MEJORAR** | Conserva rejilla de 42 celdas y navegación mensual; reemplaza `alert()` por `ModalDialog` de ocupación diaria. |
| `PrintableReceipt` | `.receipt` (`js/checkout.js` `L12`, `@media print`) | **CONSERVAR / REUTILIZAR** | Comprobante imprimible reutilizado en Checkout (`CLI-05`), Historial del cliente (`CLI-06`/`CLI-07`) y Pre-cuenta de mesa (`MES-05`). |
