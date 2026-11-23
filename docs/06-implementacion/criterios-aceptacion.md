# Criterios de Aceptación Transversales
## FORJA BRAVA — SIGR

Lista de verificación obligatoria que debe cumplirse antes de considerar lista para producción la evolución de **FORJA BRAVA — SIGR**.

---

## 1. Criterios funcionales y de negocio (D-01 a D-06)
- [ ] **D-01:** El administrador puede crear, editar y desactivar mesas dinámicamente y dichos cambios se reflejan en Reservas y en el panel del Mesero.
- [ ] **D-02:** Cambiar la duración de reserva en Configuración modifica inmediatamente los intervalos calculados y el control de solapamientos.
- [ ] **D-03:** La tarifa fija de domicilio configurada se suma automáticamente en el Checkout de modalidad `Domicilio` y se calcula en servidor.
- [ ] **D-04:** Múltiples pedidos de una misma mesa se acumulan en una única `table_account` con pago `Pendiente`, se cobran una sola vez al cerrar la cuenta en Caja y liberan la mesa a `Disponible`.
- [ ] **D-05:** El mesero puede registrar pedidos en mesa, marcarlos como `Entregado` y cancelar únicamente pedidos en estado `Pendiente`; cualquier intento de cambiar estados de preparación o cancelar un pedido en preparación es rechazado tanto en UI como en PostgreSQL.
- [ ] **D-06:** El menú público se navega sin sesión; intentar confirmar Checkout o Reserva sin sesión redirige a `/login` conservando el carrito o la selección.
- [ ] Todos los pagos simulados muestran explícitamente su carácter de simulación sin transacción bancaria real.

## 2. Criterios de identidad visual y UX
- [ ] Se conservan intactos los colores oficiales (`#171613`, `#35251d`, `#68452f`, `#f1e8d8`, `#e9dfcf`, `#d6c2a3`, `#c66a32`, `#e07c42`), tipografías (`Playfair Display`, `DM Sans`) y logotipo `FB` en las 4 experiencias.
- [ ] Todas las pantallas implementan estados de carga, vacío, error y éxito, cierre de modales con `Escape`, sin `alert()`/`confirm()`/`prompt()` nativos.
- [ ] Comprobantes, pre-cuentas y reportes imprimen limpiamente vía `@media print`.
- [ ] Todas las vistas son completamente funcionales en escritorio, tablet y móvil.

## 3. Criterios de seguridad e integridad
- [ ] RLS habilitado y probado en el 100% de las tablas públicas de Supabase.
- [ ] Ninguna credencial hardcodeada ni clave `service_role` presente en el repositorio o bundle de Vite.
- [ ] Precios, subtotales, tarifas y totales calculados exclusivamente en servidor mediante RPCs.
- [ ] Cero vulnerabilidades XSS (sin `innerHTML` ni `dangerouslySetInnerHTML`) y cabeceras HTTP de seguridad activas en Vercel.
- [ ] Cortes diarios de Dashboard, Reservas, Caja y Reportes operando en zona horaria `America/Bogota`.

## 4. Criterios de rendimiento, calidad y CI/CD
- [ ] Imágenes de catálogo optimizadas a WebP (< 100 KB por tarjeta, < 200 KB Hero).
- [ ] `npm run lint`, `npm audit --audit-level=high`, `npm run test:unit` (Vitest), `npm run build` y `npm run test:e2e` (Playwright) ejecutándose en verde dentro de GitHub Actions antes del despliegue en Vercel.
