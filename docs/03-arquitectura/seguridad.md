# Arquitectura de Seguridad por Diseño
## FORJA BRAVA — SIGR

Documenta los controles de seguridad obligatorios para remediar las vulnerabilidades detectadas en la auditoría técnica QSTI (`SEC-01` a `SEC-07`) y proteger la operación productiva.

---

## 1. Controles obligatorios por vector de riesgo

| Vector / Riesgo | Estado actual (Auditado) | Control obligatorio en arquitectura objetivo |
|---|---|---|
| **Control de acceso y roles** | Credenciales admin en `admin.html` y bypass con `sessionStorage`. | Autenticación real con **Supabase Auth**, **RLS activado en el 100% de las tablas**, funciones `is_admin()`/`is_waiter()` en SQL y trigger que impide auto-escalamiento de rol en `profiles`. |
| **Integridad de precios y totales** | Precios leídos desde `localStorage` en `js/checkout.js`. | Cálculo exclusivo en servidor dentro de RPCs (`create_order`, `create_table_order`, `settle_table_account`). Cualquier precio enviado por el cliente es ignorado. |
| **XSS (Cross-Site Scripting)** | Interpolación sin escape en `innerHTML` (`app.js`, `checkout.js`). | Renderizado declarativo en **React (JSX)** con escape automático, regla ESLint prohibiendo `dangerouslySetInnerHTML`, eliminación de handlers inline (`onclick`, `onerror`) y cabecera `Content-Security-Policy`. |
| **Path Traversal** | Servidor local `node -e` en `package.json` (`L10`). | Eliminación del script artesanal y adopción de **Vite** (`server.fs.strict: true`) en desarrollo y **Vercel** en producción. |
| **Exposición de secretos** | Sin `.env` actual; riesgo futuro al integrar Supabase. | En el frontend **únicamente** se usan `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (seguras solo con RLS activo). La clave `SUPABASE_SERVICE_ROLE_KEY` **jamás** se expone en el cliente ni se commitea en Git; solo vive en secretos de Edge Functions / entorno servidor. |
| **Protección de PII (Datos personales)** | Nombres, teléfonos, direcciones y hashes en `localStorage`. | Almacenamiento exclusivo en PostgreSQL con cifrado en tránsito (HTTPS/TLS) y en reposo, acceso restringido por RLS al propietario o administrador. |
| **Duplicación y abuso en pedidos/reservas** | Sin protección contra doble clic ni carreras concurrentes. | Clave de idempotencia (`client_request_id`) en creación de pedidos y bloqueos transaccionales / restricción de exclusión en reservas. |
| **Contraseñas** | `PBKDF2` en navegador (`js/app.js` `L75`). | Delegado 100% a **Supabase Auth** (hashing seguro en servidor); nunca guardar contraseñas manualmente en tablas públicas. |
| **Auditoría de acciones críticas** | Inexistente. | Tabla `audit_logs` inmutable (`INSERT` vía triggers/RPCs, `SELECT` solo `admin`, `UPDATE`/`DELETE` denegados). |

---

## 2. Cabeceras HTTP de seguridad (Despliegue en Vercel)

En `vercel.json` se configurarán obligatoriamente:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HTTPS forzado).
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Content-Security-Policy`: restringida a origen propio, dominio del proyecto Supabase (HTTPS/WSS) y Google Fonts.

---

## 3. Seguridad en Storage y Dependencias

- **Supabase Storage (`product-images`):** Validar MIME types permitidos (`image/webp`, `image/png`, `image/jpeg`), límite máximo de tamaño (`2 MB`) y escritura exclusiva para rol `administrador`.
- **Pipeline CI/CD:** Bloquear despliegues si `npm audit --audit-level=high` reporta vulnerabilidades o si el escaneo de secretos detecta claves privadas o `service_role`.
