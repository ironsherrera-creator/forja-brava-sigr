import { useMemo, useState } from 'react';
import { ArrowLeft, PlusCircle, Receipt, ShieldAlert } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
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
import { getOrderStatusBadgeVariant } from '../../utils/orderStatus';

export function WaiterTableDetailPage() {
  const { id } = useParams();
  const { tables, accounts, orders, staffById, isLoading, error, reload } = useWaiterSalon();

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [requestingClose, setRequestingClose] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const table = useMemo(() => tables.find((t) => t.id === id) || null, [tables, id]);
  const activeAccount = useMemo(
    () => accounts.find((a) => a.table_id === id) || null,
    [accounts, id],
  );
  const accountOrders = useMemo(() => {
    if (!activeAccount) return [];
    return orders.filter((o) => o.table_account_id === activeAccount.id);
  }, [orders, activeAccount]);

  const handleConfirmCloseRequest = async () => {
    if (!activeAccount) return;
    setRequestingClose(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await requestTableAccountClose(activeAccount.id);
      if (res.error) {
        setActionError(res.error.message);
      } else {
        setActionSuccess(
          'Solicitud de cierre enviada a Caja administrativa. La cuenta no se cobra ni se cierra hasta autorización en Caja.',
        );
        reload();
      }
      setCloseModalOpen(false);
    } finally {
      setRequestingClose(false);
    }
  };

  if (isLoading) {
    return <LoadingState title="Cargando detalle de mesa y cuenta…" />;
  }

  if (error || !table) {
    return (
      <ErrorState
        title="Mesa no encontrada"
        description={error?.message || 'No fue posible cargar los datos de la mesa seleccionada.'}
        onRetry={reload}
      />
    );
  }

  const isClosing = activeAccount?.status === 'closing_requested';
  const canTakeOrder =
    table.is_active && table.status !== 'fuera_de_servicio' && !isClosing;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`MESA ${table.code} · ${table.zone}`}
        title="Detalle de"
        accent="mesa y cuenta."
        description={`Capacidad: ${table.capacity} personas · Estado actual: ${table.status}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/mesero/mesas"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Volver al mapa</span>
            </Link>
            {canTakeOrder && (
              <Link
                to={`/mesero/comandas/nueva?mesa=${table.id}`}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                <span>Agregar comanda</span>
              </Link>
            )}
          </div>
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

      {!activeAccount ? (
        <Card>
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="Esta mesa no tiene cuenta activa"
            description="Al registrar la primera comanda se abrirá automáticamente una única cuenta acumulada (D-04)."
            action={
              canTakeOrder ? (
                <Link
                  to={`/mesero/comandas/nueva?mesa=${table.id}`}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
                >
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  <span>Abrir cuenta con primera comanda</span>
                </Link>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display">
                    Cuenta acumulada activa (D-04)
                  </h2>
                  <Badge variant={isClosing ? 'warning' : 'success'}>
                    {isClosing ? 'Cierre solicitado (esperando Caja)' : 'Abierta'}
                  </Badge>
                </div>
                <p className="m-0 mt-1 text-xs text-text-secondary">
                  Abierta el {formatDateTimeBogota(activeAccount.opened_at)} ·{' '}
                  {accountOrders.length}{' '}
                  {accountOrders.length === 1 ? 'pedido asociado' : 'pedidos asociados'}
                  {activeAccount.opened_by && staffById.get(activeAccount.opened_by)?.visible_name
                    ? ` · Mesero: ${staffById.get(activeAccount.opened_by).visible_name}`
                    : ''}
                </p>
              </div>

              <div className="text-right">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Total acumulado
                </span>
                <strong className="text-2xl text-fire sigr-heading-display">
                  {formatMoney(activeAccount.total_amount)}
                </strong>
              </div>
            </div>

            {isClosing ? (
              <div className="mt-4 p-3 rounded-[var(--radius-sm)] bg-warning-bg border border-warning-border text-xs text-warning flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Esta cuenta tiene solicitud de cierre registrada. No admite nuevos pedidos y queda pendiente de cobro definitivo en Caja administrativa.
                </span>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 text-xs text-text-muted">
                  Solicitar el cierre notifica a Caja sin registrar pagos ficticios ni cerrar la cuenta.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setCloseModalOpen(true)}
                  leftIcon={<Receipt className="h-4 w-4" />}
                >
                  Solicitar cierre de cuenta
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-4">
              Pedidos acumulados en esta mesa
            </h2>
            {accountOrders.length === 0 ? (
              <p className="m-0 text-xs text-text-secondary">
                No hay pedidos asociados todavía.
              </p>
            ) : (
              <div className="space-y-4">
                {accountOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong className="text-sm text-text-primary">
                          {ord.order_number}
                        </strong>
                        <span className="ml-2 text-xs text-text-muted">
                          {formatDateTimeBogota(ord.created_at)}
                          {ord.waiter_id && staffById.get(ord.waiter_id)?.visible_name
                            ? ` · ${staffById.get(ord.waiter_id).visible_name}`
                            : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getOrderStatusBadgeVariant(ord.status)}>
                          {ord.status}
                        </Badge>
                        <strong className="text-sm text-fire">
                          {formatMoney(ord.total)}
                        </strong>
                      </div>
                    </div>

                    <ul className="m-0 p-0 list-none space-y-1.5 text-xs">
                      {(ord.order_items ?? []).map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-start justify-between gap-2 border-t border-border-subtle/60 pt-1.5"
                        >
                          <div>
                            <strong className="text-text-primary">
                              {item.quantity} × {item.product_name_snapshot}
                            </strong>
                            {Array.isArray(item.addons_snapshot) &&
                              item.addons_snapshot.length > 0 && (
                                <p className="m-0 text-[11px] text-text-muted">
                                  Complementos:{' '}
                                  {item.addons_snapshot.map((a) => a.name).join(', ')}
                                </p>
                              )}
                            {item.notes && (
                              <p className="m-0 text-[11px] text-wood">
                                Nota: {item.notes}
                              </p>
                            )}
                          </div>
                          <span className="font-semibold text-text-primary">
                            {formatMoney(item.line_total)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {ord.notes && (
                      <p className="m-0 pt-1 text-xs text-text-secondary">
                        Observación general: <em>{ord.notes}</em>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onConfirm={handleConfirmCloseRequest}
        loading={requestingClose}
        title={`Solicitar cierre de cuenta · Mesa ${table.code}`}
        description={`Se enviará a Caja administrativa la solicitud de cierre por ${formatMoney(activeAccount?.total_amount || 0)}. Esta acción bloquea nuevos pedidos en la cuenta pero NO la cobra ni la cierra definitivamente.`}
        confirmLabel="Confirmar solicitud de cierre"
      />
    </div>
  );
}
