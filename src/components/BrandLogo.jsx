import { Link } from 'react-router-dom';

export function BrandLogo({
  to = '/',
  subtitle = 'COCINA AL FUEGO',
  className = '',
  ariaLabel = 'FORJA BRAVA, inicio',
}) {
  return (
    <Link className={`brand ${className}`.trim()} to={to} aria-label={ariaLabel}>
      <span className="brand-mark">
        F<span>B</span>
      </span>
      <span className="brand-name">
        FORJA <b>BRAVA</b>
        <small>{subtitle}</small>
      </span>
    </Link>
  );
}
