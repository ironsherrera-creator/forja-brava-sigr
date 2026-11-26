import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnlyRoute } from '../components/auth/GuestOnlyRoute';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AdminLayout } from '../layouts/AdminLayout';
import { ClientLayout } from '../layouts/ClientLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { WaiterLayout } from '../layouts/WaiterLayout';
import { AdminAuditPage } from '../pages/admin/AdminAuditPage';
import { AdminCashMovementsPage } from '../pages/admin/AdminCashMovementsPage';
import { AdminCashPage } from '../pages/admin/AdminCashPage';
import { AdminCategoriesPage } from '../pages/admin/AdminCategoriesPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';
import { AdminReportsPage } from '../pages/admin/AdminReportsPage';
import { AdminReservationsPage } from '../pages/admin/AdminReservationsPage';
import { AdminRolesPage } from '../pages/admin/AdminRolesPage';
import { AdminScheduleConfigPage } from '../pages/admin/AdminScheduleConfigPage';
import { AdminTablesPage } from '../pages/admin/AdminTablesPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { UnauthorizedPage } from '../pages/auth/UnauthorizedPage';
import { CheckoutPage } from '../pages/client/CheckoutPage';
import { ClientAddressesPage } from '../pages/client/ClientAddressesPage';
import { ClientHistoryPage } from '../pages/client/ClientHistoryPage';
import { ClientOrderDetailPage } from '../pages/client/ClientOrderDetailPage';
import { ClientOrdersPage } from '../pages/client/ClientOrdersPage';
import { ClientProfilePage } from '../pages/client/ClientProfilePage';
import { ClientReservationsPage } from '../pages/client/ClientReservationsPage';
import { ClientTrackingPage } from '../pages/client/ClientTrackingPage';
import { ClientPlaceholderPage } from '../pages/ClientPlaceholderPage';
import { HomePage } from '../pages/HomePage';
import { ModulePlaceholderPage } from '../pages/ModulePlaceholderPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { CartPage } from '../pages/public/CartPage';
import { MenuPage } from '../pages/public/MenuPage';
import { ProductDetailPage } from '../pages/public/ProductDetailPage';
import { WaiterAccountsPage } from '../pages/waiter/WaiterAccountsPage';
import { WaiterDashboardPage } from '../pages/waiter/WaiterDashboardPage';
import { WaiterNewOrderPage } from '../pages/waiter/WaiterNewOrderPage';
import { WaiterOrdersPage } from '../pages/waiter/WaiterOrdersPage';
import { WaiterTableDetailPage } from '../pages/waiter/WaiterTableDetailPage';
import { WaiterTablesPage } from '../pages/waiter/WaiterTablesPage';
import { ROLES } from '../utils/rbac';

export function AppRouter() {
  return (
    <Routes>
      {/* Rutas públicas de libre consulta */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/menu/:category" element={<MenuPage />} />
        <Route path="/producto/:slug" element={<ProductDetailPage />} />
        <Route path="/carrito" element={<CartPage />} />
      </Route>

      {/* Rutas exclusivas de invitados (redirigen según rol si ya hay sesión activa) */}
      <Route element={<GuestOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
      </Route>

      {/* Recuperación y actualización de contraseña */}
      <Route path="/recuperar-contrasena" element={<ForgotPasswordPage />} />
      <Route path="/actualizar-contrasena" element={<ResetPasswordPage />} />

      {/* Vista explícita de permisos insuficientes (403) */}
      <Route path="/acceso-denegado" element={<UnauthorizedPage />} />

      {/* Checkout protegido (autenticación obligatoria D-06) */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.CLIENTE]} />}>
        <Route element={<ClientLayout />}>
          <Route path="/checkout" element={<CheckoutPage />} />
        </Route>
      </Route>

      {/* Área privada exclusiva para rol `cliente` */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.CLIENTE]} />}>
        <Route path="/cliente" element={<ClientLayout />}>
          <Route index element={<ClientPlaceholderPage />} />
          <Route path="perfil" element={<ClientProfilePage />} />
          <Route path="direcciones" element={<ClientAddressesPage />} />
          <Route path="nuevo-pedido" element={<Navigate to="/menu" replace />} />
          <Route path="pedidos" element={<ClientOrdersPage />} />
          <Route path="pedidos/:id" element={<ClientOrderDetailPage />} />
          <Route path="seguimiento" element={<ClientTrackingPage />} />
          <Route path="seguimiento/:id" element={<ClientTrackingPage />} />
          <Route path="historial" element={<ClientHistoryPage />} />
          <Route path="reservas" element={<ClientReservationsPage />} />
          <Route path="reservas/:id" element={<ClientReservationsPage />} />
          <Route path="*" element={<Navigate to="/cliente" replace />} />
        </Route>
      </Route>

      {/* Área privada exclusiva para rol `mesero` (Etapa 8) */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.MESERO]} />}>
        <Route path="/mesero" element={<WaiterLayout />}>
          <Route index element={<WaiterDashboardPage />} />
          <Route path="mesas" element={<WaiterTablesPage />} />
          <Route path="mesas/:id" element={<WaiterTableDetailPage />} />
          <Route path="comandas/nueva" element={<WaiterNewOrderPage />} />
          <Route path="nuevo-pedido" element={<WaiterNewOrderPage />} />
          <Route path="pedidos" element={<WaiterOrdersPage />} />
          <Route path="cuentas" element={<WaiterAccountsPage />} />
          <Route path="historial" element={<WaiterOrdersPage historyOnly />} />
          <Route path="*" element={<Navigate to="/mesero" replace />} />
        </Route>
      </Route>

      {/* Área privada exclusiva para rol `administrador` (Etapas 7 y 9) */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMINISTRADOR]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="mesas" element={<AdminTablesPage />} />
          <Route path="mesas/:id" element={<AdminTablesPage />} />
          <Route path="reservas" element={<AdminReservationsPage />} />
          <Route path="reservas/:id" element={<AdminReservationsPage />} />
          <Route path="configuracion" element={<AdminScheduleConfigPage />} />
          <Route path="configuracion/horarios" element={<AdminScheduleConfigPage />} />
          <Route path="configuracion/reservas" element={<AdminScheduleConfigPage />} />
          <Route path="pedidos" element={<AdminOrdersPage />} />
          <Route path="productos" element={<AdminProductsPage />} />
          <Route path="productos/nuevo" element={<AdminProductsPage />} />
          <Route path="productos/:id" element={<AdminProductsPage />} />
          <Route path="categorias" element={<AdminCategoriesPage />} />
          <Route path="clientes" element={<AdminUsersPage clientsOnly />} />
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="roles" element={<AdminRolesPage />} />
          <Route path="auditoria" element={<AdminAuditPage />} />
          <Route path="caja" element={<AdminCashPage />} />
          <Route path="caja/apertura" element={<AdminCashPage defaultTab="overview" />} />
          <Route path="caja/pagos" element={<AdminCashPage defaultTab="overview" />} />
          <Route path="caja/arqueos" element={<AdminCashPage defaultTab="arqueo" />} />
          <Route path="caja/cierres" element={<AdminCashPage defaultTab="history" />} />
          <Route path="caja/movimientos" element={<AdminCashMovementsPage />} />
          <Route path="movimientos" element={<AdminCashMovementsPage />} />
          <Route path="reportes" element={<AdminReportsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>

      {/* Neutralización explícita de ruta legacy hacia el panel protegido */}
      <Route path="/admin.html" element={<Navigate to="/admin" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
