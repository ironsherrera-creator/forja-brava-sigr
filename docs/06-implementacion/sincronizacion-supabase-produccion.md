# Informe de Sincronización Completa con Supabase Remoto
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Fecha:** 25 de noviembre de 2026 (`America/Bogota`)  
**Proyecto Supabase:** `forja-brava-sigr` (`pyyfcqphmiusnqlrslgu`)  
**URL:** `https://pyyfcqphmiusnqlrslgu.supabase.co` · **Región:** `us-west-2` · **Motor:** PostgreSQL `17.12`  
**Dictamen final:** **`SINCRONIZACIÓN COMPLETA CON OBSERVACIONES`**

> **Seguridad:** Este informe no contiene contraseñas, tokens JWT ni claves privadas (`service_role`). Las credenciales locales de las cuentas de prueba permanecen exclusivamente en `.tmp/` (ignorado por Git).

---

## 1. Estado inicial del proyecto remoto (Preauditoría)

- **Identidad confirmada:** proyecto `pyyfcqphmiusnqlrslgu` (`ACTIVE_HEALTHY`, enlazado vía Supabase CLI `3.4.0`).
- **Migraciones previas aplicadas (`01`–`07`):** `20261123221001` a `20261124210007`, sin divergencias.
- **Datos previos:** estado limpio de semillas (`roles: 3`, `permissions: 18`, `categories: 4`, `products: 13`; `0` usuarios, `0` perfiles, `0` pedidos, `0` pagos, `0` reservas, `0` sesiones de caja).
- **Respaldo administrado:** `supabase backups list` reportó `backups: []` y `pitr_enabled: false` (limitación del plan gratuito). El propietario autorizó continuar explícitamente sin respaldo administrado tras verificar la ausencia de datos transaccionales.
- **Extensiones verificadas:** `pgcrypto 1.3` en esquema **`extensions`**, `btree_gist 1.7` en `public`, `uuid-ossp 1.1` en `extensions`, `supabase_vault 0.3.2` en `vault`.

---

## 2. Migraciones encontradas y aplicadas

Se aplicaron en orden estricto mediante `npx supabase db push --remote` (sin `--include-all`, sin reset y sin errores):

| Orden | Archivo de migración | Estado final en `schema_migrations` |
| :---: | :--- | :---: |
| 01–07 | `20261123221001` … `20261124210007` | Aplicadas previamente |
| 08 | `20261124230008_admin_reservations_and_schedule_rpcs.sql` | **Aplicada** |
| 09 | `20261124233009_post_audit_integrity_and_hardening.sql` | **Aplicada** |
| 10 | `20261125200010_waiter_closing_guard_and_admin_rpcs.sql` | **Aplicada** |
| 11 | `20261125213011_catalog_reports_staff_and_cash_hardening.sql` | **Aplicada** |

Total sincronizado en `supabase migration list --remote`: **`11/11` migraciones**.

---

## 3. Verificación de Base de Datos, RLS, Triggers y RPCs

Verificado en modo `--read-only` directamente sobre `pyyfcqphmiusnqlrslgu`:

- **Tablas públicas:** `19/19` tablas originales presentes.
- **Row Level Security (RLS):** `19/19` tablas con RLS habilitado (`public_tables_without_rls = 0`), `37` políticas activas en `public` y `63` índices.
- **Seguridad de funciones:** `0` funciones `SECURITY DEFINER` sin `search_path` (`secdef_without_search_path = 0`).
- **Triggers verificados (`19`):** incluyendo `trg_protect_profile_privileged_fields`, `trg_protect_restaurant_table_integrity`, `trg_block_orders_on_closing_account`, `trg_audit_products`, `trg_audit_categories`, `trg_audit_restaurant_settings`, `trg_audit_logs_immutable`, `trg_cash_movements_immutable`, `trg_cash_movements_require_open_session` y `trg_order_status_history_immutable`.
- **RPCs críticas verificadas (`SECURITY DEFINER`, `search_path = public, pg_temp`, `public_exec = false`, `anon_exec = false`, `authenticated_exec = true`, `0` sobrecargas duplicadas):**
  - `admin_save_product`
  - `get_admin_reports_summary`
  - `get_salon_staff_directory`
  - `admin_update_user_account`
  - `create_order` (con `pg_catalog.sha256` compatible con `pgcrypto` en `extensions`)
  - `refund_order_payment`
  - `confirm_order_payment` (con `p_received_amount`)
  - `settle_table_account` (con `p_received_amount`)
  - `admin_manage_reservation`
  - `admin_save_restaurant_table`

---

## 4. Cuentas de prueba creadas y asignación de roles

Creadas exclusivamente las 3 cuentas de la allowlist mediante **Supabase Auth Admin API** (`email_confirm = true`, sin tocar cuentas ajenas). Se verificó primero que el trigger `on_auth_user_created` asignó inicialmente el rol **`cliente`** a las tres cuentas y posteriormente se promovieron `mesero` y `administrador` por UUID exacto:

| Correo | UUID (`auth.users` = `public.profiles`) | Rol en `public.roles` | `is_active` |
| :--- | :--- | :--- | :---: |
| `admin@forjabrava.com` | `09091b68-badc-455e-8f7b-1f36030a1172` | `administrador` | `true` |
| `mesero@forjabrava.com` | `df83caf2-0bb2-423f-95b1-a9e6e6622207` | `mesero` | `true` |
| `cliente@forjabrava.com` | `f068f256-df25-4855-9aab-286bb2e1b8a4` | `cliente` | `true` |

---

## 5. Validación real de autenticación y autorización en Supabase remoto

Ejecutado contra `https://pyyfcqphmiusnqlrslgu.supabase.co` usando exclusivamente la clave pública `anon` (sin crear transacciones financieras reales):

| Rol probado | Login / Logout | Perfil / Rol en PostgreSQL | `get_admin_reports_summary` | `get_salon_staff_directory` | Escalamiento de rol / `open_cash_session` / `admin_update_user_account` | Subida a `product-images` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`cliente`** (`cliente@forjabrava.com`) | OK / OK | `cliente`, `is_active=true`, solo ve `1` perfil propio (`0` permisos/caja/auditoría) | **Bloqueado** (`FORBIDDEN_ROLE`) | **Bloqueado** (`FORBIDDEN_ROLE`) | **Bloqueados** (`FORBIDDEN_ROLE_CHANGE` / `FORBIDDEN_ROLE`) | **Bloqueada** (RLS Storage) |
| **`mesero`** (`mesero@forjabrava.com`) | OK / OK | `mesero`, `is_active=true`, solo ve `1` perfil propio (`0` permisos/caja/auditoría) | **Bloqueado** (`FORBIDDEN_ROLE`) | **Permitido** (`2` registros, `0` emails/teléfonos expuestos) | **Bloqueados** (`FORBIDDEN_ROLE_CHANGE` / `FORBIDDEN_ROLE`) | **Bloqueada** (RLS Storage) |
| **`administrador`** (`admin@forjabrava.com`) | OK / OK | `administrador`, `is_active=true`, ve `3` perfiles y `18` permisos | **Permitido** (`OK`) | **Permitido** (`2` registros, sin PII) | N/A (rol autorizado) | Lectura OK (escritura restringida a admin por política RLS) |

---

## 6. Estado de Supabase Auth, Correo y Storage

- **Supabase Auth (`/auth/v1/settings`):**
  - `disable_signup: false` (registro público habilitado, asignando siempre rol `cliente` por trigger).
  - `mailer_autoconfirm: false` (confirmación de correo activa para nuevos registros públicos).
  - `email_provider_enabled: true`, `phone_provider_enabled: false`.
- **Storage (`product-images`):**
  - Bucket `product-images` verificado (`public: true`, límite `2 MB` / `2097152` bytes, MIME `image/webp`, `image/png`, `image/jpeg`).
  - Lectura pública anónima (`anonReadOk: true`) y `4` políticas RLS activas; intentos de subida desde `cliente` y `mesero` rechazados por RLS.

---

## 7. Pruebas locales finales y evidencias

- **`npm run lint`:** `EXIT 0` (`0` errores, `0` advertencias).
- **`npm test` (Vitest + PGlite SQL):** `EXIT 0` (`17/17` suites, `85/85` pruebas aprobadas).
- **`npm run build`:** `EXIT 0` (compilación de producción limpia).
- **`npm run test:e2e` (Playwright):** `EXIT 0` (`25/25` pruebas E2E aprobadas, incluyendo guards de `/cliente`, `/mesero`, `/admin`, `/admin/caja`, `/admin/reportes`).
- **`npm audit --omit=dev`:** `EXIT 0` (`0` vulnerabilidades).

---

## 8. Problemas encontrados y configuraciones pendientes

1. **Observación operativa (`scripts/setup-test-accounts.mjs` y Migración 07):** debido al principio de privilegio mínimo aplicado en la Migración 07, el rol `service_role` no recibe `GRANT` directo sobre `public.roles` vía PostgREST; la provisión funcionó correctamente creando los usuarios vía **Auth Admin API** y ejecutando la promoción inicial controlada vía `supabase db query --remote` (equivalente a SQL Editor).
2. **SMTP personalizado y buzones reales `@forjabrava.com` (pendiente):** no se ha configurado un proveedor SMTP propio ni buzones reales para `@forjabrava.com`. Mientras se use el mailer integrado de Supabase, los correos de confirmación y recuperación de contraseña están sujetos a límites de envío y las direcciones `@forjabrava.com` requieren buzones/DNS reales si se desea probar entrega de correo real.
3. **URLs de redirección de producción (pendiente de despliegue):** al desplegar el frontend (ej. Vercel), configurar `Site URL` y `Additional Redirect URLs` en **Supabase Dashboard → Authentication → URL Configuration** apuntando al dominio definitivo (`/login`, `/actualizar-contrasena`).
4. **Respaldos administrados (pendiente de plan):** el proyecto se encuentra en plan gratuito (`backups: []`, `pitr_enabled: false`); antes de pasar a operación comercial real con clientes, habilitar respaldos diarios/PITR o respaldos automatizados periódicos con `pg_dump`.

---

## 9. Dictamen final

**`SINCRONIZACIÓN COMPLETA CON OBSERVACIONES`**

> La base de datos remota (`11/11` migraciones, `19/19` tablas con RLS, todas las RPC críticas y triggers), Storage (`product-images`), las tres cuentas oficiales de prueba (`admin@forjabrava.com`, `mesero@forjabrava.com`, `cliente@forjabrava.com`), la autenticación real y la matriz de autorización RLS/RPC quedaron completamente sincronizadas y verificadas en vivo contra `pyyfcqphmiusnqlrslgu`. Las únicas configuraciones pendientes corresponden a SMTP/buzones reales, URLs de redirección tras el futuro despliegue y estrategia de respaldos de producción.
