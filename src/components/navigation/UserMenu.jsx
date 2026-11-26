import { ChevronDown, ExternalLink, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../utils/rbac';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Dropdown } from '../ui/Dropdown';
import { LogoutButton } from './LogoutButton';

const ROLE_LABELS = {
  [ROLES.CLIENTE]: 'Cliente',
  [ROLES.MESERO]: 'Mesero',
  [ROLES.ADMINISTRADOR]: 'Administrador',
};

export function UserMenu({ profilePath = null }) {
  const { profile, role } = useAuth();
  const displayName = profile?.full_name?.trim() || profile?.email || 'Usuario';
  const roleLabel = ROLE_LABELS[role] || role || 'Cuenta';

  return (
    <Dropdown
      align="right"
      menuLabel="Menú de usuario"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className="inline-flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--radius-sm)] border border-transparent hover:border-border-subtle hover:bg-surface-muted/70 transition-colors cursor-pointer bg-transparent text-left"
        >
          <Avatar name={displayName} size="sm" />
          <span className="hidden sm:flex flex-col leading-tight max-w-[160px]">
            <span className="text-xs font-semibold text-text-primary truncate">
              {displayName}
            </span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
              {roleLabel}
            </span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="px-3.5 py-2.5 border-b border-border-subtle">
            <p className="m-0 text-xs font-semibold text-text-primary truncate">
              {displayName}
            </p>
            {profile?.email && (
              <p className="m-0 mt-0.5 text-[11px] text-text-muted truncate">
                {profile.email}
              </p>
            )}
            <div className="mt-2">
              <Badge variant="wood">{roleLabel}</Badge>
            </div>
          </div>

          <div className="py-1">
            {profilePath && (
              <Link
                to={profilePath}
                role="menuitem"
                onClick={close}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-primary hover:bg-surface-muted transition-colors"
              >
                <User className="h-4 w-4 text-wood" aria-hidden="true" />
                <span>Mi perfil</span>
              </Link>
            )}
            <Link
              to="/"
              role="menuitem"
              onClick={close}
              className="flex items-center gap-2.5 px-3.5 py-2 text-xs text-text-primary hover:bg-surface-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-wood" aria-hidden="true" />
              <span>Ir al sitio público</span>
            </Link>
          </div>

          <div className="pt-1 border-t border-border-subtle">
            <LogoutButton variant="menu" onAfterSignOut={close} />
          </div>
        </div>
      )}
    </Dropdown>
  );
}
