import { BrandLogo } from '../BrandLogo';
import { Drawer } from '../ui/Drawer';
import { LogoutButton } from './LogoutButton';
import { SidebarGroup } from './SidebarGroup';

export function MobileDrawer({
  open,
  onClose,
  subtitle = 'SIGR',
  brandTo = '/',
  groups = [],
  largeTouch = false,
  footerSlot = null,
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={subtitle}
      side="left"
      tone="dark"
    >
      <div className="flex flex-col h-full">
        <div className="px-4 py-4 border-b border-sand/15">
          <BrandLogo to={brandTo} subtitle={subtitle} />
        </div>

        <nav className="flex-1 px-3 py-4" aria-label="Navegación móvil">
          {groups.map((group) => (
            <SidebarGroup
              key={group.id}
              label={group.label}
              items={group.items}
              largeTouch={largeTouch}
              onNavigate={onClose}
            />
          ))}
        </nav>

        <div className="p-3 border-t border-sand/15 space-y-2">
          {footerSlot}
          <LogoutButton className="w-full" onAfterSignOut={onClose} />
        </div>
      </div>
    </Drawer>
  );
}
