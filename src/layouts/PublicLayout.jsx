import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { useScrollHeader } from '../hooks/useScrollHeader';

export function PublicLayout() {
  const scrolled = useScrollHeader(40);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div id="top">
      <a className="skip-link sr-only focus:not-sr-only" href="#contenido">
        Saltar al contenido
      </a>

      <header className={`site-header w-full ${scrolled ? 'scrolled' : ''}`}>
        <BrandLogo to="/" subtitle="COCINA AL FUEGO" />

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <span />
          <span />
        </button>

        <nav
          id="main-nav"
          className={`main-nav ${menuOpen ? 'open' : ''}`}
          aria-label="Navegación principal"
        >
          <a href="#inicio" onClick={closeMenu}>
            Inicio
          </a>
          <a href="#esencia" onClick={closeMenu}>
            Nuestra esencia
          </a>
          <a href="#menu" onClick={closeMenu}>
            Menú
          </a>
          <a href="#contacto" onClick={closeMenu}>
            Contacto
          </a>
          <NavLink to="/cliente" onClick={closeMenu}>
            Cliente
          </NavLink>
          <NavLink to="/mesero" onClick={closeMenu}>
            Mesero
          </NavLink>
          <NavLink to="/admin" onClick={closeMenu}>
            Admin
          </NavLink>
          <a className="nav-order" href="#menu" onClick={closeMenu}>
            VER CARTA <span>↗</span>
          </a>
        </nav>
      </header>

      <main id="contenido">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <BrandLogo to="/" subtitle="COCINA AL FUEGO" className="brand-footer" />
          <p>
            El sabor que se
            <br />
            hace <em>a fuego.</em>
          </p>
          <a className="footer-top" href="#top">
            VOLVER ARRIBA ↑
          </a>
        </div>
        <div className="footer-bottom">
          <span>© 2026 FORJA BRAVA · SIGR (ETAPA 1 — BASE REACT + VITE)</span>
          <span>
            HECHO CON CARÁCTER <i>✳</i>
          </span>
          <span>BOGOTÁ, COLOMBIA</span>
        </div>
      </footer>
    </div>
  );
}
