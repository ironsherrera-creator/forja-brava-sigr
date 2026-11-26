import { Armchair, History, PlusCircle, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge, Card, EmptyState } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

const WAITER_ACTIONS = [
  {
    to: '/mesero/mesas',
    title: 'Mapa de mesas',
    desc: 'Consulta ocupación, reservas inminentes y cuentas abiertas por zona.',
    icon: Armchair,
  },
  {
    to: '/mesero/nuevo-pedido',
    title: 'Tomar pedido',
    desc: 'Registra comandas de salón vinculadas a la cuenta acumulada de la mesa.',
    icon: PlusCircle,
  },
  {
    to: '/mesero/pedidos',
    title: 'Pedidos en curso',
    desc: 'Marca pedidos listos como entregados o cancela únicamente en estado Pendiente.',
    icon: Receipt,
  },
  {
    to: '/mesero/historial',
    title: 'Historial de turno',
    desc: 'Revisa las comandas atendidas durante la jornada operativa.',
    icon: History,
  },
];

export function WaiterPlaceholderPage() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="FORJA BRAVA · SERVICIO EN SALÓN"
        title="Operación de"
        accent="Mesero."
        description={`Bienvenido, ${profile?.full_name || 'equipo de salón'}. Interfaz táctil diseñada para velocidad en mesa y control de entregas.`}
        badge={<Badge variant="fire">Turno operativo</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {WAITER_ACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group flex items-start gap-4 p-5 bg-surface border border-border-subtle rounded-[var(--radius-sm)] hover:border-fire transition-colors shadow-[var(--shadow-xs)] min-h-[104px]"
            >
              <div className="h-11 w-11 rounded-[var(--radius-sm)] bg-coffee text-cream group-hover:bg-fire flex items-center justify-center shrink-0 transition-colors">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="m-0 text-lg font-medium text-text-primary sigr-heading-display">
                  {item.title}
                </h2>
                <p className="m-0 mt-1 text-xs text-text-secondary leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <Card>
        <EmptyState
          title="Sin comandas activas conectadas todavía"
          description="El tablero en tiempo real de mesas, alertas de entrega y cuentas acumuladas se habilitará en las siguientes etapas operativas sin alterar esta estructura."
        />
      </Card>
    </div>
  );
}
