# Especificación Detallada — Sitio Público
## FORJA BRAVA — SIGR

Este documento especifica pantalla por pantalla la experiencia pública del restaurante, conservando la estética editorial de `index.html` y `css/styles.css`, y detallando las 14 dimensiones obligatorias por pantalla.

---

## PUB-01: Página de inicio (Landing comercial)

1. **Nombre:** Página de inicio (`/`).
2. **Objetivo:** Presentar la marca FORJA BRAVA, comunicar su propuesta gastronómica al fuego y dirigir al visitante hacia el menú digital, reservas y cuenta de cliente.
3. **Estado actual:** Implementado (`CONSERVAR` estructura visual y narrativa / `MEJORAR` conexiones dinámicas).
4. **Archivos existentes relacionados:** `index.html` (`L17-L78`), `css/styles.css` (`L1-L5`), `js/app.js` (`L1-L7`, `L60-L67`).
5. **Componentes reutilizables:** `.site-header`, `.brand`, `.menu-toggle`, `.main-nav`, `.hero`, `.ticker`, `.essence`, `.feature`, `.experience`, `.site-footer`, `.reveal`, `.toast`.
6. **Distribución visual:**
   - Cabecera fija superior (transparente sobre Hero, carbón traslúcido `#171613f5` al hacer scroll > 40px) con logotipo a la izquierda y navegación + botones de `PEDIDO`, `RESERVAR`, `MI CUENTA` y `HACER PEDIDO` a la derecha.
   - Secuencia vertical alternando fondos oscuros y claros: Hero (`#171613`) → Cinta animada (`#c66a32`) → Nuestra Esencia (`#e9dfcf`) → La Carta (`#171613`) → Producto Protagonista (`#302218`) → Experiencia (`#e9dfcf`) → Contacto (`#2b211a`) → Footer (`#171613`).
7. **Información presentada:** Eslogan, manifiesto de marca, carta destacada, producto protagonista (nombre, descripción, ingredientes, precio real), galería de 3 momentos de experiencia y datos del restaurante (ubicación, horario, teléfono).
8. **Acciones disponibles:** Navegar entre secciones/rutas, abrir menú móvil, explorar carta, ir a reservas públicas, abrir drawer de carrito, abrir acceso/cuenta de cliente, sumar producto protagonista al carrito, volver arriba.
9. **Validaciones:** El botón `SUMAR AL PEDIDO` del producto protagonista debe verificar que el producto siga activo/disponible en el catálogo real antes de agregarlo.
10. **Estados de carga, vacío y error:**
    - *Carga:* Renderizado inmediato de estructura editorial; esqueleto suave en precio/botón del producto destacado mientras carga el catálogo.
    - *Vacío:* Si no hay producto destacado configurado, se oculta la sección `#destacado` limpiamente sin dejar un bloque roto.
    - *Error:* Si fallan imágenes remotas o de catálogo, aplicar fallback local (`hero-forja-brava.png`).
11. **Comportamiento responsive:**
    - Escritorio (`> 1000px`): navegación horizontal completa, grilla de 3 columnas en Esencia y Experiencia.
    - Tablet (`<= 1000px`): márgenes `--gutter: 5vw`, adaptación de rejilla Esencia a 2 columnas.
    - Móvil (`<= 700px`): menú hamburguesa desplegable (`.main-nav.open`), Hero alineado abajo, stack vertical en Esencia y 2 columnas + tarjeta ancha en Experiencia.
12. **Navegación de entrada y salida:** Entrada por URL raíz `/` o logotipo `.brand` desde cualquier página. Salida hacia `/menu` (`#menu`), `/reservas`, `/contacto`, `/login` (o `/cliente` si está autenticado) y drawer de carrito.
13. **Permisos requeridos:** Acceso público (sin autenticación).
14. **Criterios de aceptación:**
    - Conserva intacta la estética editorial actual y animaciones respetando `prefers-reduced-motion`.
    - El precio y disponibilidad de `#destacado` provienen de la fuente de datos real (no quemados en HTML).
    - Incluye acceso visible a Reservas en la navegación principal.

---

## PUB-02: Menú digital

1. **Nombre:** Menú digital (`/menu` y sección `#menu` en inicio).
2. **Objetivo:** Permitir a cualquier visitante explorar, buscar y filtrar la carta de comida rápida colombiana, ver precios y agregar productos al pedido.
3. **Estado actual:** Parcial (`MEJORAR` filtros, buscador y contadores dinámicos).
4. **Archivos existentes relacionados:** `index.html` (`L55-L61`), `css/styles.css` (`L1`, `L3-L4`), `js/app.js` (`L9-L51`, `L63`).
5. **Componentes reutilizables:** `.menu-toolbar`, `.filters`, `.filter-btn`, `.product-grid`, `.product-card`, `.product-tag`, `money()`.
6. **Distribución visual:**
   - Encabezado con kicker (`02 / LA CARTA`), titular `Playfair Display` y subtítulo.
   - Barra de herramientas delimitada por bordes horizontales con filtros de categoría dinámicos a la izquierda, campo de búsqueda discreto y contador real de productos/categorías a la derecha.
   - Cuadrícula de tarjetas de producto (`.product-grid`) sin bordes pesados, sobre fondo carbón `#171613`.
7. **Información presentada:** Por cada tarjeta: fotografía, etiqueta destacada (`.product-tag`, si existe), nombre, precio formateado en `COP`, descripción corta e indicador de disponibilidad.
8. **Acciones disponibles:** Filtrar por categoría (`TODO` + categorías activas), buscar por nombre/descripción, abrir **Detalle de producto** (`PUB-03`) al pulsar la imagen o título, y `SUMAR AL PEDIDO +` directo en productos sin configuración obligatoria.
9. **Validaciones:** Productos con `disponible = false` no deben poder agregarse al carrito (se ocultan o muestran deshabilitados según configuración). El contador debe reflejar exactamente los ítems visibles/activos.
10. **Estados de carga, vacío y error:**
    - *Carga:* 4–8 tarjetas skeleton con tono `#2c2924` manteniendo la altura de `.product-image-wrap`.
    - *Vacío:* Mensaje claro *"No encontramos antojos que coincidan con tu búsqueda"* con botón para restablecer filtros.
    - *Error:* Banner no bloqueante con botón `REINTENTAR` si falla la carga del catálogo.
11. **Comportamiento responsive:** 4 columnas en escritorio (`> 1000px`), 3 columnas en tablet (`<= 1000px`), 2 columnas en móvil (`<= 700px`) con filtros envolventes (`flex-wrap`).
12. **Navegación de entrada y salida:** Entrada desde header (`Menú`), Hero (`EXPLORAR MENÚ`) o footer. Salida hacia modal `PUB-03` (Detalle de producto) o drawer `PUB-04` (Carrito).
13. **Permisos requeridos:** Acceso público (sin autenticación, conforme a D-06).
14. **Criterios de aceptación:**
    - Los botones de filtro y el contador total se generan dinámicamente desde las categorías y productos activos (cero textos fijos como `13`).
    - El buscador filtra en tiempo real junto con la categoría activa.
    - Los productos inactivos no se pueden sumar al carrito.

---

## PUB-03: Detalle de producto

1. **Nombre:** Detalle de producto (Modal / Drawer de ficha de producto).
2. **Objetivo:** Mostrar la información completa de un producto, permitir elegir complementos explícitos, ajustar cantidad y agregar observaciones antes de sumarlo al pedido.
3. **Estado actual:** Pendiente (`CREAR` reutilizando el patrón de modales en `#e9dfcf`).
4. **Archivos existentes relacionados:** `js/app.js` (`L50`, tarjetas base), `css/styles.css` (`L6-L7`, estilos de `.auth-modal` / `.checkout-shell`).
5. **Componentes reutilizables:** `.checkout-modal` / `.checkout-shell`, `.button-fire`, `.cart-quantity`, `money()`, `.toast`.
6. **Distribución visual:**
   - Modal centrado (ancho `min(720px, 100%)`) en superficie papel `#e9dfcf` con texto carbón `#171613`.
   - En escritorio, diseño en 2 columnas: fotografía ampliada + etiqueta a la izquierda; nombre (`Playfair Display`), precio unitario, descripción completa, lista de ingredientes, lista de complementos marcables con precio adicional, campo de observaciones y barra inferior fija con selector de cantidad (`− / +`) + botón `AGREGAR AL PEDIDO · $TOTAL`.
7. **Información presentada:** Fotografía ampliada, categoría, etiqueta, nombre, descripción, ingredientes, complementos habilitados para el producto, precio unitario y total recalculado en vivo.
8. **Acciones disponibles:** Seleccionar/deseleccionar complementos, modificar cantidad (`>= 1`), escribir observaciones (ej. *"sin cebolla"*), agregar al carrito y cerrar modal (`×`, backdrop o tecla `Escape`).
9. **Validaciones:** Cantidad entera `>= 1` (máximo razonable configurable); observaciones limitadas en longitud (ej. 200 caracteres); los complementos solo se listan si están marcados explícitamente como complementos activos en los datos (nunca por regex).
10. **Estados de carga, vacío y error:**
    - *Carga:* Skeleton breve si el detalle/complementos se consultan bajo demanda.
    - *Vacío:* Si el producto no tiene complementos configurados, se omite el bloque de complementos sin mostrar mensajes de error.
    - *Error:* Si el producto fue desactivado mientras se consultaba, deshabilitar el botón de agregar y mostrar aviso claro.
11. **Comportamiento responsive:** 2 columnas en escritorio; en móvil (`<= 700px`) apilado vertical con imagen superior, scroll interno y botón de agregar visible al final.
12. **Navegación de entrada y salida:** Entrada al hacer clic en una tarjeta del menú (`PUB-02`). Salida al cerrar el modal o al confirmar agregado (muestra toast y actualiza `PUB-04`).
13. **Permisos requeridos:** Acceso público (sin autenticación).
14. **Criterios de aceptación:**
    - El total del botón se recalcula inmediatamente al cambiar cantidad o complementos.
    - Al agregar al carrito, se conservan el producto, complementos y observaciones como línea diferenciada.
    - Soporta cierre por tecla `Escape` y foco accesible.

---

## PUB-04: Carrito lateral (Drawer)

1. **Nombre:** Carrito lateral (`EL PEDIDO`).
2. **Objetivo:** Permitir revisar, ajustar y validar los productos seleccionados antes de pasar al checkout.
3. **Estado actual:** Parcial (`MEJORAR` hidratación inicial, complementos, observaciones y sincronización).
4. **Archivos existentes relacionados:** `index.html` (`L81`), `css/styles.css` (`L1`, `.cart-drawer`), `js/app.js` (`L45`, `L53-L56`, `L64`, `L88`).
5. **Componentes reutilizables:** `.cart-drawer`, `.cart-panel`, `.cart-head`, `.cart-line`, `.cart-quantity`, `.cart-empty`, `.cart-summary`, `.button-fire`.
6. **Distribución visual:**
   - Drawer lateral derecho (`min(440px, 100%)`) en papel `#e9dfcf` con backdrop oscuro `#090807bd`.
   - Cabecera fija (`TU ANTOJO, EN CAMINO` / `EL PEDIDO.`), zona central desplazable de líneas de pedido y pie fijo con resumen financiero y CTA principal.
7. **Información presentada:** Por línea: nombre del producto, complementos seleccionados, observaciones (si existen), precio unitario, subtotal de línea y cantidad. En el pie: subtotal, indicación de tarifa fija de domicilio (cuando aplique) y total estimado.
8. **Acciones disponibles:** Aumentar/disminuir cantidad (`+`/`−`), eliminar ítem al llegar a `0`, vaciar/volver al menú si está vacío, cerrar drawer (`×`, backdrop, `Escape`) y pulsar `IR AL CHECKOUT ↗`.
9. **Validaciones:** Deshabilitar `IR AL CHECKOUT` si el carrito está vacío. Validar disponibilidad de ítems antes de iniciar checkout. **Compuerta D-06:** si el usuario no está autenticado al pulsar `IR AL CHECKOUT`, mostrar aviso claro y redirigir a `CLI-01` (`/login`) conservando el carrito en `localStorage`.
10. **Estados de carga, vacío y error:**
    - *Carga:* Indicador breve al validar disponibilidad antes de abrir checkout.
    - *Vacío:* Conserva `.cart-empty` (*"Tu pedido empieza con un buen antojo"* + `MIRAR EL MENÚ ↗`) y oculta `.cart-summary`.
    - *Error:* Si un producto guardado en `localStorage` ya no está disponible, destacarlo con aviso para retirarlo antes de continuar.
11. **Comportamiento responsive:** Panel de `440px` en escritorio/tablet; ancho completo (`100%`) en móvil (`<= 700px`) con padding compacto (`24px`).
12. **Navegación de entrada y salida:** Entrada desde `.cart-trigger` en header o desde `PUB-03`. Salida hacia `#menu` (si está vacío), hacia `CLI-01` (si no hay sesión, D-06) o hacia `CLI-05` (Checkout).
13. **Permisos requeridos:** Acceso público para armar el carrito; autenticación obligatoria (`cliente`) al pasar a Checkout (D-06).
14. **Criterios de aceptación:**
    - Al recargar la página, el badge `.cart-count` y el contenido del drawer se hidratan automáticamente desde `localStorage`.
    - No duplica erróneamente ítems idénticos y separa ítems con diferentes complementos u observaciones.
    - Permanece 100% sincronizado con cambios realizados dentro del checkout.

---

## PUB-05: Reservas públicas

1. **Nombre:** Reservas públicas (`/reservas`).
2. **Objetivo:** Permitir a los clientes consultar disponibilidad real de mesas por fecha, hora y número de personas, y obtener confirmación automática de su reserva.
3. **Estado actual:** Pendiente (`CREAR` bajo el sistema visual oficial).
4. **Archivos existentes relacionados:** Ninguno en sitio público (referencia funcional en `js/admin.js` `L24`).
5. **Componentes reutilizables:** `.site-header`, `.site-footer`, `.checkout-form` (inputs y selects sobre `#e9dfcf` / `#faf6ee`), `.button-fire`, `.badge`, `.toast`.
6. **Distribución visual:**
   - Cabecera editorial oscura (`RESERVAS / ASEGURA TU MESA AL FUEGO`) seguida de contenedor principal en papel `#e9dfcf` dividido en 2 columnas en escritorio:
     - Izquierda: formulario paso a paso (Fecha, Número de personas, Zona preferida opcional, cuadrícula de horarios disponibles calculados automáticamente, Observaciones).
     - Derecha: tarjeta resumen de la reserva + políticas de duración del turno (D-02) y estado de confirmación automática.
7. **Información presentada:** Fecha elegida, cantidad de comensales, franjas horarias disponibles según mesas libres (D-01) y duración configurada (D-02), duración estimada del turno y resumen previo a confirmar.
8. **Acciones disponibles:** Seleccionar fecha, ajustar número de personas, elegir zona (si hay zonas configuradas), seleccionar franja horaria disponible, escribir observaciones y pulsar `CONFIRMAR RESERVA ↗`.
9. **Validaciones:**
   - **D-06:** Si el visitante no ha iniciado sesión, mostrar banner informativo y solicitar inicio de sesión/registro antes de confirmar (preservando la selección).
   - Fecha `>=` fecha actual en zona horaria `America/Bogota`; número de personas `>= 1` y `<=` capacidad máxima de una mesa disponible; horario dentro de la jornada laboral configurada; sin solapamiento con reservas existentes en la mesa asignada.
10. **Estados de carga, vacío y error:**
    - *Carga:* Indicador *"Consultando mesas disponibles..."* al cambiar fecha o personas.
    - *Vacío:* Si no hay horarios libres para esa fecha/personas, mostrar mensaje claro (*"No hay mesas disponibles para esa fecha y grupo. Prueba otro horario o día."*).
    - *Error:* Si la última mesa compatible se ocupó justo antes de confirmar, informar conflicto y refrescar horarios disponibles.
11. **Comportamiento responsive:** 2 columnas en escritorio; 1 columna apilada en tablet/móvil (`<= 800px`), con grilla de horarios en botones táctiles de mínimo `44px` de alto.
12. **Navegación de entrada y salida:** Entrada desde header (`Reservas`) o botón CTA en Landing. Salida hacia `CLI-01` (si falta login) o hacia `CLI-08` (`Mis reservas`) tras recibir la confirmación automática con código `RS-...`.
13. **Permisos requeridos:** Consulta visual pública; creación y confirmación requieren sesión activa (D-06).
14. **Criterios de aceptación:**
    - Solo muestra horarios con mesas realmente libres según inventario (D-01) y duración (D-02).
    - Al confirmar, crea la reserva automáticamente en estado `Confirmada` con mesa asignada y sin solapamientos.
    - Exige inicio de sesión antes de registrar la reserva (D-06).

---

## PUB-06: Contacto y canales de atención

1. **Nombre:** Sección de Contacto (`/contacto` / `#contacto`).
2. **Objetivo:** Mostrar la información real de ubicación, horarios y canales directos del restaurante, y recibir consultas de los visitantes.
3. **Estado actual:** Visual (`MEJORAR` conectando a Configuración real).
4. **Archivos existentes relacionados:** `index.html` (`L75`, `L80`), `css/styles.css` (`L1`, `.contact-section`, `.floating-whatsapp`), `js/app.js` (`L1-L7`, `L60-L62`, `L68-L69`).
5. **Componentes reutilizables:** `.contact-section`, `.contact-row`, `.contact-form`, `.social-links`, `.floating-whatsapp`.
6. **Distribución visual:** Sección oscura `#2b211a` en 2 columnas (`1fr .75fr`) con asterisco decorativo `✳` de marca de agua: izquierda con titular y CTA `ARMAR MI PEDIDO`; derecha con filas de Visítanos, Horario, Escríbenos, formulario de consulta y enlaces sociales (`IG`, `FB`, `WHATSAPP`), más botón flotante de WhatsApp en esquina inferior derecha.
7. **Información presentada:** Dirección real, horarios de atención, teléfono, enlaces a Instagram, Facebook y WhatsApp leídos desde la Configuración del restaurante (`ADM-12`).
8. **Acciones disponibles:** Abrir WhatsApp con mensaje prellenado, abrir redes sociales en nueva pestaña, enviar consulta por formulario, navegar al menú.
9. **Validaciones:** Nombre mínimo 2 caracteres, correo electrónico con formato válido y campo de mensaje/consulta si se habilita envío real.
10. **Estados de carga, vacío y error:**
    - *Carga:* Botón de envío deshabilitado mientras se procesa la consulta.
    - *Vacío:* Si una red social o WhatsApp no está configurada en `ADM-12`, ocultar ese enlace en lugar de mostrar un link roto hacia `#contacto`.
    - *Error:* Feedback accesible en `.form-feedback` (`aria-live="polite"`).
11. **Comportamiento responsive:** 2 columnas en escritorio; 1 columna en móvil (`<= 700px`) con botón flotante reducido a `44px × 44px`.
12. **Navegación de entrada y salida:** Entrada desde header (`Contacto`) o scroll en Landing. Salida hacia `#menu` o canales externos (`target="_blank" rel="noopener noreferrer"`).
13. **Permisos requeridos:** Acceso público.
14. **Criterios de aceptación:**
    - Todos los datos de contacto y enlaces provienen de la Configuración del restaurante (no constantes de demo).
    - No existen enlaces muertos apuntando a `#contacto`.
    - El formulario deja de mostrar el aviso *"Formulario de demostración"* cuando esté conectado (o se decide explícitamente su retiro/conexión).
