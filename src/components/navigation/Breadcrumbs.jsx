import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { buildBreadcrumbsFromPath } from '../../config/navigation';

export function Breadcrumbs({ items = null, className = '' }) {
  const { pathname } = useLocation();
  const crumbs = items || buildBreadcrumbsFromPath(pathname);

  if (!crumbs || crumbs.length === 0) return null;

  return (
    <nav aria-label="Ruta de navegación" className={`min-w-0 ${className}`.trim()}>
      <ol className="m-0 p-0 list-none flex items-center flex-wrap gap-1.5 text-xs">
        {crumbs.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5 min-w-0">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-text-muted shrink-0" aria-hidden="true" />
            )}
            {crumb.to && !crumb.isCurrent ? (
              <Link
                to={crumb.to}
                className="text-text-secondary hover:text-fire transition-colors truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="font-semibold text-text-primary truncate"
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
