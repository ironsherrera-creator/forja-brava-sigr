import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Armchair,
  CalendarClock,
  ClipboardList,
  RefreshCw,
  Settings,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, Card, ErrorState, LoadingState } from '../../components/ui';
import { fetchAdminDashboardMetrics } from '../../services/adminDashboardService';
import { formatMoney } from '../../utils/formatMoney';

export function AdminDashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchAdminDashboardMetrics();
    if (res.error) {
      setError(res.error);
    } else {
      setMetrics(res.data);
      setError(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchAdminDashboardMetrics().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setMetrics(res.data);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 9 · ADMINISTRACIÓN GENERAL"
        title="Panel"
        accent="administrativo."
        description={`Indicadores operativos calculados en tiempo real desde Supabase (fecha local America/Bogota: ${metrics?.todayIso || 'hoy'}).`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Actualizar
          </Button>
        }
      />

      {error ? (
        <ErrorState
          title="No fue posible cargar los indicadores"
          description={error.message}
          onRetry={load}
        />
      ) : isLoading || !metrics ? (
        <LoadingState title="Calculando métricas reales del restaurante…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Ventas del día
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-fire sigr-heading-display">
                {formatMoney(metrics.dailySales)}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Pedidos del día
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-text-primary sigr-heading-display">
                {metrics.dailyOrdersCount}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Ticket promedio
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-wood sigr-heading-display">
                {formatMoney(metrics.avgTicket)}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Mesas ocupadas
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-fire sigr-heading-display">
                {metrics.occupiedTables}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Reservas del día
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-text-primary sigr-heading-display">
                {metrics.todayReservations}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Cuentas activas / Por cerrar
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-text-primary sigr-heading-display">
                {metrics.activeAccounts}{' '}
                <span className="text-base text-warning">
                  ({metrics.pendingCloseAccounts} por cerrar)
                </span>
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Productos activos
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-success sigr-heading-display">
                {metrics.activeProducts}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Usuarios activos
              </p>
              <p className="m-0 mt-1 text-3xl font-medium text-text-primary sigr-heading-display">
                {metrics.activeUsers}
              </p>
            </Card>
          </div>

          <Card>
            <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-4">
              Módulos administrativos integrados
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
                { to: '/admin/productos', label: 'Productos', icon: UtensilsCrossed },
                { to: '/admin/reservas', label: 'Reservas', icon: CalendarClock },
                { to: '/admin/mesas', label: 'Mesas', icon: Armchair },
                { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
                { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
                { to: '/admin/auditoria', label: 'Auditoría', icon: Activity },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="p-3.5 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated hover:border-fire transition-colors flex items-center gap-3"
                  >
                    <Icon className="h-5 w-5 text-fire shrink-0" aria-hidden="true" />
                    <strong className="text-sm text-text-primary">{item.label}</strong>
                  </Link>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
