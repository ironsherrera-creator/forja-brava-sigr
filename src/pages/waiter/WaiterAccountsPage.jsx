import { useMemo, useState } from 'react';
import { Receipt, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/ui';
import { useWaiterSalon } from '../../hooks/useWaiterSalon';
import { requestTableAccountClose } from '../../services/waiterService';
import { formatDateTimeBogota } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';

export function WaiterAccountsPage() {
  const { tables, accounts, orders, staffById, isLoading, error, reload } = useWaiterSalon();

  const [closeTarget, setCloseTarget] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const tableById = useMemo(
    () => new Map(tables.map((t) => [t.id, t])),
    [tables],
  );

  const handleConfirmClose = async () => {
    if (!closeTarget) return;
    setRequesting(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await requestTableAccountClose(closeTarget.id);
      if (res.error) {
        setActionError(res.error.message);
      } else {
        setActionSuccess(
          'Solicitud de cierre enviada a Caja. La cuenta queda pendiente de cobro definitivo por el administrador.',
        );
        reload();
      }
      setCloseTarget(null);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 8 · CUENTAS ACUMULADAS (D-04)"
        title="Cuentas"
        accent="activas."
        description="Cada mesa mantiene una única cuenta acumulada. Solicitar el cierre notifica a Caja sin cobrar ni cerrar automáticamente."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Actualizar
          </Button>
        }
      />

      {actionError && (
        <div className="auth-alert auth-alert-error" role="alert">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="auth-alert auth-alert-success" role="status">
          {actionSuccess}
        </div>
      )}

      {error ? (
        <ErrorState
          title="No fue posible cargar las cuentas activas"
          description={error.message}
          onRetry={reload}
        />
      ) : isLoading ? (
        <LoadingState title="Cargando cuentas de mesa…" />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-5 w-5" />}
          title="Sin cuentas activas en este momento"
          description="Las cuentas se abren automáticamente al registrar la primera comanda de una mesa."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => {
            const tbl = tableById.get(acc.table_id);
            const accOrders = orders.filter((o) => o.table_account_id === acc.id);
            const totalUnits = accOrders
              .filter((o) => o.status !== 'Cancelado')
              .reduce(
                (sum, o) =>
                  sum +
                  (o.order_items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0), 0),
                0,
              );
            const isClosing = acc.status === 'closing_requested';

            return (
              <Card key={acc.id} className="flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-wood">
                        {tbl?.zone || 'Salón'}
                      </span>
                      <h2 className="m-0 mt-0.5 text-2xl font-medium text-text-primary sigr-heading-display">
                        Mesa {tbl?.code || '—'}
                      </h2>
                    </div>
                    <Badge variant={isClosing ? 'warning' : 'success'}>
                      {isClosing ? 'Cierre solicitado' : 'Abierta'}
                    </Badge>
                  </div>

                  <dl className="mt-3 space-y-1.5 text-xs">
                    {acc.opened_by && staffById.get(acc.opened_by)?.visible_name && (
                      <div className="flex justify-between">
                        <dt className="text-text-secondary">Mesero responsable</dt>
                        <dd className="m-0 font-medium text-text-primary">
                          {staffById.get(acc.opened_by).visible_name}
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-text-secondary">Apertura</dt>
                      <dd className="m-0 font-medium text-text-primary">
                        {formatDateTimeBogota(acc.opened_at)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-secondary">Pedidos / Productos</dt>
                      <dd className="m-0 font-medium text-text-primary">
                        {accOrders.length} ped. · {totalUnits} prod.
                      </dd>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border-subtle text-sm">
                      <dt className="font-semibold text-text-primary">Total acumulado</dt>
                      <dd className="m-0 font-bold text-fire">
                        {formatMoney(acc.total_amount)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/mesero/mesas/${acc.table_id}`}
                    className="inline-flex items-center h-9 px-3 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
                  >
                    Ver detalle
                  </Link>
                  {!isClosing && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setCloseTarget(acc)}
                    >
                      Solicitar cierre
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(closeTarget)}
        onClose={() => setCloseTarget(null)}
        onConfirm={handleConfirmClose}
        loading={requesting}
        title="Confirmar solicitud de cierre"
        description={`Se enviará a Caja administrativa la solicitud de cierre por ${formatMoney(closeTarget?.total_amount || 0)}. Esta cuenta dejará de aceptar nuevas comandas hasta su liquidación en Caja.`}
        confirmLabel="Enviar solicitud a Caja"
      />
    </div>
  );
}
