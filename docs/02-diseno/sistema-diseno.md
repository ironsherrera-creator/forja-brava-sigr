# Sistema de Diseño UI/UX Oficial
## FORJA BRAVA — SIGR

Este sistema de diseño formaliza los tokens, patrones visuales y reglas de accesibilidad extraídos del repositorio actual (`css/input.css`, `css/styles.css`, `css/admin.css`, `index.html`, `admin.html`) para aplicarse de forma homogénea en las cuatro experiencias (Sitio Público, Cliente, Mesero y Administrador).

---

## 1. Paleta cromática oficial (**CONSERVAR**)

| Nombre | HEX | Token CSS (`css/input.css` / `css/styles.css`) | Uso oficial |
|---|---|---|---|
| **Carbón** | `#171613` | `--color-carbon` / `--ink` | Fondos oscuros, sidebar operativa/admin, texto principal sobre papel/crema. |
| **Café** | `#35251d` | `--color-coffee` / `--coffee` | Superficies oscuras secundarias, hover/activo en sidebar, controles oscuros. |
| **Madera** | `#68452f` | `--color-wood` / `--wood` | Matices terrosos y acentos secundarios. |
| **Crema** | `#f1e8d8` | `--color-cream` / `--cream` | Fondo base del panel administrativo y del cliente, texto sobre fondos oscuros. |
| **Papel** | `#e9dfcf` | `--paper` | Secciones claras del sitio público, fondo de drawers y modales (`.cart-panel`, `.auth-card`, `.checkout-shell`). |
| **Arena** | `#d6c2a3` | `--color-sand` / `--sand` | Bordes de inputs, etiquetas de soporte, textos en sidebar oscura. |
| **Fuego** | `#c66a32` | `--color-fire` / `--fire` | CTA principales, acentos tipográficos `<em>`, asteriscos `✳`, indicadores activos. |
| **Fuego Hover** | `#e07c42` | Hover de `.button-fire` / `.nav-order` | Estado hover de botones primarios. |

### Paleta semántica operativa (extraída de `css/admin.css` y `css/styles.css`)
- **Superficie elevada clara:** `#faf6ee` (`.stat-card`, `.panel`) con borde `1px solid #e1d3bc` / `#e3d7c4`.
- **Texto secundario / muted:** `#756858` / `#786a5b` (metadatos, encabezados de tabla, estados vacíos).
- **Éxito / Disponible / Confirmado / Entregado:** Fondo `#d8ead7` con texto `#171613` (`.badge.green`).
- **Alerta / Pendiente / Reservada / En preparación:** Fondo `#eee0ca` o `#f3dfca` con borde/texto `#68452f` / `#c66a32` (`.badge`, `.has-res`).
- **Error / Cancelado / Ocupada / Crítico:** Fondo `#f3d7ca`, texto `#a64225` / `#9c4224` (`.badge.red`, `.error-text`).

---

## 2. Tipografía y jerarquías (**CONSERVAR** + **MEJORAR**)

- **Display / Editorial:** `"Playfair Display", Georgia, serif` (pesos `500`, `600`, `700` e itálicas `500`, `600`).
- **UI / Operativa:** `"DM Sans", Arial, sans-serif` (pesos `400`, `500`, `600`, `700`).
- **Corrección obligatoria:** Cargar ambas fuentes en todas las vistas (actualmente `admin.html` omite el `<link>` de Google Fonts).

| Nivel | Fuente | Tamaño / Interlineado | Tracking / Estilo | Uso |
|---|---|---|---|---|
| **Hero H1** | Playfair Display | `clamp(57px, 8vw, 108px)` / `0.98` | `-4.5px`, `em` en `#c66a32` | Titular principal del sitio público. |
| **Sección H2** | Playfair Display | `clamp(40px, 5.4vw, 72px)` / `1.05` | `-2px` | Encabezados de secciones editoriales. |
| **Página operativa H1** | Playfair Display | `34px` (`42px` en login) | Normal | Encabezado `.admin-top h1` y títulos de dashboard Cliente/Mesero. |
| **Panel / Modal H2** | Playfair Display | `23px–36px` | Normal | Títulos de `.panel`, `.cart-head`, `.auth-card`, `.checkout-shell`. |
| **Tarjeta H3 / KPI** | Playfair Display | `17px–28px` | Normal | Nombre de producto, número de mesa, cifra KPI `.stat-card strong`. |
| **Kicker / Mini-label** | DM Sans | `8px–10px` (`font-weight: 600–700`) | `1.2px–2px`, mayúsculas | Sobretítulos, botones, encabezados de tabla `th`. |
| **Cuerpo / Tabla** | DM Sans | `12px–14px` / `1.6–1.9` | Normal | Descripciones, celdas de tabla, formularios. |

---

## 3. Reglas de forma, bordes, espaciado e iconografía

- **Esquinas vivas (`border-radius: 0`):** Botones, tarjetas, inputs, tablas y modales mantienen ángulos rectos editoriales. Solo usan `border-radius: 50%` el isotipo `.brand-mark`, el contador `.cart-count`, el sello `.hero-stamp` y `.floating-whatsapp`.
- **Bordes y sombras:** Bordes finos de `1px` en lugar de sombras pronunciadas (`box-shadow` reservado únicamente a `.toast` y `.floating-whatsapp`).
- **Espaciados:**
  - Sitio público: margen fluido `--gutter: clamp(24px, 7.4vw, 112px)` y secciones con padding vertical `92px–112px` (`70px` en móvil).
  - Paneles operativos (Admin / Mesero / Cliente): `padding: 20px` en `.panel` / `.stat-card`, `gap: 14px` en grillas y `10px` en `.toolbar`.
- **Iconografía:** Conservar glifos tipográficos (`✳`, `↗`, `↓`, `↑`, `×`, `▦`, `▤`, `◷`, `▣`, `◉`, `⌁`, `‹`, `›`). En los módulos nuevos (Mesas, Mesero, Auditoría) complementar únicamente con iconos SVG lineales minimalistas (`stroke-width: 1.5`).

---

## 4. Responsive, accesibilidad e impresión

### Breakpoints oficiales
- **Sitio público (`css/styles.css`):** `<= 1000px` (tablet: menú 3 columnas) y `<= 700px` (móvil: navegación hamburguesa, menú 2 columnas, stack editorial).
- **Paneles operativos (`css/admin.css`):** `<= 800px` (sidebar colapsada a `66px` con iconos, grillas a 2 columnas) y `<= 480px` (tarjetas a 1 columna, controles táctiles de `>= 44px`).

### Accesibilidad (WCAG 2.1 AA base)
- Conservar `.skip-link` (`Saltar al contenido`), atributos `aria-live="polite"` en mensajes y toasts, `aria-expanded` en menú móvil y `@media (prefers-reduced-motion: reduce)`.
- Todo modal y drawer debe soportar cierre por tecla `Escape`, gestión de foco (`focus trap`) y retorno del foco al disparador.
- Reemplazar todos los `alert()`, `confirm()` y `prompt()` nativos de `js/admin.js` y `js/checkout.js` por diálogos accesibles (`<dialog>` / componente `Modal`).
- Asegurar contraste `>= 4.5:1` en textos sobre `#faf6ee`, `#e9dfcf` y `#171613`.

### Impresión (`@media print`)
- Conservar las reglas existentes para imprimir **Comprobantes de pedido** (`css/styles.css` `L7`), **Pre-cuentas de mesa** (`MES-05`) y **Reportes administrativos** (`css/admin.css` `L2`), ocultando navegación, sidebars y botones de acción.
