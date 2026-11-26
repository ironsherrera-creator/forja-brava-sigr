import { Bell } from 'lucide-react';
import { Dropdown } from '../ui/Dropdown';

export function NotificationButton({ count = 0 }) {
  return (
    <Dropdown
      align="right"
      menuLabel="Notificaciones"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={
            count > 0
              ? `Notificaciones (${count} sin leer)`
              : 'Notificaciones'
          }
          className="relative inline-flex items-center justify-center h-9 w-9 rounded-[var(--radius-sm)] border border-border-subtle bg-surface hover:bg-surface-muted text-text-primary transition-colors cursor-pointer"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-fire text-white text-[9px] font-bold flex items-center justify-center">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      )}
    >
      <div className="px-4 py-3 w-[260px]">
        <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-coffee">
          Centro de alertas
        </p>
        <p className="m-0 mt-2 text-xs leading-relaxed text-text-secondary">
          No hay notificaciones pendientes. Las alertas en tiempo real de pedidos y reservas se conectarán en etapas operativas posteriores.
        </p>
      </div>
    </Dropdown>
  );
}
