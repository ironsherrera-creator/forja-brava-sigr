import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { IconButton } from '../ui/IconButton';
import { LogoutButton } from './LogoutButton';
import { SidebarGroup } from './SidebarGroup';

export function Sidebar({
  subtitle = 'SIGR',
  brandTo = '/',
  groups = [],
  collapsed = false,
  collapsible = false,
  onToggleCollapse,
  largeTouch = false,
  ariaLabel = 'Navegación lateral',
  footerSlot = null,
}) {
  return (
    <aside
      aria-label={ariaLabel}
      className={[
        'hidden lg:flex flex-col shrink-0 sigr-sidebar-surface sticky top-0 h-screen',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]',
      ].join(' ')}
    >
      <div
        className={[
          'h-[var(--topbar-height)] flex items-center border-b border-sand/15 px-4',
          collapsed ? 'justify-center' : 'justify-between gap-2',
        ].join(' ')}
      >
        {!collapsed ? (
          <BrandLogo to={brandTo} subtitle={subtitle} />
        ) : (
          <span
            aria-label="FORJA BRAVA"
            className="brand-mark !w-9 !h-9 !text-[22px]"
          >
            F<span>B</span>
          </span>
        )}

        {collapsible && !collapsed && (
          <IconButton
            icon={<PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            label="Contraer menú lateral"
            variant="dark"
            size="sm"
            onClick={onToggleCollapse}
          />
        )}
      </div>

      {collapsible && collapsed && (
        <div className="flex justify-center pt-3">
          <IconButton
            icon={<PanelLeftOpen className="h-4 w-4" aria-hidden="true" />}
            label="Expandir menú lateral"
            variant="dark"
            size="sm"
            onClick={onToggleCollapse}
          />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <SidebarGroup
            key={group.id}
            label={group.label}
            items={group.items}
            collapsed={collapsed}
            largeTouch={largeTouch}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-sand/15 space-y-2">
        {footerSlot}
        <LogoutButton
          compact={collapsed}
          className="w-full"
        />
      </div>
    </aside>
  );
}
