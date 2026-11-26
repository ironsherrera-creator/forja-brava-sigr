import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '../../components/BrandLogo';
import { useAuth } from '../../hooks/useAuth';
import { getDefaultRouteForRole } from '../../utils/rbac';

export function UnauthorizedPage() {
  const { isAuthenticated, role, signOut } = useAuth();
  const location = useLocation();
  const attemptedPath = location.state?.attemptedPath || null;
  const authorizedHome = getDefaultRouteForRole(role);

  return (
    <div className="area-shell">
      <header className="area-topbar">
        <BrandLogo to="/" subtitle="COCINA AL FUEGO" />
        <Link to="/" className="text-xs tracking-widest text-[#d6c2a3] uppercase hover:text-[#f1e8d8]">
          ← Sitio público
        </Link>
      </header>

      <main className="area-content flex items-center justify-center">
        <section className="area-panel w-full max-w-xl" role="alert">
          <span className="area-badge">Acceso restringido · 403</span>
          <p className="mini-label mt-4">AUTORIZACIÓN INSUFICIENTE</p>
          <h1>
            Zona reservada <em>al personal autorizado.</em>
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-[#685a4d]">
            Tu cuenta actual{role ? ` (rol: ${role})` : ''} no cuenta con los
            permisos necesarios para acceder
            {attemptedPath ? ` a la ruta "${attemptedPath}"` : ' a esta sección'}.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link className="button button-fire" to={authorizedHome}>
                  IR A MI PANEL AUTORIZADO <span>↗</span>
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="under-link !mt-0 cursor-pointer bg-transparent border-0"
                >
                  CERRAR SESIÓN
                </button>
              </>
            ) : (
              <Link className="button button-fire" to="/login">
                INICIAR SESIÓN <span>↗</span>
              </Link>
            )}
            <Link to="/" className="text-xs tracking-wider text-[#68452f] underline">
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
