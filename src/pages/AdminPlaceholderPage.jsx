import {
  Armchair,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Settings,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge, Card, EmptyState } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

const ADMIN_MODULES = [
  { to: '/admin/pedidos', title: 'Pedidos', desc: 'Control de preparación y estados de órdenes.', icon: ClipboardList },
  { to: '/admin/reservas', title: 'Reservas', desc: 'Calendario y asignación automática de mesas.', icon: CalendarClock },
  { to: '/admin/mesas', title: 'Mesas', desc: 'Inventario dinámico por zona y capacidad.', icon: Armchair },
  { to: '/admin/productos', title: 'Productos', desc: 'Catálogo, precios, disponibilidad y complementos.', icon: UtensilsCrossed },
  { to: '/admin/usuarios', title: 'Usuarios', desc: 'Gestión de cuentas, roles y estado activo.', icon: Users },
  { to: '/admin/caja', title: 'Caja', desc: 'Apertura, cobros consolidados, reembolsos y arqueo.', icon: Wallet },
  { to: '/admin/reportes', title: 'Reportes', desc: 'Indicadores de ventas y operación diaria.', icon: BarChart3 },
  { to: '/admin/configuracion', title: 'Configuración', desc: 'Horarios, tarifa fija y parámetros globales.', icon: Settings },
];

export function AdminPlaceholderPage() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="FORJA BRAVA · SIGR ADMINISTRACIÓN"
        title="Panel"
        accent="Administrativo."
        description={`Sesión verificada de ${profile?.full_name || 'Administrador'}. Accede a los módulos de operación, catálogo, personal, finanzas y control.`}
        badge={<Badge variant="wood">Control total · RLS</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.to}
              to={mod.to}
              className="group block p-5 bg-surface border border-border-subtle rounded-[var(--radius-sm)] hover:border-fire transition-colors shadow-[var(--shadow-xs)]"
            >
              <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-surface-muted text-coffee group-hover:bg-fire group-hover:text-white flex items-center justify-center transition-colors mb-3">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <h2 className="m-0 text-base font-medium text-text-primary sigr-heading-display">
                {mod.title}
              </h2>
              <p className="m-0 mt-1 text-xs text-text-secondary leading-relaxed">
                {mod.desc}
              </p>
            </Link>
          );
        })}
      </div>

      <Card>
        <EmptyState
          title="Indicadores en vivo pendientes de etapa operativa"
          description="La estructura administrativa, navegación agrupada y control de acceso por rol ya están activos. Los KPIs y tablas operativas se conectarán progresivamente en las próximas etapas."
        />
      </Card>
    </div>
  );
}
