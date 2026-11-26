# Pruebas y Verificación de Seguridad — Etapa 3
## FORJA BRAVA — SIGR (Sistema Integral de Gestión de Restaurante)

**Fecha de ejecución:** 2026-11-24  
**Entorno de pruebas:** Windows · Node.js ESM · Vitest `5.1.1` (`jsdom` + Testing Library) · Playwright `1.65.1` (Chromium Headless contra build de producción `vite preview`) · Verificación no destructiva en vivo contra Supabase remoto.

> [!IMPORTANT]
> Este documento distingue de forma explícita entre **pruebas automatizadas con mocks controlados** (unitarias, integración y E2E de interfaz/enrutamiento) y **verificaciones reales de solo lectura ejecutadas contra el proyecto remoto de Supabase**, sin presentar simulaciones como pruebas remotas reales.

---

## 1. Resumen consolidado de pruebas implementadas

| Nivel | Archivo | Casos ejecutados | Resultado |
|---|---|---|---|
| **Estático / Calidad** | `eslint .` (`eslint.config.js`) | Repositorio `src/`, `tests/` y configs | **0 errores, 0 advertencias** |
| **Compilación Producción** | `vite build` | 208 módulos transformados (`dist/`) | **Exitoso (`796 ms`)** |
| **Unitarias (Zod)** | `tests/unit/authSchemas.test.js` | 11 pruebas | **11 / 11 aprobadas** |
| **Unitarias (Entorno, RBAC y Errores)** | `tests/unit/envAndRbac.test.js` | 11 pruebas | **11 / 11 aprobadas** |
| **Integración (Contexto y Guardas)** | `tests/integration/authContextAndGuards.test.jsx` | 7 pruebas | **7 / 7 aprobadas** |
| **E2E Navegador (Playwright Chromium)** | `tests/e2e/auth-security.spec.js` | 10 tests (cubriendo los 12 escenarios exigidos) | **10 / 10 aprobadas (`29.9 s`)** |
| **Verificación real en vivo (Supabase)** | Script Node ESM de solo lectura (sin mutaciones) | Tablas públicas/privadas (RLS/Grants) y RPCs | **Ejecutado (hallazgo SQL documentado y migración `07` generada)** |

---

## 2.Detalle de cobertura por suite

### 2.1. Pruebas unitarias (`Vitest`)
1. `tests/unit/authSchemas.test.js` (11 tests):
   - Normalización de correo electrónico (`trim` + minúsculas) y validación de formato en `loginSchema`, `registerSchema` y `forgotPasswordSchema`.
   - Política de contraseñas robustas (mínimo 8 caracteres, al menos una letra y al menos un número) y verificación de coincidencia `confirmPassword`.
   - Bloqueo mediante `.strict()` ante intentos de inyectar `role: 'administrador'`, `role_id` o `is_active: true` en login, registro público o actualización de perfil.
   - Teléfono opcional válido o vacío.
2. `tests/unit/envAndRbac.test.js` (11 tests):
   - Detección de ausencia o protocolo inválido en `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` sin exponer valores sensibles.
   - Prevención de Open Redirect en `getAuthRedirectUrl()` y `resolvePostAuthRedirect()` frente a `https://attacker.example`, `//attacker.example`, `/\attacker.example`, bucles `/login` y rutas no autorizadas para el rol (`/admin/caja` para `cliente`).
   - Separación estricta de capacidades entre `cliente`, `mesero` y `administrador`.
   - Traducción segura de errores técnicos de Supabase (`invalid_credentials`, `email_not_confirmed`, `over_email_send_rate_limit`, `otp_expired`) sin filtrar trazas internas.

### 2.2. Pruebas de integración (`Vitest` + `@testing-library/react`)
`tests/integration/authContextAndGuards.test.jsx` (7 tests con cliente Supabase simulado):
- Renderizado de `AuthLoading` mientras `getSession()` resuelve, garantizando que jamás se muestre contenido privado de forma transitoria, seguido de redirección a `/login?redirect=%2Fadmin` si no existe sesión.
- Acceso efectivo a `/admin` cuando PostgreSQL retorna perfil activo con rol `administrador`.
- Redirección a `/acceso-denegado` (`403`) cuando una sesión con rol `cliente` intenta navegar a `/admin` o `/mesero`.
- Cierre forzado de sesión (`signOut()` llamado automáticamente) y aviso de seguridad cuando `profiles.is_active === false`.
- Denegación por defecto y cierre de sesión cuando falla la consulta de perfil (`PROFILE_QUERY_ERROR`).
- Redirección automática en `GuestOnlyRoute` (`/login` -> `/mesero`) cuando ya existe sesión activa de `mesero`.
- Ciclo completo de inicio de sesión -> renderizado de perfil autenticado -> cierre de sesión y limpieza de estado privado.

### 2.3. Pruebas E2E en navegador real (`Playwright` + `Chromium` sobre `vite preview`)
`tests/e2e/auth-security.spec.js` (10 tests que cubren los 12 escenarios funcionales mediante interceptación determinista de red HTTP de Auth/PostgREST para no contaminar ni alterar datos reales de producción):
1. **Escenario 1:** Registro exitoso de cliente con aviso de confirmación de correo electrónico.
2. **Escenario 2:** Registro con datos inválidos y visualización de errores por campo.
3. **Escenarios 3, 7 y 8:** Inicio de sesión correcto hacia `/cliente`, persistencia de sesión tras recarga completa (`page.reload()`) y cierre de sesión efectivo con bloqueo posterior de `/cliente`.
4. **Escenario 4:** Inicio de sesión con credenciales incorrectas mostrando alerta segura en español.
5. **Escenario 5:** Solicitud de recuperación de contraseña con respuesta neutral contra enumeración de cuentas.
6. **Escenario 6:** Validación de enlace de recuperación (`?token_hash=...&type=recovery`) y actualización de contraseña.
7. **Escenario 9:** Bloqueo de `/cliente`, `/mesero` y `/admin` sin sesión activa, redirigiendo a `/login?redirect=...`.
8. **Escenario 10:** Bloqueo por rol insuficiente (`cliente` intentando abrir `/admin` y `/mesero` -> `/acceso-denegado` `403`).
9. **Escenario 11:** Bloqueo inmediato de cuenta con `is_active = false` al intentar iniciar sesión.
10. **Escenario 12:** Libre acceso a rutas públicas (`/`, `/login`, `/registro`) y neutralización de `/admin.html` heredado redirigiendo al flujo protegido de login.

---

## 3. Comandos ejecutados y resultados reales

```powershell
npm run lint
# Salida: 0 errores, 0 advertencias.

npm test
# Salida: Vitest v5.1.1 — 3 archivos aprobados, 29 / 29 tests aprobados (5.23 s).

npm run build
# Salida: Vite v8.3.8 — 208 módulos transformados, dist/ generado en 796 ms.

npm run test:e2e
# Salida: Playwright v1.65.1 (Chromium) — 10 / 10 tests aprobados (29.9 s).
```

Escaneo adicional de higiene sobre código estático:
```powershell
Select-String -Path .\admin.html, .\index.html, .\js\*.js, .\src\**\*.js, .\src\**\*.jsx -Pattern 'Admin123\*'
# Resultado: 0 coincidencias (CLEAN_NO_LEGACY_CRED).
```

---

## 4. Verificaciones reales no destructivas contra Supabase remoto

Utilizando la configuración pública existente en `.env` (sin exponer jamás URL ni clave en salida) se ejecutaron comprobaciones de solo lectura contra la instancia remota:

1. **Bloqueo de tablas privadas e internas para rol `anon`:**
   - Consultas `SELECT` anónimas sobre `profiles`, `orders`, `cash_sessions`, `audit_logs`, `permissions`, `role_permissions` y `roles` fueron rechazadas con código PostgreSQL `42501` (`0` filas expuestas).
2. **Protección de funciones internas y RPCs privilegiadas frente a `anon`:**
   - `rpc('log_audit_event', ...)`: **bloqueada** (`PGRST202`, función revocada y oculta del esquema expuesto a `anon`).
   - `rpc('open_cash_session', ...)`: **bloqueada** (`PGRST202`).
   - `rpc('create_order', ...)`: **bloqueada** (`42501 permission denied for function create_order`).
   - `rpc('current_user_role')`: **operativa**, retorna `null` para sesión anónima.
   - `rpc('get_available_reservation_slots', { p_date: '2026-12-15', p_party_size: 2 })`: **operativa** (`ok: true`, sin error SQL).
3. **Hallazgo crítico detectado en vivo (Privilegios `GRANT` de tabla en PostgREST):**
   - Las consultas directas de `anon` a `public.categories` devolvieron `42501: permission denied for table categories` con el hint de PostgreSQL: `Grant the required privileges to the current role with: GRANT SELECT ON public.categories TO anon;`.
   - **Causa raíz:** las migraciones `01..06` configuraron todas las políticas `CREATE POLICY` de RLS, pero no emitieron los `GRANT` explícitos de tabla para los roles `anon` y `authenticated` cuando el esquema se crea vía CLI. Sin dichos `GRANT`, tanto la lectura pública del catálogo como la consulta `profiles` + `roles` del usuario autenticado son rechazadas por PostgreSQL antes de evaluar RLS.

---

## 5. Errores detectados durante la etapa y correcciones aplicadas

1. **Reglas estrictas de React 19 Compiler en ESLint (`react-hooks/set-state-in-effect`, `react-hooks/preserve-manual-memoization`, `react-refresh/only-export-components`):**
   - *Corrección:* se separó `AuthContext` en `src/context/authContextInstance.js`, se derivó el estado inicial sin `setState` síncrono dentro de `useEffect`, se estabilizó `currentUserId` en `updateProfile` y se utilizó reinicio declarativo por `key` en `ClientProfileForm` (`ClientPlaceholderPage.jsx`), logrando `0` errores y `0` advertencias sin desactivar ninguna regla de ESLint.
2. **Nombre accesible en `AuthLoading.jsx`:**
   - *Corrección:* se añadió `aria-label={message}` al contenedor `role="status"` para mejorar la accesibilidad en lectores de pantalla y alinear las pruebas de integración.
3. **Ruta heredada `/admin.html` en servidor SPA (`vite preview`):**
   - *Corrección:* además de la redirección HTTP en `vercel.json` y la limpieza física de `admin.html`, se añadió `<Route path="/admin.html" element={<Navigate to="/admin" replace />} />` en `AppRouter.jsx` para redirigir cualquier acceso residual hacia el guardia de autenticación.
4. **Ausencia de `GRANT` de tabla en PostgreSQL para `anon` y `authenticated`:**
   - *Corrección:* respetando la prohibición de editar migraciones ya aplicadas o ejecutar `supabase db push` automáticamente, se creó la migración correctiva aditiva `supabase/migrations/20261124210007_least_privilege_table_grants.sql` lista para revisión y aplicación autorizada.

---

## 6. Pruebas pendientes y verificaciones manuales requeridas

1. **Aplicación autorizada de `20261124210007_least_privilege_table_grants.sql`:**
   - Una vez autorizada y aplicada mediante `npx supabase db push`, ejecutar verificación real de lectura pública de `categories`/`products` y lectura autenticada de `profiles` + `roles`.
2. **Pruebas reales autenticadas por rol (`cliente`, `mesero`, `administrador`) contra Supabase remoto:**
   - No se crearon cuentas ficticias ni se alteraron datos en el proyecto remoto para no contaminar `auth.users` ni activar envíos reales de correo sin autorización. Una vez aplicada la migración `07` y creadas tres cuentas de prueba controladas (1 `cliente`, 1 `mesero`, 1 `administrador`) en Supabase Dashboard, debe verificarse manualmente el login real de cada rol, el aislamiento cruzado de pedidos y la recepción real del correo de recuperación en `/actualizar-contrasena`.
3. **Verificación en Supabase Dashboard (Auth Settings):**
   - Confirmar las *Redirect URLs* permitidas (`/login` y `/actualizar-contrasena` para `localhost` y dominio Vercel) y plantillas de correo.

---

## 7. Riesgos residuales

1. **Bloqueo de PostgREST hasta aplicar la migración `07`:** mientras no se aplique `20261124210007_least_privilege_table_grants.sql` en el proyecto remoto, cualquier usuario que inicie sesión contra Supabase remoto recibirá denegación por defecto en `fetchAuthenticatedProfile` debido al error `42501` de permisos de tabla en PostgreSQL.
2. **Tamaño de imágenes PNG originales en el bundle estático:** Vite informa activos PNG de ~2.1–2.8 MB heredados de `assets/images` y un bundle JS de ~617 kB (por inclusión del SDK de Supabase y React Router). Se recomienda incorporar `React.lazy()` por área funcional y optimización WebP en las siguientes etapas.
3. **Archivos `.zip` temporales sin seguimiento en `supabase/`:** persisten archivos comprimidos locales de etapas previas como *untracked* en Git; se conservaron por precaución de no borrar recursos sin instrucción explícita, pero no deben incluirse cuando se realice el commit del proyecto.
