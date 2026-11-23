# FORJA BRAVA — SIGR

**Sistema Integral de Gestión de Restaurante** para FORJA BRAVA (*El sabor que se hace a fuego.*).

Este repositorio se encuentra en **Etapa 1 — Preparación y migración controlada** hacia una arquitectura moderna con **React + Vite + Tailwind CSS v4 + React Router + Zod + ESLint**, conservando la identidad visual, los recursos gráficos locales y la documentación de diseño y arquitectura en `docs/`.

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
