# Arquitectura Frontend (React + Vite + Tailwind CSS v4)
## FORJA BRAVA — SIGR

Define la organización técnica del cliente web, explicando cómo reutilizar el diseño y las reglas existentes (`css/input.css`, `css/styles.css`, `css/admin.css`, `js/app.js`, `js/checkout.js`, `js/admin.js`) al migrar progresivamente a React + Vite.

---

## 1. Stack frontend objetivo

- **React (ES6+):** Renderizado declarativo (elimina manipulación imperativa y XSS por `innerHTML`).
- **Vite + `@vitejs/plugin-react`:** Reemplaza el servidor `node -e` vulnerable a Path Traversal (`package.json` `L10`), provee HMR, variables `VITE_*` y code-splitting por ruta (`React.lazy` para `/admin` y `/mesero`).
- **Tailwind CSS v4 + `@tailwindcss/vite`:** Elimina la compilación manual paralela (`css/tailwind.css` en Git) y conserva intacto el bloque `@theme` de `css/input.css`.
- **React Router (`react-router-dom`):** Enrutamiento SPA con separación de layouts y guardias de rol.
- **Zod:** Validación de formularios y normalización de entradas.
- **ESLint:** Calidad estática, reglas de React Hooks y prohibición de `dangerouslySetInnerHTML`.

---

## 2. Separación modular en `src/`

| Carpeta | Propósito |
|---|---|
| `src/app/` | Punto de entrada (`App.jsx`), definición del router (`router.jsx`), providers globales (`AuthProvider`, `CartProvider`, `ToastProvider`) y `ErrorBoundary`. |
| `src/layouts/` | 4 layouts diferenciados: `PublicLayout`, `ClientLayout`, `WaiterLayout`, `AdminLayout` (evitando colisión entre el fondo oscuro `#171613` del sitio público y el fondo crema `#f1e8d8` de paneles). |
| `src/components/` | Componentes UI reutilizables (`BrandLogo`, `Button`, `Panel`, `KpiGrid`, `DataTable`, `ModalDialog`, `Drawer`, `StatusBadge`, `ProductCard`, `TableCard`, `OrderTimeline`, `PrintableReceipt`, `ReservationCalendar`). |
| `src/features/` | Pantallas y lógica específica por dominio (`public/`, `auth/`, `client/`, `waiter/`, `admin/`). |
| `src/services/` | Módulos de acceso a Supabase (`supabaseClient.js`, `authService.js`, `catalogService.js`, `orderService.js`, `tableService.js`, `reservationService.js`, `cashService.js`, `reportService.js`, `settingsService.js`, `auditService.js`). |
| `src/schemas/` | Esquemas Zod (`authSchemas.js`, `productSchema.js`, `checkoutSchema.js`, `reservationSchema.js`, `tableSchema.js`, `cashSchema.js`, `settingsSchema.js`). |
| `src/styles/` | `theme.css` (tokens de `css/input.css`), `public.css` (migrado y formateado desde `css/styles.css`), `panels.css` (migrado desde `css/admin.css`), `print.css`. |
| `src/utils/` | Utilidades puras (`formatMoney` unificando las 3 copias actuales de `money()`, `dateBogota.js` corrigiendo el bug UTC de `today()`, `orderStatus.js`). |

---

## 3. Gestión de estado (Simple y sin sobreingeniería)

No se requiere Redux ni librerías pesadas en esta primera versión:
1. **`AuthContext`:** Mantiene `session`, `user`, `profile` (`role`, `full_name`, `phone`, `is_active`) y `loading`, sincronizado con `supabase.auth.onAuthStateChange`.
2. **`CartContext`:** Reemplaza el `Map` global de `js/app.js` y el acceso directo a `localStorage` de `js/checkout.js`. Se hidrata automáticamente al iniciar (corrigiendo el bug de recarga), soporta ítems con complementos/observaciones, sincroniza pestañas mediante `StorageEvent` y se limpia atómicamente al confirmar el pedido.
3. **Estado local + Custom Hooks por dominio (`useCatalog`, `useOrders`, `useTables`, `useReservations`):** Manejan carga, filtros persistentes en estado React (sin borrarse al actualizar una fila), caché básica y suscripciones Realtime.

---

## 4. Estrategia de reutilización del diseño actual

1. **Conservar tokens y clases editoriales:** El bloque `@theme` de `css/input.css` pasa directamente a `src/styles/theme.css`. Las reglas visuales de `css/styles.css` y `css/admin.css` se formatean y se encapsulan por layout (`.public-theme` vs `.panel-theme`) para evitar fugas de estilos globales.
2. **Optimizar activos antes de moverlos:** Las 14 imágenes activas de `assets/images/*.png` (~36.1 MB) se convierten a WebP (~1.2 MB) y las 4 huérfanas (`menu-*.png`) se descartan.
3. **Eliminar recargas y diálogos nativos:** Se reemplazan `window.location.reload()`, `alert()`, `confirm()` y `prompt()` por estado reactivo y `ModalDialog`.
