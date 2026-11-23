import { NavLink, Outlet } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';

export function AreaPlaceholderLayout({ subtitle = 'SIGR · PLATAFORMA' }) {
  return (
    <div className="area-shell">
      <header className="area-topbar">
        <BrandLogo to="/" subtitle={subtitle} />
        <nav className="area-nav" aria-label="Navegación entre áreas">
          <NavLink to="/">Sitio público</NavLink>
          <NavLink to="/cliente">Cliente</NavLink>
          <NavLink to="/mesero">Mesero</NavLink>
          <NavLink to="/admin">Administrador</NavLink>
        </nav>
      </header>
      <main className="area-content">
        <Outlet />
      </main>
    </div>
  );
}
