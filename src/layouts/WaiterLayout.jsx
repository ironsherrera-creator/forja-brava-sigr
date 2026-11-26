import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { ContentContainer } from '../components/layout/ContentContainer';
import { MobileDrawer } from '../components/navigation/MobileDrawer';
import { Sidebar } from '../components/navigation/Sidebar';
import { Topbar } from '../components/navigation/Topbar';
import { Badge } from '../components/ui';
import { WAITER_NAV_GROUPS } from '../config/navigation';

export function WaiterLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const quickActions = (
    <Link
      to="/mesero/nuevo-pedido"
      className="inline-flex items-center gap-2 h-10 px-3.5 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
    >
      <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">Tomar pedido</span>
    </Link>
  );

  const footerNote = (
    <div className="px-2.5 py-2 rounded-[var(--radius-xs)] bg-white/5 border border-sand/15 text-[11px] text-sand/80 leading-relaxed">
      <Badge variant="fire" className="mb-1.5">
        Servicio en salón
      </Badge>
      <p className="m-0">
        Cuenta acumulada por mesa · Entrega y cancelación en estado Pendiente.
      </p>
    </div>
  );

  return (
    <div className="sigr-app-shell flex min-h-screen">
      <Sidebar
        subtitle="SERVICIO EN SALÓN"
        brandTo="/mesero"
        groups={WAITER_NAV_GROUPS}
        largeTouch
        ariaLabel="Navegación operativa del mesero"
        footerSlot={footerNote}
      />

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        subtitle="SERVICIO EN SALÓN"
        brandTo="/mesero"
        groups={WAITER_NAV_GROUPS}
        largeTouch
        footerSlot={footerNote}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          areaTitle="FORJA BRAVA · Operación de Mesero"
          showBreadcrumbs
          quickActions={quickActions}
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
