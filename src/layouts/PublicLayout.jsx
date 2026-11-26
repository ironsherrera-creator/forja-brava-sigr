import { useState } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  Clock,
  MapPin,
  Menu,
  Phone,
  ShoppingBag,
  User,
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { CartDrawer } from '../components/cart/CartDrawer';
import { Drawer, IconButton, OfflineBanner } from '../components/ui';
import { PUBLIC_NAV_LINKS } from '../config/navigation';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { useRestaurantSettings } from '../hooks/useRestaurantSettings';
import { useScrollHeader } from '../hooks/useScrollHeader';
import { formatBusinessHoursList } from '../services/catalogService';
import { ROLES, getDefaultRouteForRole } from '../utils/rbac';

export function PublicLayout() {
  const scrolled = useScrollHeader(40);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, profile, role, signOut } = useAuth();
  const { totalUnits, openDrawer } = useCart();
  const { settings } = useRestaurantSettings();
  const navigate = useNavigate();

  const closeMenu = () => setMobileMenuOpen(false);

  const handleSignOut = async () => {
    closeMenu();
    await signOut();
    navigate('/', { replace: true });
  };

  const firstName = profile?.full_name
    ? profile.full_name.trim().split(/\s+/)[0]
    : 'Cuenta';

  const panelRoute = getDefaultRouteForRole(role);
  const panelLabel =
    role === ROLES.ADMINISTRADOR
      ? `ADMIN · ${firstName}`
      : role === ROLES.MESERO
        ? `MESERO · ${firstName}`
        : `MI CUENTA · ${firstName}`;

  const businessHours = formatBusinessHoursList(settings?.business_hours);
  const hasSocialLinks = Boolean(
    settings?.instagram_url?.trim() || settings?.facebook_url?.trim(),
  );

  return (
    <div id="top" className="min-h-screen flex flex-col bg-carbon text-cream">
      <a className="skip-link sr-only focus:not-sr-only" href="#contenido">
        Saltar al contenido
      </a>

      <OfflineBanner />

      <header className={`site-header w-full ${scrolled ? 'scrolled' : ''}`}>
        <BrandLogo to="/" subtitle="COCINA AL FUEGO" />

        <nav
          id="main-nav"
          className="hidden md:flex items-center gap-[clamp(14px,2vw,28px)] text-[10px] tracking-[1px] uppercase"
          aria-label="Navegación principal"
        >
          {PUBLIC_NAV_LINKS.map((item) =>
            item.to ? (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive
                    ? 'text-cream font-semibold'
                    : 'text-paper/80 hover:text-cream transition-colors'
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <a
                key={item.href}
                href={item.href}
                className="text-paper/80 hover:text-cream transition-colors"
              >
                {item.label}
              </a>
            ),
          )}

          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Abrir carrito (${totalUnits} ${totalUnits === 1 ? 'unidad' : 'unidades'})`}
            className="relative inline-flex items-center gap-1.5 px-2.5 py-2 border border-sand/30 rounded-[var(--radius-xs)] text-cream hover:border-fire transition-colors cursor-pointer bg-transparent"
          >
            <ShoppingBag className="h-4 w-4 text-fire" aria-hidden="true" />
            <span>Carrito</span>
            <span
              data-testid="header-cart-count"
              className="min-w-[18px] h-[18px] px-1 rounded-full bg-fire text-white text-[10px] font-bold inline-flex items-center justify-center"
            >
              {totalUnits}
            </span>
          </button>

          {isAuthenticated ? (
            <>
              <NavLink
                to={panelRoute}
                className="inline-flex items-center gap-1.5 text-cream font-semibold hover:text-fire-hover transition-colors"
              >
                <User className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
                <span>{panelLabel}</span>
              </NavLink>
              <button
                type="button"
                onClick={handleSignOut}
                className="header-logout-btn"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="text-paper/85 hover:text-cream transition-colors"
              >
                Iniciar sesión
              </NavLink>
              <Link className="nav-order inline-flex items-center gap-2" to="/registro">
                <span>CREAR CUENTA</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </>
          )}
        </nav>

        <div className="md:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={openDrawer}
            aria-label={`Abrir carrito (${totalUnits})`}
            className="relative inline-flex items-center justify-center h-10 w-10 rounded-[var(--radius-sm)] border border-white/15 bg-transparent text-cream hover:bg-white/10 cursor-pointer"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {totalUnits > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-fire text-white text-[10px] font-bold flex items-center justify-center">
                {totalUnits}
              </span>
            )}
          </button>
          <IconButton
            icon={<Menu className="h-5 w-5" aria-hidden="true" />}
            label="Abrir menú de navegación"
            variant="dark"
            size="md"
            onClick={() => setMobileMenuOpen(true)}
          />
        </div>
      </header>

      <Drawer
        open={mobileMenuOpen}
        onClose={closeMenu}
        title="FORJA BRAVA"
        side="right"
        tone="dark"
      >
        <div className="p-4 flex flex-col h-full">
          <nav className="flex flex-col divide-y divide-sand/15" aria-label="Navegación móvil pública">
            {PUBLIC_NAV_LINKS.map((item) =>
              item.to ? (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className="py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream hover:text-fire-hover transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream hover:text-fire-hover transition-colors"
                >
                  {item.label}
                </a>
              ),
            )}
            <Link
              to="/carrito"
              onClick={closeMenu}
              className="py-3.5 text-xs font-semibold uppercase tracking-[0.14em] text-cream hover:text-fire-hover transition-colors flex items-center justify-between"
            >
              <span>Mi carrito</span>
              <span className="px-2 py-0.5 rounded-full bg-fire text-white text-[10px]">
                {totalUnits}
              </span>
            </Link>
          </nav>

          <div className="mt-6 pt-5 border-t border-sand/15 space-y-3">
            {isAuthenticated ? (
              <>
                <Link
                  to={panelRoute}
                  onClick={closeMenu}
                  className="button button-fire w-full !h-11"
                >
                  {panelLabel}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="header-logout-btn w-full py-3"
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="block text-center py-3 border border-sand/30 text-xs font-semibold uppercase tracking-[0.14em] text-cream hover:border-fire transition-colors"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/registro"
                  onClick={closeMenu}
                  className="button button-fire w-full !h-11"
                >
                  CREAR CUENTA
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      </Drawer>

      <CartDrawer />

      <main id="contenido" className="flex-1">
        <Outlet />
      </main>

      <footer className="site-footer border-t border-sand/15">
        <div className="footer-main flex-wrap gap-8">
          <div className="space-y-3 max-w-xs">
            <BrandLogo to="/" subtitle="COCINA AL FUEGO" className="brand-footer" />
            <p className="m-0 font-[var(--font-display)] text-lg text-paper/80 leading-snug">
              El sabor que se hace <em className="text-fire">a fuego.</em>
            </p>
          </div>

          <div className="flex flex-wrap gap-8 text-xs text-sand/85">
            <div>
              <p className="m-0 mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fire">
                Navegación
              </p>
              <ul className="m-0 p-0 list-none space-y-1.5">
                <li>
                  <Link to="/" className="hover:text-cream transition-colors">
                    Inicio
                  </Link>
                </li>
                <li>
                  <Link to="/menu" className="hover:text-cream transition-colors">
                    Menú
                  </Link>
                </li>
                <li>
                  <Link to="/carrito" className="hover:text-cream transition-colors">
                    Carrito
                  </Link>
                </li>
                <li>
                  <Link
                    to={isAuthenticated ? panelRoute : '/login'}
                    className="hover:text-cream transition-colors"
                  >
                    {isAuthenticated ? 'Mi panel' : 'Acceso a cuenta'}
                  </Link>
                </li>
              </ul>
            </div>

            {(settings?.location || settings?.phone || businessHours.length > 0) && (
              <div>
                <p className="m-0 mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fire">
                  Restaurante
                </p>
                <ul className="m-0 p-0 list-none space-y-2">
                  {settings?.location && (
                    <li className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-fire mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{settings.location}</span>
                    </li>
                  )}
                  {businessHours.length > 0 && (
                    <li className="flex items-start gap-2">
                      <Clock className="h-3.5 w-3.5 text-fire mt-0.5 shrink-0" aria-hidden="true" />
                      <span>
                        {businessHours[0].day}–{businessHours[businessHours.length - 1].day} ·{' '}
                        {businessHours[0].schedule}
                      </span>
                    </li>
                  )}
                  {settings?.phone && (
                    <li className="flex items-start gap-2">
                      <Phone className="h-3.5 w-3.5 text-fire mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{settings.phone}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {hasSocialLinks && (
              <div>
                <p className="m-0 mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-fire">
                  Redes
                </p>
                <ul className="m-0 p-0 list-none space-y-1.5">
                  {settings?.instagram_url?.trim() && (
                    <li>
                      <a
                        href={settings.instagram_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-cream transition-colors"
                      >
                        Instagram
                      </a>
                    </li>
                  )}
                  {settings?.facebook_url?.trim() && (
                    <li>
                      <a
                        href={settings.facebook_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-cream transition-colors"
                      >
                        Facebook
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <a
            className="footer-top inline-flex items-center gap-1.5 hover:text-cream transition-colors"
            href="#top"
          >
            <span>VOLVER ARRIBA</span>
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <div className="footer-bottom flex-wrap gap-3">
          <span>© 2026 {settings?.restaurant_name || 'FORJA BRAVA'} · SIGR · TODOS LOS DERECHOS RESERVADOS</span>
          <span>
            HECHO CON CARÁCTER <i>✳</i>
          </span>
          <span>COLOMBIA</span>
        </div>
      </footer>
    </div>
  );
}
