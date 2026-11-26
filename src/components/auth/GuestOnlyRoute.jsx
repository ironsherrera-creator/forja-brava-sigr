import { Navigate, Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { resolvePostAuthRedirect } from '../../utils/rbac';
import { AuthLoading } from './AuthLoading';

export function GuestOnlyRoute({ children }) {
  const { isLoading, isAuthenticated, isActive, role } = useAuth();
  const [searchParams] = useSearchParams();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (isAuthenticated && isActive && role) {
    const destination = resolvePostAuthRedirect(
      searchParams.get('redirect'),
      role,
    );
    return <Navigate to={destination} replace />;
  }

  return children ?? <Outlet />;
}
