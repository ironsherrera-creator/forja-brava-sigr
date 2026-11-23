# Guía de Identidad Visual Oficial
## FORJA BRAVA — SIGR

Este documento formaliza la identidad visual **ya implementada en el repositorio** (`css/input.css`, `css/styles.css`, `css/admin.css`, `index.html`, `admin.html`) para garantizar que todas las pantallas nuevas (Cliente, Mesero y nuevos módulos de Administración) conserven exactamente el mismo lenguaje visual sin introducir un sistema paralelo.

---

## 1. Personalidad de marca

- **Concepto:** Rústico premium, urbano, elegante y cálido.
- **Tono visual:** Contraste editorial entre fondos oscuros tipo carbón/brasa (`#171613`, `#2b211a`) y superficies claras tipo carta impresa en papel artesanal (`#f1e8d8`, `#e9dfcf`, `#faf6ee`), con acentos puntuales en terracota/fuego (`#c66a32`).
- **Principio de cohesión por experiencia:**
  - **Sitio público:** Editorial, amplio, fotográfico y comercial.
  - **Cliente:** Claro, cálido y orientado a la compra y el seguimiento.
  - **Mesero:** Operativo, táctil, de alto contraste y baja fricción.
  - **Administrador:** Compacto, estructurado y orientado a lectura rápida de datos.

---

## 2. Paleta de colores oficial (**CONSERVAR**)

Fuente verificada en `css/input.css` (`L4-L10`), `css/styles.css` (`L1`) y `css/admin.css` (`L1`):

| Token / Nombre | Código HEX | Variable CSS actual | Uso oficial |
|---|---|---|---|
| **Carbón** | `#171613` | `--color-carbon` / `--ink` | Fondo principal oscuro, sidebar operativa/admin, texto principal sobre superficies claras. |
| **Café** | `#35251d` | `--color-coffee` / `--coffee` | Superficies oscuras secundarias, hover/estado activo en sidebar, botón toggle de contraseña. |
| **Madera** | `#68452f` | `--color-wood` / `--wood` | Acentos terrosos secundarios y matices cálidos. |
| **Crema** | `#f1e8d8` | `--color-cream` / `--cream` | Fondo base del panel administrativo (`.admin-body`, `.login-card`), texto principal sobre fondos oscuros. |
| **Papel** | `#e9dfcf` | `--paper` | Superficies editoriales claras (`#esencia`, `#experiencia`), paneles de modales (`.cart-panel`, `.auth-card`, `.checkout-shell`). |
| **Arena** | `#d6c2a3` | `--color-sand` / `--sand` | Bordes de inputs, divisores sutiles, etiquetas secundarias y textos de navegación en sidebar. |
| **Fuego** | `#c66a32` | `--color-fire` / `--fire` | Acciones primarias (`.button-fire`, `.action-button`, `.nav-order`), itálicas destacadas (`<em>`), acentos `✳` y barras de progreso/reporte. |
| **Fuego Hover** | `#e07c42` | Hardcoded en `.nav-order:hover` / `.button-fire:hover` | Estado hover de botones primarios. |

### Colores de soporte y estados semánticos (ya presentes en `css/styles.css` y `css/admin.css`)

| Uso semántico | Código HEX | Evidencia actual | Aplicación recomendada en SIGR |
|---|---|---|---|
| **Superficie de tarjeta / panel admin** | `#faf6ee` | `.stat-card`, `.panel` (`css/admin.css` `L1`) | Tarjetas KPI, contenedores de tablas, tarjetas de mesas y resumen del cliente. |
| **Borde sutil de panel / tabla** | `#e1d3bc` / `#e3d7c4` | `.panel`, `th, td` (`css/admin.css` `L1`) | Separadores de filas, bordes de tarjetas y calendario. |
| **Texto secundario / muted** | `#756858` / `#786a5b` | `.muted`, `.stat-card span`, `.cart-line small` | Metadatos, etiquetas de tabla, textos de ayuda y estados vacíos. |
| **Fondo oscuro de contacto** | `#2b211a` | `.contact-section` (`css/styles.css` `L1`) | Secciones oscuras de transición. |
| **Estado positivo / Disponible / Entregado** | `#d8ead7` (fondo) | `.badge.green` (`css/admin.css` `L1`) | Mesas `Disponible`, pedidos `Entregado`, reservas `Confirmada`, pagos `Confirmación simulada`. |
| **Estado alerta / Error / Cancelado / Ocupada** | `#f3d7ca` (fondo), `#a64225` / `#9c4224` (texto) | `.badge.red`, `.error-text`, `.checkout-error`, `.auth-message` | Mensajes de validación, pedidos/reservas `Cancelado`, mesas `Ocupada` o `Fuera de servicio`. |
| **Estado neutro / Pendiente / Reservada** | `#eee0ca` / `#f3dfca` (fondo) | `.badge`, `.calendar-grid button.has-res` | Pedidos `Pendiente` / `En preparación`, reservas `Pendiente`, mesas `Reservada`. |

---

## 3. Tipografía oficial (**CONSERVAR** y **MEJORAR** en `admin.html`)

Fuente verificada en `index.html` (`L11`) y `css/input.css` (`L11-L12`):

- **Display / Editorial:** `"Playfair Display", Georgia, serif` (`--font-display` / `--serif`).
  - Pesos cargados: `500`, `600`, `700` e itálicas `500`, `600`.
  - Uso: Titulares `h1`, `h2`, `h3` de producto, valores numéricos destacados en KPIs (`.stat-card strong`), precios protagonistas, acentos en `<em>` pintados con `--color-fire`.
- **Interfaz / Operativa:** `"DM Sans", Arial, sans-serif` (`--font-sans` / `--sans`).
  - Pesos cargados: `400`, `500`, `600`, `700`.
  - Uso: Navegación, botones, etiquetas en mayúsculas con tracking amplio (`letter-spacing: 1px–2px`), párrafos descriptivos, inputs, tablas y badges.
- **Acción de mejora obligatoria:** Garantizar la carga de Google Fonts (`Playfair Display` y `DM Sans`) en **todas** las rutas (actualmente `admin.html` omite el `<link>` de fuentes).

---

## 4. Logotipo y marca (**CONSERVAR**)

Estructura verificada en `index.html` (`L19`, `L78`) y `admin.html` (`L1`):
- **Isotipo (`.brand-mark`):** Círculo de `34px × 34px` (`42px` en footer) con borde `1px solid #d6c2a366`, tipografía `Playfair Display` `600` de `25px` y `letter-spacing: -3px`: letra `F` en crema y letra `B` en fuego (`#c66a32`, `15px`).
- **Wordmark (`.brand-name`):** `FORJA` (regular) + `BRAVA` (`font-weight: 700`), `letter-spacing: 2px`, con subtítulo `<small>` en `7px` color `--sand` adaptado al contexto:
  - Sitio público / Cliente: `COCINA AL FUEGO`
  - Mesero: `SIGR · SERVICIO`
  - Administrador: `SIGR · ADMIN`

---

## 5. Catálogo de componentes visuales (**CONSERVAR** / **REUTILIZAR**)

### 5.1. Botones
- **Forma:** Rectangulares con esquinas vivas (`border-radius: 0`), sin bordes redondeados genéricos.
- **Primario editorial (`.button.button-fire`):** Altura `50px`, fondo `#c66a32`, texto blanco, `9px`, `letter-spacing: 1.2px`, `font-weight: 700`, `padding: 0 21px`, hover `#e07c42` con elevación `translateY(-2px)`.
- **Primario operativo (`.action-button`):** Fondo `#c66a32`, texto blanco, `padding: 11px 14px`.
- **Secundario / Enlace subrayado (`.under-link`, `.logout-button`):** Fondo transparente, borde inferior `1px solid #c66a32`, texto en mayúsculas.
- **Botón de tabla (`.table-wrap td button`, `.link-button`):** Sin fondo ni borde, texto `#b3582b`.
- **Estado deshabilitado:** `opacity: .45; cursor: not-allowed` (`css/admin.css` `L2`).

### 5.2. Tarjetas
- **Tarjeta de producto pública (`.product-card`):** Sin borde ni sombra, imagen con `object-fit: cover`, altura fluida `clamp(180px, 20vw, 265px)`, zoom suave en hover (`scale(1.055)`), etiqueta `.product-tag` en esquina superior izquierda (`background: #e9dfcf; color: #171613`), fila de nombre (`Playfair Display 20px`) + precio (`--sand`), descripción corta y botón inferior de ancho completo con borde superior `1px solid #e9dfcf36`.
- **Tarjeta de panel / KPI (`.stat-card`, `.panel`):** Fondo `#faf6ee`, borde `1px solid #e1d3bc`, `padding: 20px`. Etiqueta superior en `10px` color `#756858` y cifra principal en `Playfair Display 28px`.
- **Tarjeta de producto / mesa operativa (`.product-admin` y evolución para Mesas):** Hereda `.panel`, con encabezado claro, estado en `.badge` y barra de acciones directa.

### 5.3. Formularios
- **Editorial minimalista (`.contact-form`):** Inputs con fondo transparente y solo `border-bottom: 1px solid #e9dfcf65` sobre fondo oscuro.
- **Operativo / Modal (`.auth-card`, `.checkout-form`, `.record-form`, `.login-card`):** Etiqueta en bloque (`10px–11px`), input/select/textarea de ancho completo (`100%`), `padding: 11px–12px`, fondo `#fff` / `#fff9`, borde `1px solid #d6c2a3` (o `#17161335`), foco con `outline-color: #c66a32`.
- **Mensajes de error:** Texto inline bajo el campo o formulario en `#a64225` / `#9c4224`, `min-height: 16px`, `aria-live="polite"`.

### 5.4. Tablas y Toolbars
- **Toolbar (`.toolbar`):** Fila flexible (`display: flex; gap: 10px; flex-wrap: wrap`) con buscadores, filtros de fecha, selectores de estado y botón `.action-button`.
- **Tabla (`.table-wrap > table`):** Scroll horizontal automático en pantallas pequeñas, `font-size: 12px`, `th` en `9px` mayúsculas `#776854` con `letter-spacing: 1px`, celdas con `padding: 12px` y `border-bottom: 1px solid #e3d7c4`.

### 5.5. Modales, Drawers y Notificaciones
- **Drawer lateral (`.cart-drawer` / `.cart-panel`):** Ancho `min(440px, 100%)`, fondo `#e9dfcf`, backdrop `#090807bd`, transición horizontal suave.
- **Modal centrado (`.auth-modal`, `.checkout-modal`, `<dialog id="record-dialog">`):** Fondo `#e9dfcf` / `#f1e8d8`, ancho `min(480px–760px, 100%)`, scroll interno vertical (`max-height: 90–94vh`).
- **Notificaciones (`.toast`, `.notice`):** Rectangulares con contraste invertido (`.toast` crema sobre oscuro en público; `.notice` carbón sobre claro en admin/mesero).

### 5.6. Iconografía, Bordes, Sombras y Fotografía
- **Iconografía:** Glifos tipográficos ligeros (`✳`, `↗`, `↓`, `↑`, `×`, `▦`, `▤`, `◷`, `▣`, `◉`, `⌁`, `‹`, `›`). Si se incorporan iconos SVG en módulos nuevos (ej. Mesero/Mesas), deben ser monocromáticos de trazo fino (`1.5px`) para mantener armonía.
- **Bordes y sombras:** Predominan bordes finos `1px` y diseño plano editorial; sombras limitadas a elementos flotantes (`.floating-whatsapp`, `.toast`).
- **Fotografía:** Mantener las 14 fotografías locales activas (`assets/images/hero-forja-brava.png` y `producto-*.png`) optimizadas en peso (WebP) sin alterar su colorimetría cálida.

---

## 6. Espaciados, Responsive e Impresión

- **Margen lateral fluido público:** `--gutter: clamp(24px, 7.4vw, 112px)`.
- **Puntos de quiebre oficiales:**
  - Sitio público (`css/styles.css`): `<= 1000px` (tablet: menú 3 columnas) y `<= 700px` (móvil: menú hamburguesa, grilla de productos 2 columnas, stack vertical en secciones editoriales).
  - Paneles operativos (`css/admin.css`): `<= 800px` (sidebar colapsada a `66px` con iconos, KPIs y cards en 2 columnas) y `<= 480px` (cards en 1 columna).
- **Accesibilidad de movimiento:** Conservar `@media (prefers-reduced-motion: reduce)` (`css/styles.css` `L5`).
- **Impresión (`@media print`):** Conservar las reglas existentes en `css/styles.css` (`L7`) para imprimir comprobantes de pedido y en `css/admin.css` (`L2`) para imprimir reportes limpios ocultando navegación y botones.
