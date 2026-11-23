# Estado Actual del Repositorio
## FORJA BRAVA — SIGR

Este diagnóstico sintetiza el estado comprobable del repositorio actual (`c:\Users\Sebastian\Documents\Urestaurante`) cruzando el código fuente real, la auditoría técnica integral (QSTI) y la auditoría de diseño y funcionalidades (TAREA 01).

---

## 1. Inventario real del código fuente

| Archivo / Carpeta | Rol actual | Estado comprobable |
|---|---|---|
| `index.html` (119 líneas) | Portal público, menú, drawer de carrito, modal de cuenta cliente (`#auth-modal`) y modal de checkout (`#checkout-modal`). | **Implementado parcialmente** (solo frontend). |
| `admin.html` (1 línea minificada) | Panel administrativo con pantalla de login, sidebar de 6 vistas (`dashboard`, `menu`, `orders`, `reservations`, `cash`, `reports`) y `<dialog id="record-dialog">`. | **Implementado parcialmente** (solo frontend; sin Google Fonts). |
| `css/input.css` (16 líneas) | Entrada Tailwind CSS v4 (`@import "tailwindcss"`, `@import "./styles.css"`, bloque `@theme` y `@source`). | **Implementado parcialmente** (omite `@source "../admin.html"`). |
| `css/styles.css` (7 líneas) | Estilos del sitio público, auth cliente, carrito y checkout + `@media print`. | **Implementado y funcional** (requiere formateo y modularización). |
| `css/admin.css` (2 líneas) | Estilos del panel administrativo, calendario `.calendar-grid` y `@media print`. | **Implementado y funcional** (contiene clases `.badge` listas para reusar). |
| `css/tailwind.css` (33 KB) | Salida compilada por `@tailwindcss/cli`. | **Generado** (`admin.html` carga además `styles.css` duplicándolo). |
| `js/app.js` (88 líneas) | Constante `CONFIG`, catálogo `PRODUCTS` (13 ítems), filtros, carrito (`forja-cart`), contacto y auth local cliente (`PBKDF2`). | **Implementado parcialmente** (no llama `updateCart()` al iniciar). |
| `js/checkout.js` (17 líneas) | Checkout de 5 pasos, complementos por regex, pago simulado y comprobante. | **Implementado parcialmente** (solo frontend; XSS en `innerHTML`). |
| `js/admin.js` (37 líneas) | Login admin hardcoded, dashboard, catálogo, pedidos, reservas/calendario, caja y reportes sobre `forja-sigr-demo`. | **Implementado parcialmente** (solo frontend; bug UTC en `today()`). |
| `package.json` | Dependencias Tailwind CSS v4.1.18 (`0` vulnerabilidades en `npm audit`) y servidor `node -e` en puerto `4173`. | **Implementado parcialmente** (servidor local vulnerable a Path Traversal). |
| `assets/images/` | 18 PNGs (~46.1 MB totales): 14 activos (~36.1 MB) y 4 huérfanos (`menu-*.png`, ~9.95 MB). `assets/fonts/` y `assets/icons/` vacías. | **Requiere optimización y limpieza**. |
| `.git/` | Repositorio inicializado sin commits, sin remoto configurado y con `node_modules/` en el área de staging. | **Requiere saneamiento antes del primer commit**. |

---

## 2. Fortalezas que se conservan como base

1. **Identidad visual sólida y diferenciada:** Paleta carbón/crema/papel/fuego, tipografías `Playfair Display` y `DM Sans`, logotipo `FB`, estilo editorial en público y layout operativo claro en administración.
2. **Flujo comercial validado:** Landing → Menú filtrable → Carrito → Checkout de 5 pasos → Comprobante imprimible → Administración de pedidos, reservas, caja y reportes.
3. **Componentes base reutilizables:** Tarjetas de producto, lógica de carrito (`Map`), shell administrativo (`.admin-sidebar`, `.stats-grid`, `.panel`, `.toolbar`, `.table-wrap`, `#record-dialog`, `.calendar-grid`, `.badge`, `.notice`, `.toast`) y estilos `@media print`.
4. **Dependencias limpias:** `npm audit` reporta `0` vulnerabilidades en los paquetes actuales.

---

## 3. Defectos, riesgos críticos y discrepancias verificadas

| Categoría | Hallazgo verificado en código | Evidencia exacta |
|---|---|---|
| **Seguridad (Crítico)** | Credenciales admin hardcodeadas (`admin@forjabrava.com` / `Admin123*`) y autorización exclusiva por `sessionStorage.getItem('forja-admin')==='1'`. | `admin.html` (`L1`), `js/admin.js` (`L8-L9`) |
| **Seguridad (Crítico)** | XSS almacenado/reflejado al insertar datos sin escapar en `innerHTML`. | `js/checkout.js` (`L9-L12`), `js/app.js` (`L50`, `L54`) |
| **Seguridad (Alto)** | Path Traversal en servidor local `node -e` y precios/totales confiados desde el cliente. | `package.json` (`L10`), `js/checkout.js` (`L4`, `L14`) |
| **Persistencia (Crítico)** | Datos aislados en `localStorage` (`forja-sigr-demo`, `forja-cart`, `forja-clientes-demo`); sin backend ni sincronización multi-dispositivo. | `js/app.js`, `js/checkout.js`, `js/admin.js` |
| **Lógica / UX (Alto)** | `updateCart()` no se ejecuta al cargar `index.html`, mostrando `0` tras recargar aunque haya ítems guardados. | `js/app.js` (`L45-L60`) |
| **Lógica (Alto)** | `today()` usa UTC (`new Date().toISOString().slice(0,10)`), provocando desfase diario en Colombia (UTC-5) a partir de las 7:00 p. m. en dashboard, reservas y caja. | `js/admin.js` (`L3`, `L11`, `L17`, `L24`) |
| **Lógica (Medio)** | Filtro de complementos por regex `/antojo\|acompañ\|adición\|bebida\|pap/i` clasifica Salchipapas como complementos. | `js/checkout.js` (`L7`) |
| **UI / Datos (Medio)** | Contadores estáticos (`13 ANTOJOS`) y producto destacado (`$28.900`) quemados en HTML; `.stats-grid` de 4 columnas para 5 tarjetas KPI; filtros de pedidos borrados al cambiar estado. | `index.html` (`L58`, `L65`), `css/admin.css` (`L1`), `js/admin.js` (`L29`) |
| **Rendimiento (Alto)** | Imágenes locales PNG de 2.1 a 2.9 MB cada una (~36.1 MB descargados en la vista de menú). | `assets/images/*.png` |
| **Pruebas / CI (Alto)** | 0% de pruebas automatizadas, sin ESLint, sin Vitest/Playwright y sin pipeline CI/CD. | `package.json` |

---

## 4. Discrepancias identificadas entre documentación previa y código real

- `README.md` y el documento maestro v2.0 describen la existencia de formularios de contacto y gestión completa de productos; en el código real, `#contact-form` es únicamente demostrativo (`js/app.js` `L68`) y `productForm()` en `js/admin.js` (`L35`) solo permite editar nombre, categoría (texto libre) y precio (no descripción, tag ni imagen).
- `admin.html` carga `css/tailwind.css` y además `css/styles.css` (que ya viene importado dentro de `css/input.css`), pero omite las Google Fonts presentes en `index.html`.
- El presente conjunto documental en `docs/` toma siempre el **estado real verificado del repositorio** como línea base.
