# FORJA BRAVA — SIGR

**Sistema Integral de Gestión de Restaurante** para FORJA BRAVA (*El sabor que se hace a fuego.*).

- **Repositorio:** https://github.com/ironsherrera-creator/forja-brava-sigr
- **Tecnologías:** React 19 · Vite 8 · JavaScript · Tailwind CSS v4 · Supabase · PostgreSQL · Vitest · Playwright · Vercel

---

## 🚀 Acceso al sistema

- **Entorno de producción (desplegado en Vercel):** https://forja-brava-sigr.vercel.app/

El sistema cuenta con **tres perfiles de acceso independientes** (`Administrador`, `Mesero` y `Cliente`), cada uno con vistas, funcionalidades y permisos diferenciados respaldados por autenticación de Supabase, Row Level Security (RLS) y funciones RPC en PostgreSQL.

---

## 👥 Cuentas de evaluación académica

| Rol | Correo electrónico | Nombre del perfil | Funcionalidades que puede evaluar el profesor |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@forjabrava.com` | Camila Herrera (Prueba) | Gestión de productos, categorías, usuarios, reservas, mesas, pedidos, caja, configuración y reportes. |
| **Mesero** | `mesero@forjabrava.com` | Mateo Ríos (Prueba) | Consulta de mesas, registro de pedidos, seguimiento de cuentas y operaciones propias del perfil. |
| **Cliente** | `cliente@forjabrava.com` | Valentina Gómez (Prueba) | Consulta del catálogo, reservas y funcionalidades habilitadas para clientes. |

> **Nota de seguridad:** Por tratarse de un repositorio público, **las contraseñas de estas cuentas no se incluyen en este `README.md`**. Las contraseñas de evaluación se entregan al profesor mediante un canal privado.

---

## 🧭 Instrucciones de acceso

1. Ingresar al enlace de producción: https://forja-brava-sigr.vercel.app/
2. Acceder al formulario de inicio de sesión (`/login`).
3. Introducir el correo electrónico y la contraseña correspondientes al perfil asignado.
4. Evaluar las funcionalidades habilitadas para ese rol.
5. Cerrar sesión desde el menú de usuario antes de iniciar sesión con otro perfil.

---

## 🎓 Guía de evaluación académica

Esta guía está diseñada para facilitar la revisión funcional y técnica de **FORJA BRAVA — SIGR** en producción:

- **Aplicación desplegada en Vercel:** https://forja-brava-sigr.vercel.app/
- **Documento de credenciales y acceso:** [Consultar credenciales e instrucciones de evaluación](docs/CREDENCIALES-EVALUACION.md)

### Procedimiento recomendado para el profesor

**Paso 1. Ingresar a la aplicación**  
Acceder al sistema mediante el dominio oficial de Vercel: https://forja-brava-sigr.vercel.app/.

**Paso 2. Consultar las credenciales**  
Abrir [Consultar credenciales e instrucciones de evaluación](docs/CREDENCIALES-EVALUACION.md), donde se detallan los nombres de perfil, correos electrónicos, roles e instrucciones de acceso. Las contraseñas de evaluación se entregan mediante un canal privado y no deben publicarse en este `README.md`.

**Paso 3. Evaluar el perfil administrador**  
Iniciar sesión con la cuenta de administrador (`admin@forjabrava.com`) para revisar:
- Panel administrativo (`/admin`).
- Gestión de productos y categorías (`/admin/productos`, `/admin/categorias`).
- Gestión de usuarios y roles (`/admin/usuarios`, `/admin/roles`).
- Administración de mesas y reservas (`/admin/mesas`, `/admin/reservas`).
- Gestión y consulta de pedidos (`/admin/pedidos`).
- Caja y operaciones financieras (`/admin/caja`, `/admin/movimientos`).
- Reportes y auditoría (`/admin/reportes`, `/admin/auditoria`).

**Paso 4. Evaluar el perfil mesero**  
Iniciar sesión con la cuenta de mesero (`mesero@forjabrava.com`) para revisar:
- Panel de mesero (`/mesero`).
- Consulta de mesas (`/mesero/mesas`).
- Registro de pedidos y comandas (`/mesero/comandas/nueva`).
- Consulta de cuentas activas (`/mesero/cuentas`).
- Seguimiento de pedidos y operaciones permitidas (`/mesero/pedidos`, `/mesero/historial`).

**Paso 5. Evaluar el perfil cliente**  
Iniciar sesión con la cuenta de cliente (`cliente@forjabrava.com`) para revisar:
- Catálogo de productos (`/menu`).
- Consulta de productos y complementos (`/producto/:slug`).
- Reservas (`/cliente/reservas`).
- Funcionalidades habilitadas para clientes (`/cliente`, `/cliente/perfil`, `/cliente/direcciones`, `/cliente/pedidos`, `/cliente/seguimiento`, `/cliente/historial`).

**Paso 6. Cambiar de perfil**  
Cerrar sesión desde el menú de usuario antes de ingresar con otra cuenta y repetir el procedimiento.

### Documentación adicional para ampliar la evaluación

- **Índice maestro de documentación:** [docs/00-indice-general.md](docs/00-indice-general.md)
- **Arquitectura del sistema:** [docs/03-arquitectura/arquitectura-general.md](docs/03-arquitectura/arquitectura-general.md)
- **Base de datos (MER y diccionario):** [docs/04-base-datos/modelo-entidad-relacion.md](docs/04-base-datos/modelo-entidad-relacion.md) · [docs/04-base-datos/diccionario-datos.md](docs/04-base-datos/diccionario-datos.md)
- **Reglas de negocio:** [Pedidos](docs/05-reglas-negocio/pedidos.md) · [Reservas](docs/05-reglas-negocio/reservas.md) · [Mesas](docs/05-reglas-negocio/mesas.md) · [Caja y reportes](docs/05-reglas-negocio/caja-reportes.md)
- **Seguridad y permisos:** [docs/03-arquitectura/autenticacion-autorizacion.md](docs/03-arquitectura/autenticacion-autorizacion.md) · [docs/03-arquitectura/seguridad.md](docs/03-arquitectura/seguridad.md)
- **Guías de usuario y cuentas de prueba:** [docs/06-implementacion/guia-usuarios-prueba.md](docs/06-implementacion/guia-usuarios-prueba.md)
- **Informes de pruebas, calidad y sincronización:** [docs/06-implementacion/implementacion-etapa-11-pruebas-aseguramiento-calidad.md](docs/06-implementacion/implementacion-etapa-11-pruebas-aseguramiento-calidad.md) · [docs/06-implementacion/sincronizacion-supabase-produccion.md](docs/06-implementacion/sincronizacion-supabase-produccion.md)

---

Este repositorio conserva la arquitectura moderna con **React + Vite + Tailwind CSS v4 + React Router + Zod + ESLint**, la identidad visual, los recursos gráficos locales y la documentación de diseño y arquitectura en `docs/`.

---

## 1. Requisitos previos

- **Node.js** LTS (`>= 20.x`) y **npm** (`>= 10.x`).
- Navegador web actualizado.

Verifica tu entorno:

```powershell
node -v
npm -v
```

---

## 2. Instalación

Desde la raíz del proyecto:

```powershell
npm install
```

---

## 3. Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo de Vite (`http://localhost:5173`). |
| `npm run build` | Compila la aplicación React para producción en `dist/`. |
| `npm run preview` | Previsualiza localmente el bundle compilado (`http://localhost:4173`). |
| `npm run lint` | Ejecuta ESLint sobre el código fuente en `src/` y archivos de configuración. |
| `npm run build:css:legacy` | Conserva la compilación de la hoja legacy `css/tailwind.css` como respaldo temporal. |

---

## 4. Estructura del proyecto

```text
Urestaurante/
├── index.html               # Punto de entrada SPA de Vite
├── vite.config.js           # Configuración de Vite + React + Tailwind CSS v4
├── eslint.config.js         # Configuración flat de ESLint (React Hooks / Refresh)
├── .env.example             # Plantilla de variables de entorno (sin claves reales)
├── src/
│   ├── main.jsx             # Bootstrap de React
│   ├── app/                 # Componente raíz (App.jsx)
│   ├── routes/              # Enrutamiento base (/, /cliente, /mesero, /admin, *)
│   ├── layouts/             # PublicLayout y AreaPlaceholderLayout
│   ├── pages/               # Landing pública, páginas base de áreas y 404
│   ├── components/          # BrandLogo y StageNotice
│   ├── features/            # Módulos por dominio (catálogo base en public/)
│   ├── hooks/               # useScrollHeader y useRevealObserver
│   ├── services/            # Base para futura capa de servicios (sin Supabase aún)
│   ├── lib/                 # Validación de variables de entorno con Zod
│   ├── styles/              # Tokens oficiales @theme y estilos globales
│   ├── utils/               # Formateador COP y utilidades de fecha (America/Bogota)
│   └── assets/              # Registro de importación de imágenes locales
├── assets/                  # Recursos gráficos originales conservados (18 PNG)
├── admin.html, css/, js/    # Prototipo legacy conservado temporalmente como referencia
└── docs/                    # Documentación integral de análisis, diseño y arquitectura
```

---

## 5. Variables de entorno

El archivo `.env.example` define las variables previstas para el proyecto:

- `VITE_APP_NAME`: nombre visible de la aplicación.
- `VITE_APP_TIMEZONE`: zona horaria operativa (`America/Bogota`).
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`: reservadas para la etapa posterior de integración con Supabase (actualmente vacías).

> **Seguridad:** Nunca almacenes claves privadas ni `SUPABASE_SERVICE_ROLE_KEY` en variables `VITE_*` ni en el repositorio.

---

## 6. Estado actual de la migración y próximas etapas

- **Completado (Etapa 1):** Base ejecutable en React + Vite + Tailwind CSS v4 + React Router + Zod + ESLint, landing pública con identidad visual conservada, rutas base para `/cliente`, `/mesero`, `/admin` y `404`, y conservación íntegra de `assets/`, `docs/` y archivos legacy.
- **Pendiente (Etapas posteriores):**
  1. Modelado e implementación de base de datos PostgreSQL y Storage en Supabase.
  2. Autenticación multi-rol (`cliente`, `mesero`, `administrador`) con políticas RLS y RPCs.
  3. Migración y construcción completa de módulos funcionales (Menú dinámico, Carrito/Checkout, Reservas automáticas, Panel Mesero, Panel Administrador, Caja y Reportes).
  4. Pruebas automatizadas (Vitest y Playwright) y pipeline CI/CD (GitHub Actions + Vercel).

Para el detalle funcional, visual y arquitectónico consulta [`docs/00-indice-general.md`](docs/00-indice-general.md).
