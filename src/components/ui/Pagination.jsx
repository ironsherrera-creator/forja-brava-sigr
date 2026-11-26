import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  className = '',
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginación"
      className={`flex items-center justify-between gap-3 pt-4 ${className}`.trim()}
    >
      <p className="m-0 text-xs text-text-secondary">
        Página <strong className="text-text-primary">{currentPage}</strong> de{' '}
        <strong className="text-text-primary">{totalPages}</strong>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange?.(currentPage - 1)}
          leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange?.(currentPage + 1)}
          rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
