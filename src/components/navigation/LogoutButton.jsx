import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function LogoutButton({
  compact = false,
  variant = 'dark',
  redirectTo = '/login',
  onAfterSignOut,
  className = '',
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      onAfterSignOut?.();
      navigate(redirectTo, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const baseClasses =
    variant === 'menu'
      ? 'w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-error hover:bg-error-bg/50 transition-colors cursor-pointer bg-transparent border-0'
      : 'inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-[var(--radius-sm)] text-[11px] font-semibold uppercase tracking-[0.12em] text-sand border border-sand/25 bg-transparent hover:border-fire hover:text-cream hover:bg-fire/15 transition-colors cursor-pointer';

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className={`${baseClasses} ${className}`.trim()}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!compact && <span>{loading ? 'Cerrando…' : 'Cerrar sesión'}</span>}
    </button>
  );
}
