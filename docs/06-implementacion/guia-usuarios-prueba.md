# Guía de Usuarios de Prueba y Validación Multirol
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

> **Política de seguridad:** Este documento está versionado en Git y **NO contiene contraseñas ni claves privadas**. Las contraseñas generadas localmente para las cuentas de prueba se almacenan exclusivamente en el archivo local ignorado por Git `.tmp/forja-brava-cuentas-prueba.local.md` (y su homólogo estructurado `.tmp/test-accounts.local.json`).

---

## 1. Cuentas oficiales de prueba local

| Rol en `public.roles` | Correo de prueba | Nombre sugerido | Panel inicial tras login |
| :--- | :--- | :--- | :--- |
| `cliente` | `cliente@forjabrava.com` | Valentina Gómez (Prueba) | `/cliente` |
| `mesero` | `mesero@forjabrava.com` | Mateo Ríos (Prueba) | `/mesero` |
| `administrador` | `admin@forjabrava.com` | Camila Herrera (Prueba) | `/admin` |

> **Importante:** Al registrarse en Supabase Auth, el trigger `on_auth_user_created` (`public.handle_new_auth_user()`) crea automáticamente el perfil en `public.profiles` con el rol fijo **`cliente`** e `is_active = true`. El trigger `trg_protect_profile_privileged_fields` impide que un usuario no administrador altere `role_id` o `is_active`. Por ello, la promoción a `mesero` y `administrador` debe realizarse exclusivamente mediante privilegios administrativos en Supabase (Dashboard/SQL Editor o script local CLI con `SUPABASE_SERVICE_ROLE_KEY`).

---

## 2. Cómo iniciar el entorno local

1. Verifica que existan las variables públicas en tu `.env` local (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, siguiendo `.env.example`). **Nunca** agregues `SUPABASE_SERVICE_ROLE_KEY` con prefijo `VITE_` ni al navegador.
2. Instala dependencias si aún no lo has hecho e inicia el servidor de desarrollo Vite:

```powershell
npm install
npm run dev
```

3. Abre la URL local reportada por Vite (por defecto `http://localhost:5173`).

---

## 3. Cómo crear las tres cuentas de prueba de forma segura

Existen dos procedimientos equivalentes. Ninguno expone `service_role` al navegador ni modifica usuarios reales existentes.

### Opción A — Script local de administración CLI (recomendado tras autorizar entorno)

El repositorio incluye el script local [scripts/setup-test-accounts.mjs](../../scripts/setup-test-accounts.mjs), que lee únicamente las credenciales desde `.tmp/test-accounts.local.json` (ignorado por Git) y las credenciales de administración desde variables de entorno temporales de tu terminal (sin imprimir nunca contraseñas ni llaves en logs):

```powershell
# 1. Definir variables únicamente en la sesión actual de terminal (NO en .env del frontend)
$env:SUPABASE_URL = "https://<tu-proyecto>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<tu-service-role-key>"

# 2. (Opcional) Verificar el plan sin escribir en Supabase
node scripts/setup-test-accounts.mjs --dry-run

# 3. Crear o sincronizar las 3 cuentas y asignar sus roles exactos en public.profiles
node scripts/setup-test-accounts.mjs

# 4. Limpiar la variable sensible de la sesión de terminal al finalizar
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

### Opción B — Procedimiento manual desde Supabase Dashboard + SQL Editor

1. En **Supabase Dashboard → Authentication → Users → Add user → Create new user**, crea los tres correos con la casilla **Auto Confirm User** activada y usando las contraseñas distintas registradas en `.tmp/forja-brava-cuentas-prueba.local.md`:
   - `cliente@forjabrava.com`
   - `mesero@forjabrava.com`
   - `admin@forjabrava.com`
2. El trigger `on_auth_user_created` creará automáticamente los 3 perfiles en `public.profiles` con rol `cliente`.
3. En **Supabase Dashboard → SQL Editor**, ejecuta el siguiente bloque idempotente para promover únicamente las dos cuentas operativas de prueba y verificar el resultado:

```sql
UPDATE public.profiles
SET
  role_id = (SELECT id FROM public.roles WHERE code = 'mesero'),
  full_name = 'Mateo Ríos (Prueba)',
  is_active = true
WHERE lower(email) = 'mesero@forjabrava.com';

UPDATE public.profiles
SET
  role_id = (SELECT id FROM public.roles WHERE code = 'administrador'),
  full_name = 'Camila Herrera (Prueba)',
  is_active = true
WHERE lower(email) = 'admin@forjabrava.com';

UPDATE public.profiles
SET
  role_id = (SELECT id FROM public.roles WHERE code = 'cliente'),
  full_name = 'Valentina Gómez (Prueba)',
  is_active = true
WHERE lower(email) = 'cliente@forjabrava.com';

-- Verificación de asignación
SELECT p.email, p.full_name, r.code AS role_code, p.is_active
FROM public.profiles p
JOIN public.roles r ON r.id = p.role_id
WHERE lower(p.email) IN (
  'cliente@forjabrava.com',
  'mesero@forjabrava.com',
  'admin@forjabrava.com'
)
ORDER BY r.code;
```

---

## 4. Rutas reales de la aplicación (`src/routes/AppRouter.jsx`)

### 4.1 Sitio público y autenticación (sin sesión obligatoria)
- `/` — Inicio de FORJA BRAVA.
- `/menu` y `/menu/:category` — Catálogo dinámico y filtros por categoría.
- `/producto/:slug` — Detalle de producto y selección de complementos.
- `/carrito` — Carrito temporal persistido localmente.
- `/login` — Inicio de sesión (solo invitados; redirige según rol si ya existe sesión).
- `/registro` — Registro de nuevos clientes (solo invitados; asigna rol `cliente` en BD).
- `/recuperar-contrasena` — Solicitud de enlace de recuperación.
- `/actualizar-contrasena` — Restablecimiento de contraseña mediante enlace de recuperación.
- `/acceso-denegado` — Pantalla explícita de permisos insuficientes (`403`).

### 4.2 Panel del cliente (exclusivo rol `cliente`)
- `/checkout` — Finalización de pedido (`domicilio` / `recoger`) con pagos simulados.
- `/cliente` — Dashboard del cliente.
- `/cliente/perfil` — Edición de datos básicos propios (`full_name`, `phone`).
- `/cliente/direcciones` — Libreta de direcciones de entrega.
- `/cliente/nuevo-pedido` — Redirección directa a `/menu`.
- `/cliente/pedidos` y `/cliente/pedidos/:id` — Listado y detalle de pedidos propios.
- `/cliente/seguimiento` y `/cliente/seguimiento/:id` — Seguimiento en tiempo real.
- `/cliente/historial` — Historial filtrable en zona `America/Bogota`.
- `/cliente/reservas` y `/cliente/reservas/:id` — Consulta de disponibilidad y gestión de reservas propias.

### 4.3 Panel del mesero (exclusivo rol `mesero`)
- `/mesero` — Dashboard operativo del salón.
- `/mesero/mesas` — Mapa de mesas en vivo con responsable operativo.
- `/mesero/mesas/:id` — Detalle de mesa, cuenta acumulada (`D-04`) y solicitud de cierre.
- `/mesero/comandas/nueva` (alias `/mesero/nuevo-pedido`) — Toma de comandas en mesa con complementos y observaciones.
- `/mesero/pedidos` — Pedidos de salón con transiciones permitidas (`D-05`).
- `/mesero/cuentas` — Cuentas acumuladas activas y solicitud de cierre hacia Caja.
- `/mesero/historial` — Historial de pedidos de salón.

### 4.4 Panel administrativo (exclusivo rol `administrador`)
- `/admin` — Dashboard administrativo con KPIs reales.
- `/admin/mesas` y `/admin/mesas/:id` — Gestión dinámica de mesas (`D-01`).
- `/admin/reservas` y `/admin/reservas/:id` — Administración y calendario de reservas.
- `/admin/configuracion`, `/admin/configuracion/horarios`, `/admin/configuracion/reservas` — Horarios, duración de reservas (`D-02`) y tarifa fija de domicilio (`D-03`).
- `/admin/pedidos` — Gestión de estados de pedidos y reembolsos de pedidos cancelados pagados (`refund_order_payment`).
- `/admin/productos`, `/admin/productos/nuevo`, `/admin/productos/:id` — Gestión atómica de catálogo y complementos (`admin_save_product`).
- `/admin/categorias` — Gestión de categorías.
- `/admin/clientes` — Directorio filtrado de clientes.
- `/admin/usuarios` — Gestión de usuarios, activación y asignación de roles (`admin_update_user_account`).
- `/admin/roles` — Matriz de roles y permisos.
- `/admin/auditoria` — Bitácora inmutable `audit_logs`.

### 4.5 Caja y Reportes (exclusivo rol `administrador`)
- `/admin/caja`, `/admin/caja/apertura`, `/admin/caja/pagos` — Apertura de turno único, cobro consolidado de cuentas de mesa (`D-04`) y cobro de pedidos individuales con validación de efectivo recibido.
- `/admin/caja/arqueos` — Arqueo físico separado de pagos digitales y cierre auditable.
- `/admin/caja/cierres` — Historial de sesiones cerradas.
- `/admin/caja/movimientos` (alias `/admin/movimientos`) — Ingresos y egresos manuales inmutables.
- `/admin/reportes` — Reportes agregados en PostgreSQL (`get_admin_reports_summary`) con los 7 filtros, paginación y exportación CSV/PDF.

---

## 5. Cómo iniciar sesión, probar funcionalidades y verificar permisos

1. Abre `/login`, ingresa el correo de prueba y su contraseña desde `.tmp/forja-brava-cuentas-prueba.local.md`, y pulsa **INICIAR SESIÓN**.
2. Comprueba la redirección automática y el alcance permitido por rol:

### Checklist para `cliente@forjabrava.com` (`cliente`)
- **Permisos efectivos:** `orders.create`, `orders.read_own`, `reservations.create` y gestión del propio perfil/direcciones.
- **Funcionalidades a probar:** navegar `/menu`, añadir plato con complementos al carrito, completar `/checkout` (domicilio o recoger), verificar seguimiento en `/cliente/seguimiento`, consultar `/cliente/historial` y crear/cancelar una reserva en `/cliente/reservas`.
- **Accesos que DEBEN bloquearse (`/acceso-denegado`):** `/mesero`, `/mesero/mesas`, `/admin`, `/admin/caja`, `/admin/reportes`, `/admin/usuarios`.

### Checklist para `mesero@forjabrava.com` (`mesero`)
- **Permisos efectivos:** `tables.read`, `orders.create` (solo mesa), `orders.deliver_table` (`Listo` → `Entregado`), `orders.cancel_pending_table` (`Pendiente` → `Cancelado`) y `table_accounts.request_close`.
- **Funcionalidades a probar:** revisar `/mesero/mesas`, registrar dos comandas sobre la misma mesa en `/mesero/comandas/nueva` (verificando única cuenta acumulada `D-04`), consultar `/mesero/cuentas` y solicitar cierre de cuenta hacia Caja.
- **Accesos que DEBEN bloquearse (`/acceso-denegado`):** `/cliente`, `/checkout`, `/admin`, `/admin/caja`, `/admin/reportes`, `/admin/usuarios`, `/admin/productos`, `/admin/auditoria`. En BD tampoco puede cobrar cuentas, abrir caja ni cambiar estados de cocina (`Confirmado`, `En preparación`, `Listo`).

### Checklist para `admin@forjabrava.com` (`administrador`)
- **Permisos efectivos:** los 18 permisos del catálogo (`catalog.manage`, `orders.manage_preparation`, `payments.confirm`, `payments.refund`, `table_accounts.settle`, `cash.manage`, `reports.read`, `users.manage`, `tables.manage`, `reservations.manage`, `settings.manage`, `audit.read`).
- **Funcionalidades a probar:** abrir turno en `/admin/caja`, cobrar una cuenta de mesa con cierre solicitado probando validación de efectivo insuficiente vs cambio válido, registrar un movimiento manual en `/admin/movimientos`, avanzar y reembolsar un pedido cancelado en `/admin/pedidos`, crear/editar un producto con complementos en `/admin/productos`, consultar los 7 filtros y exportar CSV en `/admin/reportes`, y verificar trazabilidad en `/admin/auditoria`.
- **Accesos que DEBEN bloquearse (`/acceso-denegado`):** `/cliente`, `/checkout` y `/mesero` (separación estricta de áreas por rol en el router).

---

## 6. Cómo cerrar sesión y cambiar de usuario

1. Desde el menú de usuario en la cabecera de cualquier panel (`/cliente`, `/mesero` o `/admin`), haz clic en **Cerrar sesión**.
2. El sistema invoca `supabase.auth.signOut()`, limpia todo el estado privado en memoria (`AuthContext`) y permite iniciar sesión inmediatamente con otro rol en `/login` sin residuos de la sesión anterior.
3. Para probar sesiones simultáneas de dos roles al mismo tiempo (por ejemplo, Mesero enviando solicitud de cierre y Administrador cobrando en Caja en vivo), utiliza una ventana normal y una ventana de incógnito (o perfiles separados del navegador).

---

## 7. Cómo restablecer las cuentas de prueba

- **Con el script local CLI (restablece contraseñas desde `.tmp/test-accounts.local.json`, reactiva perfiles y reafirma los 3 roles sin tocar usuarios reales):**

```powershell
$env:SUPABASE_URL = "https://<tu-proyecto>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<tu-service-role-key>"
node scripts/setup-test-accounts.mjs --reset
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

- **Manualmente en Supabase Dashboard:**
  1. En **Authentication → Users**, busca el correo de prueba y actualiza su contraseña (o vuelve a generar `.tmp/forja-brava-cuentas-prueba.local.md` si deseas rotar contraseñas).
  2. En **SQL Editor**, ejecuta nuevamente el bloque `UPDATE public.profiles ...` de la sección 3 (Opción B) para restaurar `role_id` e `is_active = true`.
