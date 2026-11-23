import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';

export function NotFoundPage() {
  return (
    <div className="area-shell">
      <header className="area-topbar">
        <BrandLogo to="/" subtitle="COCINA AL FUEGO" />
      </header>
      <main className="area-content flex items-center justify-center">
        <section className="area-panel w-full max-w-xl">
          <span className="area-badge">Error 404</span>
          <p className="mini-label mt-4">RUTA NO ENCONTRADA</p>
          <h1>
            Esta mesa no está <em>disponible.</em>
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-[#685a4d]">
            La dirección que buscas no existe o pertenece a un módulo que aún no
            ha sido habilitado en esta etapa.
          </p>
          <Link className="button button-fire" to="/">
            VOLVER AL INICIO <span>↗</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
