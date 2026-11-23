# Estructura Objetivo del Proyecto
## FORJA BRAVA — SIGR

Árbol de carpetas objetivo para la futura implementación sobre **React + Vite + Tailwind CSS v4 + Zod + Supabase + Vitest + Playwright + GitHub Actions + Vercel**.

> *Nota:* Esta estructura es la especificación objetivo; no se crean carpetas ni archivos de código durante esta etapa documental.

---

```text
Urestaurante/
├── .github/
│   └── workflows/
│       └── ci.yml                   # Lint, audit, unit tests, build, E2E y validación de secretos
├── docs/                            # Documentación integral del proyecto (esta estructura)
├── public/
│   └── assets/
│       └── images/                  # 14 imágenes optimizadas a .webp (hero + 13 productos base)
├── supabase/
│   ├── migrations/                  # Migraciones SQL versionadas (tablas, RLS, triggers, RPCs)
│   ├── seed.sql                     # Semilla oficial (roles, 4 categorías, 13 productos, configuración)
│   └── functions/
│       └── create-staff-user/       # Edge Function protegida para crear cuentas mesero/admin
├── src/
│   ├── main.jsx                     # Bootstrap React + estilos
│   ├── app/
│   │   ├── App.jsx                  # Providers (Auth, Cart, Toast) + ErrorBoundary
│   │   ├── router.jsx               # Rutas públicas, cliente, mesero y admin + React.lazy
│   │   └── guards/
│   │       ├── ProtectedRoute.jsx   # Validación de sesión y rol permitido
│   │       └── GuestOnlyRoute.jsx   # Redirección inteligente en /login y /registro
│   ├── layouts/
│   │   ├── PublicLayout.jsx         # Header editorial, Footer, Drawer Carrito, WhatsApp
│   │   ├── ClientLayout.jsx         # Cabecera cliente + navegación interna
│   │   ├── WaiterLayout.jsx         # Sidebar operativa (SIGR · SERVICIO)
│   │   └── AdminLayout.jsx          # Sidebar administrativa (SIGR · ADMIN)
│   ├── context/
│   │   ├── AuthContext.jsx          # Sesión Supabase Auth + profile + role
│   │   ├── CartContext.jsx          # Carrito reactivo + persistencia localStorage v2
│   │   └── ToastContext.jsx         # Sistema global de notificaciones
│   ├── components/                  # Componentes UI reutilizables (ver docs/02-diseno/componentes-ui.md)
│   ├── features/
│   │   ├── public/                  # Landing, MenuPage, ProductDetailModal, PublicReservations, Contact
│   │   ├── auth/                    # LoginPage, RegisterPage, RecoveryPage
│   │   ├── client/                  # ClientDashboard, ProfilePage, CheckoutPage, MyOrders, OrderTracking, MyReservations
│   │   ├── waiter/                  # WaiterDashboard, TablesGrid, TableAccountPage, NewTableOrder, WaiterOrders
│   │   └── admin/                   # AdminDashboard, ProductsAdmin, CategoriesAdmin, OrdersAdmin, ReservationsAdmin, TablesAdmin, UsersAdmin, CashAdmin, ReportsAdmin, SettingsAdmin, AuditAdmin
│   ├── services/                    # Encapsulación de Supabase (PostgREST, RPC, Storage, Realtime)
│   ├── schemas/                     # Validaciones Zod por dominio
│   ├── styles/
│   │   ├── theme.css                # Tokens @theme de css/input.css + Google Fonts
│   │   ├── public.css               # Estilos editoriales migrados de css/styles.css
│   │   ├── panels.css               # Estilos operativos migrados de css/admin.css
│   │   └── print.css                # Reglas @media print para comprobantes y reportes
│   └── utils/                       # formatMoney.js, dateBogota.js, orderStatus.js, errorMapper.js
├── tests/
│   ├── unit/                        # Pruebas Vitest (esquemas Zod, carrito, caja, reportes, guards)
│   └── e2e/                         # Pruebas Playwright (compra, login, bloqueo roles, flujo mesero/admin)
├── index.html                       # Entrada única SPA Vite (con Google Fonts)
├── vite.config.js                   # Vite + @vitejs/plugin-react + @tailwindcss/vite
├── eslint.config.js                 # ESLint + reglas React/Hooks + no-danger
├── vitest.config.js                 # Configuración Vitest + jsdom
├── playwright.config.js             # Configuración Playwright sobre vite preview
├── vercel.json                      # Rewrites SPA + Cabeceras HTTP de seguridad
├── .env.example                     # Plantilla segura (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
├── .gitignore                       # Exclusión de node_modules, dist, .env, reportes test
└── package.json                     # Scripts: dev, build, preview, lint, test:unit, test:e2e
```
