import { Menu } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { OfflineBanner } from '../ui/OfflineBanner';
import { Breadcrumbs } from './Breadcrumbs';
import { NotificationButton } from './NotificationButton';
import { UserMenu } from './UserMenu';

export function Topbar({
  areaTitle,
  showBreadcrumbs = true,
  showNotifications = false,
  profilePath = null,
  quickActions = null,
  onOpenMobileMenu,
}) {
  return (
    <div className="sticky top-0 z-[var(--z-topbar)]">
      <OfflineBanner />
      <header className="h-[var(--topbar-height)] px-4 sm:px-6 lg:px-8 sigr-topbar-surface flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="lg:hidden">
            <IconButton
              icon={<Menu className="h-5 w-5" aria-hidden="true" />}
              label="Abrir menú de navegación"
              variant="outline"
              size="md"
              onClick={onOpenMobileMenu}
            />
          </div>

          <div className="min-w-0">
            {areaTitle && (
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-wood truncate">
                {areaTitle}
              </p>
            )}
            {showBreadcrumbs && <Breadcrumbs className="mt-0.5" />}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {quickActions}
          {showNotifications && <NotificationButton count={0} />}
          <UserMenu profilePath={profilePath} />
        </div>
      </header>
    </div>
  );
}
