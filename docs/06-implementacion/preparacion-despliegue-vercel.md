# Preparación de despliegue en Vercel

Estado: preparación local. No implica conexión, despliegue ni cambios en servicios remotos.

## Configuración del proyecto Vercel

Al conectar el repositorio `ironsherrera-creator/forja-brava-sigr`, seleccionar:

| Opción | Valor |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `.` (raíz del repositorio) |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

El repositorio contiene `package-lock.json` (lockfile versión 3), así que `npm ci` instala las versiones fijadas. Si se actualizan dependencias, actualizar y revisar juntos `package.json` y `package-lock.json` antes de integrar esos cambios.

La raíz incluye `vercel.json` con el preset Vite, comandos de instalación/compilación y salida. No se requieren funciones Vercel para la aplicación actual. El redirect permanente de `/admin.html` a `/admin` conserva la ruta antigua. El rewrite SPA envía las rutas de React Router a `/index.html`; Vercel da precedencia al sistema de archivos, por lo que los archivos estáticos existentes se sirven directamente. Mantener el rewrite al final si se agregan reglas, y revisar cualquier futura ruta `/api` o función serverless para evitar solapamientos. Referencias: [configuración `vercel.json`](https://vercel.com/docs/project-configuration/vercel-json) y [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## Variables de entorno

Configurar para Production, Preview y Development (según los proyectos y datos que correspondan):

| Nombre | Requerida | Uso |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Sí para las funciones conectadas a Supabase | URL HTTPS del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sí para las funciones conectadas a Supabase | Clave pública/publishable (anon) de Supabase |
| `VITE_APP_NAME` | No | Nombre visible; tiene valor predeterminado en el código |
| `VITE_APP_TIMEZONE` | No | Zona horaria; valor predeterminado `America/Bogota` |

El código consume específicamente `VITE_SUPABASE_ANON_KEY`; no usa un alias alternativo. Las variables `VITE_*` quedan incluidas en el bundle del navegador: solo se permite allí información pública. Nunca configurar `service_role`, contraseñas, tokens privados ni credenciales administrativas con prefijo `VITE_`. La clave anon/publishable requiere políticas RLS correctas en Supabase.

El archivo `.env` local no forma parte de esta preparación; no copiar sus valores a documentación o al repositorio. Añadir los valores directamente en la interfaz de variables de Vercel cuando el propietario cree/conecte el proyecto. `.env.example` enumera nombres sin credenciales.

## Supabase: preparar URLs para el dominio

Cuando se defina el dominio definitivo (por ejemplo, `https://<dominio-produccion>`), actualizar manualmente en Supabase Authentication → URL Configuration:

1. **Site URL:** origen canónico de producción, sin una ruta de página; elegir si se usará `www` o el dominio raíz y redirigir el otro.
2. **Additional Redirect URLs:** añadir el origen de producción y las rutas de callback necesarias. Autorizar los dominios de preview solo si el flujo de trabajo los necesita; preferir patrones acotados al proyecto/branch en vez de comodines amplios.
3. **Confirmación de correo:** establecer el enlace de retorno y plantilla para la ruta que procesa confirmaciones. Verificar la ruta real del flujo antes de habilitar el correo en producción.
4. **Recuperación/actualización de contraseña:** permitir la ruta `/actualizar-contrasena` en el origen de producción; el enlace de recuperación debe devolver allí y conservar los parámetros/tokens que Supabase agrega.
5. **Login y registro:** los enlaces OAuth, si se habilitan, deben usar el callback de producción permitido y también registrar la URL de callback de Supabase que el proveedor exige.
6. **Dominios autorizados:** registrar el host de producción en la configuración de autenticación/proveedor que lo requiera y en cada proveedor OAuth. Comprobar HTTPS, dominio raíz y `www` según la estrategia elegida.

El cliente construye retornos internos usando el origen actual del navegador. Por ello los flujos deben probarse en el host de producción y los orígenes de preview que efectivamente se autoricen. No se ha cambiado ninguna configuración remota de Supabase.

## Dominio y conexión GitHub

1. Revisar y decidir qué cambios locales se integrarán; confirmar que el commit a desplegar contiene el frontend y la configuración documentados.
2. En Vercel, el propietario conecta su cuenta GitHub y autoriza el repositorio `ironsherrera-creator/forja-brava-sigr`.
3. Seleccionar la rama principal (`main`) para Production y verificar el Root Directory y comandos indicados arriba.
4. Cargar las variables del entorno correspondiente antes del primer despliegue. Preview debe usar un backend/datos apropiados y callbacks autorizados.
5. Revisar el dominio asignado por Vercel; agregar el dominio propio, configurar DNS según las instrucciones vigentes de Vercel y esperar la validación TLS antes de anunciarlo.
6. Solo después de revisar el resultado, autorizar el primer despliegue y promover la versión prevista.

No se ha conectado GitHub a Vercel ni se ha iniciado un despliegue.

## Verificaciones previas a producción

- `npm run lint`, `npm test`, `npm run build` y `npm run test:e2e` deben terminar correctamente en un checkout limpio.
- Confirmar instalación reproducible con `npm ci` en CI/Vercel y que el runtime elegido cumple los requisitos de Node de la versión de Vite instalada.
- Revisar rutas profundas y refresco directo de `/menu`, `/admin`, `/cliente` y `/mesero`, además del redirect `/admin.html`.
- Confirmar que los recursos existentes se sirven como archivos y que rutas inexistentes de assets no se convierten accidentalmente en páginas de la SPA.
- Comprobar carga de imágenes, fuentes, estilos y ausencia de errores de consola/red en Production y Preview.
- Probar registro, inicio/cierre de sesión, confirmación de correo, recuperación de contraseña y autorización por rol con usuarios de prueba adecuados.
- Confirmar RLS, roles y permisos en Supabase; revisar las URLs permitidas, plantillas de correo y configuración OAuth para el dominio final.
- Revisar el contenido del bundle y del repositorio para asegurar que no hay secretos. Nunca publicar `.env`, credenciales locales, `.tmp/` ni archivos privados.
- Configurar monitoreo, dominio, HTTPS, política de backups y procedimiento de rollback antes de abrir el servicio al público.

## Hallazgos de auditoría local (25 nov 2026)

- Rama actual y principal observada: `main`; remoto `origin` apunta al repositorio GitHub solicitado. HEAD coincide con `origin/main` en la vista local al momento de la auditoría.
- El árbol tiene numerosos cambios y archivos nuevos preexistentes. Se conservaron sin modificación; no se crearon commits ni se hizo push.
- `.env` y `.tmp/` coinciden con reglas de `.gitignore` y no aparecen como archivos versionados. Sin embargo, `node_modules/` está actualmente versionado en el índice/historial aunque esté ignorado; las reglas de ignore no dejan de seguir archivos ya versionados. Antes de publicar, retirar dependencias generadas del control de versiones en un cambio revisado y comprobar que no quedan archivos privados.
- El historial local contiene un solo commit visible. El único archivo de entorno versionado encontrado es `.env.example`, sin valores de credenciales en su contenido actual. Esto no demuestra que ningún secreto haya aparecido en otros archivos; rotar cualquier credencial que se confirme expuesta.
- Un escaneo de patrones comunes de JWT, claves Supabase `sb_secret_` y asignaciones directas a `SUPABASE_SERVICE_ROLE_KEY` no reportó coincidencias en ese commit (se excluyeron dependencias y lockfiles). Es un filtro de patrones, no una garantía universal de ausencia de secretos.
- Variables detectadas en el frontend: `VITE_APP_NAME`, `VITE_APP_TIMEZONE`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. El script local de creación de usuarios también lee `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; esas variables no son necesarias en Vercel y no deben configurarse como `VITE_*`.
- Node local observado: v24.15.0. PowerShell bloqueó el shim `npm.ps1`; las verificaciones se ejecutaron con `npm.cmd`.

### Resultados de verificación local

- `npm.cmd run lint`: aprobado.
- `npm.cmd run build`: aprobado. Vite generó `dist`; reportó el chunk principal de JavaScript por encima de 500 kB minificados y las imágenes de producto/hero entre aproximadamente 2,1 y 2,9 MB cada una. Recomprimir imágenes y dividir el bundle antes de producción para mejorar carga inicial.
- `npm.cmd test`: falló, 89 aprobadas y 3 fallidas en `clientAndAdminFlows.test.jsx` y `publicCatalogAndCart.test.jsx` (dos aserciones que no encontraron el contenido esperado y un timeout de 5 s). Consultar los tests y corregir antes de producción.
- `npm.cmd run test:e2e`: las 27 pruebas listadas llegaron a estado aprobado, pero Playwright no devolvió el resumen/exit code tras terminar los workers; se interrumpió el proceso que quedó abierto. Repetir en CI o checkout limpio y confirmar un cierre normal antes de producción.
- No se ejecutó `npm ci` localmente: reemplazaría `node_modules`, que está versionado en el estado actual y además tiene cambios locales preexistentes. Vercel puede usar `npm ci` sobre un checkout limpio cuando este problema de seguimiento se resuelva.
