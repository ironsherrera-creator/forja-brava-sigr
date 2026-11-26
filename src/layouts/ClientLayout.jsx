import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ContentContainer } from '../components/layout/ContentContainer';
import { MobileDrawer } from '../components/navigation/MobileDrawer';
import { Sidebar } from '../components/navigation/Sidebar';
import { Topbar } from '../components/navigation/Topbar';
import { CLIENT_NAV_GROUPS } from '../config/navigation';

export function ClientLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="sigr-app-shell flex min-h-screen">
      <Sidebar
        subtitle="ÁREA CLIENTE"
        brandTo="/cliente"
        groups={CLIENT_NAV_GROUPS}
        ariaLabel="Navegación del cliente"
      />

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        subtitle="ÁREA CLIENTE"
        brandTo="/cliente"
        groups={CLIENT_NAV_GROUPS}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          areaTitle="FORJA BRAVA · Área del Cliente"
          showBreadcrumbs
          profilePath="/cliente/perfil"
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
