# Implementación de la Etapa 4 — Sistema Visual y Estructura de Navegación
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Estado:** Implementado y validado localmente (`ESLint`, `Vitest`, `Vite build` y `Playwright E2E` en resoluciones desktop, tablet y móvil).  
**Stack:** React 19 · Vite 8 · Tailwind CSS v4 · React Router 7 · `lucide-react` · integración directa con `AuthContext` y `ProtectedRoute` de la Etapa 3.

---

## 1. Arquitectura visual general

La interfaz de **FORJA BRAVA — SIGR** se estructura en tres capas claras y desacopladas:

1. **Capa de Design Tokens (`src/styles/design-tokens.css` + `src/styles/index.css`):** define en Tailwind CSS v4 (`@theme`) y propiedades CSS personalizadas (`:root`) la paleta oficial de marca, colores semánticos armonizados, superficies cálidas, tipografías, radios arquitectónicos discretos, sombras moderadas, dimensiones de layout, tamaños de iconos, capas `z-index` y transiciones respetuosas de `prefers-reduced-motion`.
2. **Capa de Componentes Base y Navegación (`src/components/ui/`, `src/components/layout/`, `src/components/navigation/`):** 27 componentes reutilizables de interfaz y 11 componentes de navegación/layout que eliminan la duplicación de código entre experiencias.
3. **Capa de Experiencias Independientes (`src/layouts/`):** cuatro layouts diferenciados (`PublicLayout`, `ClientLayout`, `WaiterLayout`, `AdminLayout`) conectados a una única fuente de navegación por rol (`src/config/navigation.js`) y al contexto de autenticación `useAuth()`.

---

## 2. Identidad visual aplicada y Design Tokens

### 2.1. Paleta oficial de marca (`src/styles/design-tokens.css`)
- **Carbón (`--color-carbon`):** `#171613` — barras laterales editoriales, encabezados oscuros y texto principal.
- **Café (`--color-coffee`):** `#35251d` — acciones secundarias, avatares y títulos de tablas.
- **Madera (`--color-wood`):** `#68452f` — etiquetas, iconos de acento y estados de contexto.
- **Crema (`--color-cream`):** `#f1e8d8` — lienzo principal de las áreas privadas y texto sobre oscuro.
- **Papel (`--color-paper`):** `#e9dfcf` — secciones claras editoriales y formularios de autenticación.
- **Arena (`--color-sand`):** `#d6c2a3` — bordes discretos y texto secundario sobre oscuro.
- **Fuego (`--color-fire`):** `#c66a32` y **Hover fuego (`--color-fire-hover`):** `#e07c42` — foco accesible, indicador activo de navegación y acciones primarias.

### 2.2. Tokens semánticos y de superficie
- **Superficies:** `--color-surface` (`#faf6ee`), `--color-surface-elevated` (`#fdfaf4`), `--color-surface-muted` (`#efe6d6`), `--color-surface-dark` (`#211d18`).
- **Estados:** Éxito (`#2f6b32` / `#e1efe0`), Advertencia (`#8f5310` / `#f6e7cf`), Error (`#a64225` / `#f4dcd2`), Información (`#3f5566` / `#e4eaee`), Deshabilitado (`#e6dccd` / `#8c7e70`).
- **Tipografía:** `Playfair Display` (`--font-display`) para títulos y encabezados editoriales; `DM Sans` (`--font-sans`) para navegación, formularios, tablas, botones y datos.
- **Iconografía:** `lucide-react` (`^1.x`), eliminando emojis en controles operativos y navegación.

---

## 3. Los cuatro layouts implementados

### 3.1. `PublicLayout` (`src/layouts/PublicLayout.jsx`)
- Conserva íntegramente la landing comercial (`HomePage.jsx`) y la estética gastronómica editorial.
- **Header:** logotipo `BrandLogo`, enlaces reales (`Inicio`, `Menú`, `Nosotros`, `Contacto`), acceso autenticado sensible al rol (`MI CUENTA`, `MESERO`, `ADMIN` + `Cerrar sesión`) o `Iniciar sesión` + `CREAR CUENTA` para invitados.
- **Móvil:** sustituye el menú superior por un `Drawer` lateral derecho con navegación clara y cero desbordamiento horizontal.
- **Footer:** logotipo, eslogan *«El sabor que se hace a fuego.»*, enlaces de navegación y datos provenientes de `RESTAURANT_INFO` (sin inventar redes sociales ni direcciones).

### 3.2. `ClientLayout` (`src/layouts/ClientLayout.jsx`)
- Entorno privado cálido bajo `/cliente/*` (`ProtectedRoute` con rol `cliente`).
- **Sidebar desktop + `MobileDrawer` móvil** con las 7 secciones del modelo funcional: `Inicio`, `Realizar pedido`, `Mis pedidos`, `Seguimiento`, `Mis reservas`, `Mis direcciones` y `Mi perfil`.
- **Topbar:** título de área, `Breadcrumbs` dinámicos, `UserMenu` (avatar con iniciales, nombre, rol, enlace a `/cliente/perfil` y cierre de sesión) y detección de desconexión (`OfflineBanner`).
- Conserva operativo el formulario real de edición de perfil propio en `/cliente` y `/cliente/perfil`.

### 3.3. `WaiterLayout` (`src/layouts/WaiterLayout.jsx`)
- Entorno operativo de salón bajo `/mesero/*` (`ProtectedRoute` con rol `mesero`).
- Prioriza velocidad en tablets y celulares: objetivos táctiles amplios (`largeTouch`, `min-h-[46px]`), acceso rápido `Tomar pedido` en el `Topbar` y navegación directa (`Inicio`, `Mesas`, `Tomar pedido`, `Pedidos`, `Historial`).
- Respeta estrictamente las decisiones **D-04** y **D-05**: sin enlaces a caja, reportes, auditoría ni estados de cocina.

### 3.4. `AdminLayout` (`src/layouts/AdminLayout.jsx`)
- Entorno ejecutivo bajo `/admin/*` (`ProtectedRoute` con rol `administrador`).
- **Sidebar agrupado y colapsable en desktop** (con tooltips accesibles en modo contraído y `MobileDrawer` en móvil/tablet):
  - *General:* Dashboard.
  - *Operación:* Pedidos, Reservas, Mesas.
  - *Catálogo:* Productos, Categorías.
  - *Clientes y personal:* Clientes, Usuarios, Roles y permisos.
  - *Finanzas:* Caja, Movimientos.
  - *Control:* Reportes, Auditoría.
  - *Configuración:* Restaurante.
- **Topbar:** contexto de página, `Breadcrumbs`, `NotificationButton` (centro de alertas preparado), `UserMenu` y cierre de sesión integrado.

---

## 4. Biblioteca de componentes reutilizables

- **UI Base (`src/components/ui/`):** `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `FormField`, `SearchInput`, `Badge`, `Avatar`, `Card` (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`), `Modal`, `ConfirmDialog`, `Drawer`, `Dropdown`, `Tooltip`, `Tabs`, `Pagination`, `Table`, `Skeleton` (`SkeletonCard`), `EmptyState`, `LoadingState`, `ErrorState`, `SectionHeader`, `OfflineBanner`.
- **Layout (`src/components/layout/`):** `PageHeader`, `ContentContainer`.
- **Navegación (`src/components/navigation/`):** `Sidebar`, `SidebarGroup`, `SidebarItem`, `NavigationLink`, `MobileDrawer`, `Topbar`, `Breadcrumbs`, `UserMenu`, `NotificationButton`, `LogoutButton`.

---

## 5. Responsive Design y Accesibilidad

- **Resoluciones verificadas en Playwright:** `360 px` (móvil pequeño), `390 px` (móvil), `768 px` (tablet), `1366 px` (portátil) y `1920 px` (escritorio), comprobando ausencia de desbordamiento horizontal (`scrollWidth <= innerWidth + 2`) y apertura/cierre de drawers móviles.
- **Accesibilidad:** foco visible global (`:focus-visible` en `--color-fire`), roles ARIA (`dialog`, `aria-modal`, `menu`, `tablist`, `status`, `alert`), cierre con `Escape` y restauración de foco en `Modal` y `Drawer`, encabezados semánticos, etiquetas asociadas a controles y soporte de `prefers-reduced-motion`.

---

## 6. Integración con autenticación (Etapa 3 conservada)

- Ningún layout duplica estado de sesión: `PublicLayout`, `UserMenu`, `LogoutButton`, `ClientPlaceholderPage`, `WaiterPlaceholderPage` y `AdminPlaceholderPage` consumen directamente `useAuth()`.
- Se conservaron intactos `AuthContext`, `ProtectedRoute`, `GuestOnlyRoute`, las rutas `/login`, `/registro`, `/recuperar-contrasena`, `/actualizar-contrasena`, `/acceso-denegado` y la redirección `/admin.html` -> `/admin`.
- Toda visibilidad en sidebar es únicamente una guía de UX; la autorización efectiva permanece en `ProtectedRoute`, RLS y RPCs de PostgreSQL.

---

## 7. Pruebas y evidencias ejecutadas

- `npm run lint`: **0 errores, 0 advertencias**.
- `npm test` (Vitest): **5 archivos, `39 / 39` pruebas aprobadas** (incluyendo `uiComponents.test.jsx` y `layoutsAndNavigation.test.jsx` + regresión completa de Etapa 3).
- `npm run build` (Vite 8): **exitoso (`1.30 s`)**.
- `npm run test:e2e` (Playwright Chromium): **`14 / 14` pruebas aprobadas (`22.3 s`)**, con 8 capturas generadas en `test-results/evidencias-etapa-4/` (`public-desktop-1366.png`, `public-mobile-390.png`, `client-desktop-1366.png`, `client-mobile-390.png`, `waiter-desktop-1366.png`, `waiter-tablet-768.png`, `admin-desktop-1920.png`, `admin-mobile-390.png`).

---

## 8. Pendientes para etapas funcionales posteriores

1. Conectar los módulos operativos actualmente representados con `ModulePlaceholderPage` (catálogo en vivo, carrito y checkout, reservas, mapa de mesas, comandas de mesero, caja, reportes y auditoría) a sus servicios y RPCs reales en Supabase.
2. Implementar `React.lazy()` por área (`/cliente`, `/mesero`, `/admin`) y optimización WebP de imágenes de producto para reducir el tamaño del bundle inicial.
3. Conectar `NotificationButton` con suscripciones Supabase Realtime cuando entren en operación los módulos de pedidos y reservas.
