import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ContentContainer } from '../components/layout/ContentContainer';
import { MobileDrawer } from '../components/navigation/MobileDrawer';
import { Sidebar } from '../components/navigation/Sidebar';
import { Topbar } from '../components/navigation/Topbar';
import { ADMIN_NAV_GROUPS } from '../config/navigation';

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="sigr-app-shell flex min-h-screen">
      <Sidebar
        subtitle="SIGR · ADMINISTRACIÓN"
        brandTo="/admin"
        groups={ADMIN_NAV_GROUPS}
        collapsible
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        ariaLabel="Navegación administrativa"
      />

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        subtitle="SIGR · ADMINISTRACIÓN"
        brandTo="/admin"
        groups={ADMIN_NAV_GROUPS}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          areaTitle="FORJA BRAVA · Panel Administrativo"
          showBreadcrumbs
          showNotifications
          onOpenMobileMenu={() => setMobileOpen(true)}
        />

        <main id="contenido" className="flex-1 min-w-0">
          <ContentContainer size="xl">
            <Outlet />
          </ContentContainer>
        </main>
      </div>
    </div>
  );
}
