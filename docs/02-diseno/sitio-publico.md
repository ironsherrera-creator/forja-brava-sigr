# Especificación UI/UX — Sitio Público
## FORJA BRAVA — SIGR

Especificación integral de las pantallas públicas del restaurante conservando la estética editorial existente (`index.html`, `css/styles.css`) y cubriendo las 18 dimensiones obligatorias por pantalla.

---

## 1. Inicio (Landing comercial)

1. **Nombre:** Inicio (`/`).
2. **Objetivo:** Presentar la marca FORJA BRAVA, destacar su carta y dirigir visitantes hacia Menú, Reservas y Cuenta.
3. **Perfil autorizado:** Público (visitantes y usuarios autenticados).
4. **Estado actual:** Implementado y funcional (`CONSERVAR` / `MEJORAR` conexiones dinámicas).
5. **Archivo o componente existente relacionado:** `index.html` (`L17-L78`), `css/styles.css` (`L1-L5`), `js/app.js` (`L1-L7`, `L60-L67`).
6. **Elementos que se reutilizan:** `PublicHeader`, `BrandLogo`, `.hero`, `.ticker`, `.essence`, `.feature`, `.experience`, `.site-footer`, `.reveal`.
7. **Distribución visual:**
```text
[ Header fijo: FB | Inicio · Esencia · Menú · Reservas · Contacto | PEDIDO (n) | MI CUENTA | HACER PEDIDO ↗ ]
[ Hero Editorial (#171613): Titular Playfair + CTA Explorar Menú + Sello circular "Hecho a fuego" ]
[ Cinta animada (#c66a32): PREPARADO AL MOMENTO ✳ SABOR SIN ATAJOS ✳ HECHO A FUEGO ]
[ 01 / Nuestra Esencia (#e9dfcf): 3 columnas (Título | Manifiesto | Fotografía) ]
[ 02 / La Carta (#171613): Filtros dinámicos + Cuadrícula de productos ]
[ Producto Protagonista (#302218): Datos dinámicos del producto destacado + Sumar al pedido ]
[ 03 / Experiencia (#e9dfcf): Galería de 3 fotografías ]
[ 04 / Contacto (#2b211a): Información real + Formulario + Redes ]
[ Footer (#171613) ]
```
8. **Componentes de interfaz:** `PublicHeader`, `Button` (`fire`, `link`), `ProductCard`, `Drawer` (carrito), `ToastNotice`.
9. **Información que se muestra:** Eslogan, propuesta de valor, carta destacada, producto protagonista real, galería y datos reales del local.
10. **Acciones disponibles:** Navegar secciones, abrir menú móvil, abrir carrito, ir a reservas, ir a login/cuenta, sumar producto protagonista.
11. **Validaciones:** Verificar disponibilidad activa del producto protagonista antes de añadirlo al carrito.
12. **Estados de carga:** Estructura editorial inmediata; `SkeletonBlock` sobre precio/botón del producto destacado y grilla del menú mientras responden consultas.
13. **Estados vacíos:** Si no existe producto destacado configurado en `restaurant_settings`, se omite `#destacado` limpiamente.
14. **Mensajes de error:** Fallback automático de imagen local (`hero-forja-brava.png`) si falla una foto; aviso no bloqueante si falla la carga de datos.
15. **Mensajes de éxito:** Toast *"La Forjada se sumó a tu pedido"* al añadir el protagonista.
16. **Comportamiento responsive:** `> 1000px` layout completo; `<= 1000px` gutter `5vw`; `<= 700px` menú hamburguesa, Hero alineado abajo y bloques apilados.
17. **Navegación de entrada y salida:** Entrada por `/` o clic en logotipo. Salida hacia `/menu`, `/reservas`, `/contacto`, `/login` (o `/cliente`) y drawer de carrito.
18. **Criterios de aceptación:** Conserva intacta la estética actual; `#destacado` y `#contacto` se alimentan desde BD; respeta `prefers-reduced-motion`.

---

## 2. Menú digital y Categorías

1. **Nombre:** Menú digital (`/menu` y sección `#menu` en `/`).
2. **Objetivo:** Permitir explorar, buscar y filtrar productos por categorías activas y agregarlos al pedido.
3. **Perfil autorizado:** Público (libre sin login, D-06).
4. **Estado actual:** Implementado parcialmente (`MEJORAR`).
5. **Archivo o componente existente relacionado:** `index.html` (`L55-L61`), `js/app.js` (`L9-L51`, `L63`), `css/styles.css` (`L1`).
6. **Elementos que se reutilizan:** `CategoryFilterBar`, `ProductCard` (modo `public`), `money()`.
7. **Distribución visual:** Encabezado editorial (`02 / LA CARTA`) → Toolbar con pestañas de categorías dinámicas + campo de búsqueda + contador real (`X ANTOJOS · Y CATEGORÍAS`) → Cuadrícula de productos en 4 columnas.
8. **Componentes de interfaz:** `CategoryFilterBar`, input buscador, `ProductCard`, `SkeletonBlock`, `EmptyState`, `ToastNotice`.
9. **Información que se muestra:** Categorías ordenadas (`display_order`), conteo real, imagen WebP del producto, etiqueta (`.product-tag`), nombre, precio en `COP`, descripción corta y estado de disponibilidad.
10. **Acciones disponibles:** Filtrar por categoría, buscar por texto, abrir **Detalle de producto**, sumar producto directo (`SUMAR AL PEDIDO +`).
11. **Validaciones:** Productos con `is_available = false` no se pueden añadir al carrito. Las categorías inactivas no se muestran como filtro.
12. **Estados de carga:** 8 `SkeletonBlock` de tarjeta sobre `#2c2924`.
13. **Estados vacíos:** `EmptyState` (*"No encontramos antojos para tu búsqueda"*) con botón `VER TODA LA CARTA`.
14. **Mensajes de error:** Banner de error con botón `REINTENTAR` si falla la lectura de Supabase.
15. **Mensajes de éxito:** Toast confirmando cada producto añadido al carrito.
16. **Comportamiento responsive:** 4 columnas en escritorio, 3 en tablet (`<= 1000px`), 2 en móvil (`<= 700px`) con filtros `flex-wrap`.
17. **Navegación de entrada y salida:** Entrada desde header (`Menú`) o Hero. Salida hacia Modal de Detalle de Producto o Drawer de Carrito.
18. **Criterios de aceptación:** Cero categorías ni contadores quemados en HTML; búsqueda + filtro combinados en tiempo real.

---

## 3. Detalle de producto

1. **Nombre:** Detalle de producto (Modal / Drawer sobre carta).
2. **Objetivo:** Presentar ficha completa del producto, permitir elegir complementos explícitos, cantidad y observaciones antes de sumarlo al carrito.
3. **Perfil autorizado:** Público.
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno (se construye sobre el patrón de `.checkout-shell` en `css/styles.css` `L7`).
6. **Elementos que se reutilizan:** `ModalDialog` (`lg`), `QuantityStepper`, `Button` (`fire`), `StatusBadge`, `money()`.
7. **Distribución visual:** Modal centrado en `#e9dfcf` con 2 columnas en escritorio (imagen ampliada + tag a la izquierda; nombre, descripción, ingredientes, lista de complementos marcables, textarea de observaciones y pie con `QuantityStepper` + botón de total a la derecha).
8. **Componentes de interfaz:** `ModalDialog`, checkboxes de complementos, textarea, `QuantityStepper`, `Button`.
9. **Información que se muestra:** Fotografía ampliada, categoría, etiqueta, nombre, descripción, ingredientes, complementos disponibles con su precio individual y total calculado en vivo.
10. **Acciones disponibles:** Seleccionar/deseleccionar complementos, ajustar cantidad (`>= 1`), escribir observaciones, confirmar agregado y cerrar (`×`, backdrop, `Escape`).
11. **Validaciones:** Cantidad entera `>= 1`; observaciones `<= 200` caracteres; solo complementos explícitamente habilitados (`is_addon = true` y activos).
12. **Estados de carga:** Skeleton ligero al consultar complementos asociados si se cargan bajo demanda.
13. **Estados vacíos:** Si el producto no tiene complementos configurados, se omite esa sección sin mensaje de error.
14. **Mensajes de error:** Aviso inline si el producto dejó de estar disponible; botón de agregar deshabilitado.
15. **Mensajes de éxito:** Toast *"Agregado al pedido ([cantidad] × [nombre])"* y cierre automático del modal.
16. **Comportamiento responsive:** 2 columnas en escritorio; 1 columna con scroll vertical en móvil (`<= 700px`).
17. **Navegación de entrada y salida:** Entrada desde clic en tarjeta de producto (`Menú`). Salida al cerrar o confirmar agregado hacia `Menú` / `Carrito`.
18. **Criterios de aceptación:** Total actualizado en tiempo real; complementos nunca inferidos por regex; accesible con teclado (`Escape` y foco).

---

## 4. Carrito lateral

1. **Nombre:** Carrito lateral (`EL PEDIDO`).
2. **Objetivo:** Permitir revisar, ajustar cantidades y validar el pedido antes de pasar al checkout.
3. **Perfil autorizado:** Público para gestionar ítems; autenticado para continuar a Checkout (D-06).
4. **Estado actual:** Implementado parcialmente (`MEJORAR` + `REUTILIZAR`).
5. **Archivo o componente existente relacionado:** `index.html` (`L81`), `js/app.js` (`L45`, `L53-L56`, `L64`, `L88`).
6. **Elementos que se reutilizan:** `Drawer`, `QuantityStepper`, `EmptyState`, `Button` (`fire`), `money()`.
7. **Distribución visual:** Drawer derecho (`min(440px, 100%)`) en papel `#e9dfcf` con cabecera fija, lista desplazable de líneas y resumen inferior fijo.
8. **Componentes de interfaz:** `Drawer`, `QuantityStepper`, `Button`, `EmptyState`, `StatusBadge`.
9. **Información que se muestra:** Ítems, complementos seleccionados, observaciones, precio unitario, subtotal por línea, subtotal general, nota sobre tarifa fija de domicilio (cuando aplique) y total estimado.
10. **Acciones disponibles:** Incrementar/decrementar cantidad, eliminar ítem, cerrar drawer, navegar al menú (si vacío) e `IR AL CHECKOUT ↗`.
11. **Validaciones:** Deshabilitar checkout si `items.length === 0`; validar disponibilidad contra catálogo real; verificar sesión activa (D-06).
12. **Estados de carga:** Estado *"Verificando disponibilidad..."* breve al pulsar `IR AL CHECKOUT`.
13. **Estados vacíos:** `.cart-empty` con mensaje editorial y botón `MIRAR EL MENÚ ↗`.
14. **Mensajes de error:** Resaltado en `#a64225` si un producto guardado en `localStorage` ya no está disponible para que el usuario lo retire.
15. **Mensajes de éxito:** Feedback inmediato al actualizar cantidades y sincronización en `.cart-count`.
16. **Comportamiento responsive:** `440px` en escritorio/tablet; `100%` de ancho en móvil (`<= 700px`).
17. **Navegación de entrada y salida:** Entrada desde header o detalle de producto. Salida hacia `/checkout` (si autenticado) o `/login?redirect=/checkout` (si invitado, D-06).
18. **Criterios de aceptación:** Se hidrata correctamente desde `localStorage` al cargar la página (corrige bug actual de `js/app.js`); mantiene sincronización total con Checkout.

---

## 5. Reservas públicas

1. **Nombre:** Reservas públicas (`/reservas`).
2. **Objetivo:** Consultar disponibilidad real de mesas por fecha, hora y personas, y registrar reservas con confirmación automática.
3. **Perfil autorizado:** Consulta pública; confirmación requiere sesión autenticada (D-06).
4. **Estado actual:** Pendiente (`CREAR`).
5. **Archivo o componente existente relacionado:** Ninguno en sitio público (referencia en `js/admin.js` `L24`).
6. **Elementos que se reutilizan:** `PublicHeader`, `Button` (`fire`), `StatusBadge`, `Panel`, `ToastNotice`.
7. **Distribución visual:** Encabezado oscuro + contenedor `#e9dfcf` en 2 columnas: izquierda con selector de fecha, número de personas, zona opcional, grilla de franjas disponibles y observaciones; derecha con tarjeta resumen y política de duración de turno (D-02).
8. **Componentes de interfaz:** Inputs de fecha/personas, selector de zona, botones táctiles de franjas horarias, textarea, `Panel`, `Button`.
9. **Información que se muestra:** Horarios libres calculados según mesas activas (D-01) y duración configurada (D-02), zona, duración del turno y resumen previo.
10. **Acciones disponibles:** Cambiar fecha/personas/zona, elegir franja horaria, añadir observaciones, iniciar sesión (si invitado) y `CONFIRMAR RESERVA ↗`.
11. **Validaciones:** Fecha `>=` hoy (`America/Bogota`), personas `>= 1`, horario dentro de atención, mesa libre sin solapamiento, sesión obligatoria (D-06).
12. **Estados de carga:** *"Consultando disponibilidad..."* en la cuadrícula de horarios; botón deshabilitado durante confirmación.
13. **Estados vacíos:** *"No hay mesas disponibles para esa fecha y cantidad de personas. Intenta otro horario o día."*
14. **Mensajes de error:** Alerta clara si la última mesa se ocupó simultáneamente, refrescando franjas en pantalla.
15. **Mensajes de éxito:** Confirmación automática con código `RS-...`, fecha, hora, mesa asignada y enlace a `/cliente/reservas`.
16. **Comportamiento responsive:** 2 columnas en escritorio; 1 columna apilada en móvil con botones de horario `>= 44px`.
17. **Navegación de entrada y salida:** Entrada desde header (`Reservas`). Salida hacia `/login?redirect=/reservas` (si invitado) o `/cliente/reservas` al confirmar.
18. **Criterios de aceptación:** Jamás confirma una mesa con reserva solapada; respeta D-01, D-02 y D-06.

---

## 6. Contacto

1. **Nombre:** Contacto (`/contacto` / `#contacto`).
2. **Objetivo:** Brindar canales reales de atención y ubicación del restaurante.
3. **Perfil autorizado:** Público.
4. **Estado actual:** Solo visual (`MEJORAR`).
5. **Archivo o componente existente relacionado:** `index.html` (`L75`, `L80`), `js/app.js` (`L1-L7`, `L68-L69`).
6. **Elementos que se reutilizan:** `.contact-section`, `.contact-form`, `.floating-whatsapp`, `ToastNotice`.
7. **Distribución visual:** Sección oscura `#2b211a` en 2 columnas (`1fr .75fr`) con datos del local, formulario minimalista y enlaces sociales + botón flotante WhatsApp.
8. **Componentes de interfaz:** Inputs de borde inferior, `Button`, enlaces externos seguros (`noopener noreferrer`), `.floating-whatsapp`.
9. **Información que se muestra:** Dirección, horarios, teléfono, WhatsApp y redes leídos de `restaurant_settings`.
10. **Acciones disponibles:** Abrir WhatsApp, abrir redes sociales, enviar consulta (según decisión P-03) o navegar al menú.
11. **Validaciones:** Nombre `>= 2` caracteres, correo válido, mensaje obligatorio si el formulario persiste consultas.
12. **Estados de carga:** Botón de envío deshabilitado mientras procesa.
13. **Estados vacíos:** Ocultar enlaces sociales/WhatsApp que no estén configurados en `restaurant_settings`.
14. **Mensajes de error:** Retroalimentación accesible en `.form-feedback` (`aria-live="polite"`).
15. **Mensajes de éxito:** Confirmación clara de consulta enviada y limpieza del formulario.
16. **Comportamiento responsive:** 2 columnas en escritorio; 1 columna en móvil (`<= 700px`).
17. **Navegación de entrada y salida:** Entrada desde header o scroll. Salida hacia `#menu` o canales externos.
18. **Criterios de aceptación:** Elimina textos de "demostración" y enlaces rotos `#contacto` en redes sociales.

---

## 7. Inicio de sesión y Registro (Acceso público)

1. **Nombre:** Login (`/login`), Registro (`/registro`) y Recuperación (`/recuperar-contrasena`).
2. **Objetivo:** Permitir autenticación unificada para los 3 roles y registro seguro de nuevos clientes.
3. **Perfil autorizado:** Visitantes no autenticados (`GuestOnlyRoute`).
4. **Estado actual:** Implementado parcialmente en local (`MIGRAR / MEJORAR`).
5. **Archivo o componente existente relacionado:** `index.html` (`L82-L100`), `admin.html` (`L1`), `js/app.js` (`L70-L84`).
6. **Elementos que se reutilizan:** `.login-screen`, `.auth-card`, `.auth-tabs`, `.password-field`, `Button` (`fire`), `ToastNotice`.
7. **Distribución visual:** Tarjeta centrada en `#e9dfcf` (`min(480px, 100%)`) con logotipo `FB`, pestañas `INICIAR SESIÓN` / `REGISTRARME`, campos claros y CTA a ancho completo.
8. **Componentes de interfaz:** Inputs, toggle mostrar/ocultar contraseña, `Button`, mensajes inline.
9. **Información que se muestra:** Mensaje contextual cuando llega desde Checkout o Reservas (D-06), campos requeridos y enlace `¿Olvidaste tu contraseña?`.
10. **Acciones disponibles:** Iniciar sesión, registrarse como cliente, solicitar recuperación de contraseña, volver al inicio.
11. **Validaciones:** Zod en cliente + Supabase Auth en servidor (correo válido y único, nombre `>= 2`, teléfono `[+0-9 ()-]{7,24}`, contraseña `>= 8` con confirmación; rol fijo `cliente` en registro).
12. **Estados de carga:** Botón deshabilitado (*"INGRESANDO..."* / *"CREANDO CUENTA..."*).
13. **Estados vacíos:** Validación por campo si se intenta enviar vacío.
14. **Mensajes de error:** Mensajes claros y genéricos en `#9c4224` sin exponer trazas técnicas ni si un correo existe en login.
15. **Mensajes de éxito:** Toast de bienvenida y redirección inmediata según rol o `?redirect=`.
16. **Comportamiento responsive:** Centrado en escritorio; ancho `100%` con padding `24px` en móvil.
17. **Navegación de entrada y salida:** Entrada desde `MI CUENTA`, `/login`, `/registro` o compuerta D-06. Salida hacia `/cliente`, `/mesero`, `/admin` o destino previo.
18. **Criterios de aceptación:** Sin credenciales hardcodeadas; recuperación de contraseña funcional; preserva carrito al volver a Checkout.
