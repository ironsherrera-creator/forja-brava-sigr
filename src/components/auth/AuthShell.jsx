import { Link } from 'react-router-dom';
import { LOCAL_IMAGES } from '../../assets/images';
import { BrandLogo } from '../BrandLogo';

export function AuthShell({
  kicker = 'FORJA BRAVA · ACCESO SEGURO',
  title,
  accent,
  subtitle,
  children,
  footer,
}) {
  return (
    <section
      className="auth-screen"
      style={{
        backgroundImage: `linear-gradient(120deg, #171613f2 12%, #171613cc 58%, #35251de0 100%), url(${LOCAL_IMAGES.hero})`,
      }}
    >
      <div className="auth-panel-card">
        <div className="auth-panel-top">
          <BrandLogo to="/" subtitle="COCINA AL FUEGO" className="auth-brand" />
          <Link to="/" className="auth-back-link">
            ← INICIO
          </Link>
        </div>

        <p className="mini-label mt-6">{kicker}</p>
        <h1 className="auth-heading">
          {title} {accent ? <em>{accent}</em> : null}
        </h1>
        {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}

        <div className="mt-5">{children}</div>

        {footer ? <footer className="auth-card-footer">{footer}</footer> : null}
      </div>
    </section>
  );
}
