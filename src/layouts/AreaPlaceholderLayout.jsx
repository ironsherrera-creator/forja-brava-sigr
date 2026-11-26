import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../hooks/useAuth';
import { ROLES } from '../utils/rbac';

export function AreaPlaceholderLayout({ subtitle = 'SIGR · PLATAFORMA' }) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="area-shell">
      <header className="area-topbar">
        <BrandLogo to="/" subtitle={subtitle} />
        <nav className="area-nav" aria-label="Navegación del área autenticada">
          <NavLink to="/">Sitio público</NavLink>
          {role === ROLES.CLIENTE && (
            <NavLink to="/cliente">Mi cuenta</NavLink>
          )}
          {role === ROLES.MESERO && (
            <NavLink to="/mesero">Panel mesero</NavLink>
          )}
          {role === ROLES.ADMINISTRADOR && (
            <NavLink to="/admin">Panel administrador</NavLink>
          )}
        </nav>

        <div className="flex items-center gap-4 text-xs">
          {profile && (
            <span className="text-[#d6c2a3]">
              <strong className="text-[#f1e8d8]">{profile.full_name}</strong> ·{' '}
              <span className="uppercase tracking-wider">{role}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="header-logout-btn"
          >
            CERRAR SESIÓN
          </button>
        </div>
      </header>
      <main className="area-content">
        <Outlet />
      </main>
    </div>
  );
}
