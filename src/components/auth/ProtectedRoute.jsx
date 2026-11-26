import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasAllowedRole } from '../../utils/rbac';
import { AuthLoading } from './AuthLoading';

export function ProtectedRoute({ allowedRoles = [], children }) {
  const { isLoading, isAuthenticated, user, profile, role, isActive } =
    useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated || !user || !profile || !isActive || !role) {
    const intendedPath = `${location.pathname}${location.search}`;
    const loginTarget =
      intendedPath && intendedPath !== '/'
        ? `/login?redirect=${encodeURIComponent(intendedPath)}`
        : '/login';

    return <Navigate to={loginTarget} replace />;
  }

  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !hasAllowedRole(role, allowedRoles)
  ) {
    return (
      <Navigate
        to="/acceso-denegado"
        replace
        state={{ attemptedPath: location.pathname }}
      />
    );
  }

  return children ?? <Outlet />;
}
