import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  LockOpen,
  Receipt,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Select,
  Table,
  Tabs,
  Textarea,
} from '../../components/ui';
import { PAYMENT_METHODS_LIST } from '../../schemas/cashSchemas';
import {
  closeActiveCashSession,
  confirmIndividualOrderPayment,
  fetchCashSnapshot,
  openCashSession,
  settleTableAccountPayment,
} from '../../services/cashService';
import {
  calculateCashDifference,
  calculateCashSessionSummary,
  validateCashReceived,
} from '../../utils/cashCalculations';
import { formatDateTimeBogota } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';

const CASH_TABS = [
  { id: 'overview', label: 'Resumen y Pagos' },
  { id: 'arqueo', label: 'Arqueo y Cierre' },
  { id: 'history', label: 'Historial de Sesiones' },
];

export function AdminCashPage({ defaultTab = 'overview' }) {
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Apertura
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [openingBusy, setOpeningBusy] = useState(false);

  // Cobro de cuenta o pedido
  const [payMethodById, setPayMethodById] = useState({});
  const [cashReceivedById, setCashReceivedById] = useState({});
  const [payBusyId, setPayBusyId] = useState(null);

  // Arqueo y cierre
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [closingBusy, setClosingBusy] = useState(false);

  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchCashSnapshot();
    if (res.error) setError(res.error);
    else {
      setSnapshot(res.data);
      setError(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchCashSnapshot().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setSnapshot(res.data);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const activeSession = snapshot?.activeSession || null;
  const summary = useMemo(
    () => calculateCashSessionSummary(activeSession, snapshot?.activeMovements ?? []),
    [activeSession, snapshot?.activeMovements],
  );

  const liveDifference = useMemo(
    () =>
      countedCash === ''
        ? null
        : calculateCashDifference(Number(countedCash), summary.expectedCash),
    [countedCash, summary.expectedCash],
  );

  const handleOpenSession = async (event) => {
    event.preventDefault();
    setOpeningBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await openCashSession({
        openingBalance: Number(openingBalance),
        notes: openingNotes,
      });
      if (res.error) {
        setActionError(res.error.message);
        return;
      }
      setActionSuccess(
        `Turno de caja abierto con saldo inicial de ${formatMoney(res.data.opening_balance)}.`,
      );
      setOpeningBalance('0');
      setOpeningNotes('');
      load();
    } finally {
      setOpeningBusy(false);
    }
  };

  const handleSettleAccount = async (acc) => {
    const method = payMethodById[acc.id] || 'Efectivo';
    const received = method === 'Efectivo' ? cashReceivedById[acc.id] ?? '' : '';
    const check = validateCashReceived({
      method,
      receivedInput: received,
      amountDue: acc.total_amount,
    });
    if (!check.valid) {
      setActionError(check.error);
      return;
    }

    setPayBusyId(acc.id);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await settleTableAccountPayment(
        acc.id,
        method,
        check.receivedAmount,
        acc.total_amount,
      );
      if (res.error) {
        setActionError(res.error.message);
      } else {
        setActionSuccess(
          `Cuenta de Mesa ${acc.table?.code || ''} cobrada (${method}) por ${formatMoney(acc.total_amount)}${
            check.receivedAmount !== null ? ` · Cambio: ${formatMoney(check.change)}` : ''
          } y mesa liberada.`,
        );
        setCashReceivedById((p) => ({ ...p, [acc.id]: '' }));
        load();
      }
    } finally {
      setPayBusyId(null);
    }
  };

  const handleConfirmOrderPay = async (order) => {
    const method = payMethodById[order.id] || 'Efectivo';
    const received = method === 'Efectivo' ? cashReceivedById[order.id] ?? '' : '';
    const check = validateCashReceived({
      method,
      receivedInput: received,
      amountDue: order.total,
    });
    if (!check.valid) {
      setActionError(check.error);
      return;
    }

    setPayBusyId(order.id);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await confirmIndividualOrderPayment(
        order.id,
        method,
        check.receivedAmount,
        order.total,
      );
      if (res.error) {
        setActionError(res.error.message);
      } else {
        setActionSuccess(
          `Pago del pedido ${order.order_number} confirmado (${method}) por ${formatMoney(order.total)}${
            check.receivedAmount !== null ? ` · Cambio: ${formatMoney(check.change)}` : ''
          }.`,
        );
        setCashReceivedById((p) => ({ ...p, [order.id]: '' }));
        load();
      }
    } finally {
      setPayBusyId(null);
    }
  };

  const handleConfirmCloseSession = async () => {
    if (!activeSession) return;
    setClosingBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await closeActiveCashSession(activeSession.id, {
        countedCash: Number(countedCash),
        notes: closeNotes,
      });
      if (res.error) {
        setActionError(res.error.message);
      } else {
        setActionSuccess(
          `Sesión de caja cerrada correctamente. Diferencia registrada: ${formatMoney(res.data.difference)}.`,
        );
        setCountedCash('');
        setCloseNotes('');
        setActiveTab('history');
        load();
      }
      setConfirmCloseOpen(false);
    } finally {
      setClosingBusy(false);
    }
  };

  const historyColumns = [
    {
      key: 'opened_at',
      header: 'Apertura / Cierre (Bogotá)',
      render: (row) => (
        <div className="text-xs">
          <strong>{formatDateTimeBogota(row.opened_at)}</strong>
          <p className="m-0 text-text-muted">
            {row.closed_at ? formatDateTimeBogota(row.closed_at) : 'Turno en curso'}
          </p>
        </div>
      ),
    },
    {
      key: 'opening_balance',
      header: 'Base inicial',
      render: (row) => <span className="text-xs">{formatMoney(row.opening_balance)}</span>,
    },
    {
      key: 'expected_cash',
      header: 'Efectivo esperado',
      render: (row) => (
        <span className="text-xs">
          {row.expected_cash != null ? formatMoney(row.expected_cash) : '—'}
        </span>
      ),
    },
    {
      key: 'counted_cash',
      header: 'Contado',
      render: (row) => (
        <span className="text-xs">
          {row.counted_cash != null ? formatMoney(row.counted_cash) : '—'}
        </span>
      ),
    },
    {
      key: 'difference',
      header: 'Diferencia',
      render: (row) => {
        if (row.difference == null) return <span className="text-xs text-text-muted">—</span>;
        const diff = Number(row.difference);
        return (
          <Badge variant={diff === 0 ? 'success' : diff < 0 ? 'error' : 'warning'}>
            {diff > 0 ? '+' : ''}
            {formatMoney(diff)}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={row.status === 'open' ? 'success' : 'info'}>
          {row.status === 'open' ? 'Abierta' : 'Cerrada'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 10 · CAJA Y CONCILIACIÓN"
        title="Gestión de"
        accent="caja."
        description="Control de turno único de caja (open_cash_session), cobro atómico de cuentas de mesa (D-04) y pedidos, arqueo físico separado de pagos digitales y cierre auditable."
        badge={
          <Badge variant={activeSession ? 'success' : 'warning'}>
            {activeSession ? 'Caja abierta' : 'Caja cerrada'}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/pedidos?estado=Cancelado"
              className="inline-flex items-center h-9 px-3 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
            >
              Reembolsos de pedidos
            </Link>
            <Link
              to="/admin/movimientos"
              className="inline-flex items-center h-9 px-3 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
            >
              Movimientos
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Actualizar
            </Button>
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

      {error ? (
        <ErrorState
          title="No fue posible cargar Caja"
          description={error.message}
          onRetry={load}
        />
      ) : isLoading ? (
        <LoadingState title="Cargando estado de caja y cuentas pendientes…" />
      ) : (
        <>
          <Tabs
            tabs={CASH_TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
            ariaLabel="Secciones de Caja"
          />

          {activeTab === 'overview' && (
            <div className="space-y-6">
              {!activeSession ? (
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <LockOpen className="h-5 w-5 text-fire" aria-hidden="true" />
                    <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display">
                      Abrir turno de caja
                    </h2>
                  </div>
                  <p className="m-0 mb-4 text-xs text-text-secondary">
                    No existe una sesión abierta. Registra la base inicial para habilitar cobros en efectivo, cuentas de mesa y pagos digitales simulados.
                  </p>
                  <form onSubmit={handleOpenSession} noValidate className="grid gap-4 sm:grid-cols-2">
                    <FormField id="cash-open-balance" label="Saldo inicial en efectivo (COP)" required>
                      <Input
                        id="cash-open-balance"
                        type="number"
                        min={0}
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                      />
                    </FormField>
                    <FormField id="cash-open-notes" label="Observaciones de apertura (opcional)">
                      <Input
                        id="cash-open-notes"
                        value={openingNotes}
                        onChange={(e) => setOpeningNotes(e.target.value)}
                        placeholder="Ej. Turno tarde"
                      />
                    </FormField>
                    <div className="sm:col-span-2">
                      <Button type="submit" loading={openingBusy} leftIcon={<Wallet className="h-4 w-4" />}>
                        Abrir sesión de caja
                      </Button>
                    </div>
                  </form>
                </Card>
              ) : (
                <>
                  {/* KPIs de sesión activa */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                        Saldo inicial
                      </p>
                      <p className="m-0 mt-1 text-2xl font-medium text-text-primary sigr-heading-display">
                        {formatMoney(summary.openingBalance)}
                      </p>
                      <p className="m-0 mt-1 text-[11px] text-text-muted">
                        {formatDateTimeBogota(activeSession.opened_at)}
                      </p>
                    </Card>
                    <Card>
                      <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                        Efectivo esperado físico
                      </p>
                      <p className="m-0 mt-1 text-2xl font-medium text-fire sigr-heading-display">
                        {formatMoney(summary.expectedCash)}
                      </p>
                      <p className="m-0 mt-1 text-[11px] text-text-muted">
                        Ventas efec: {formatMoney(summary.cashSales)}
                      </p>
                    </Card>
                    <Card>
                      <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                        Ventas digitales netas
                      </p>
                      <p className="m-0 mt-1 text-2xl font-medium text-success sigr-heading-display">
                        {formatMoney(summary.netDigitalSales)}
                      </p>
                      <p className="m-0 mt-1 text-[11px] text-text-muted">
                        Tarjeta / Nequi / PSE (no suman efectivo)
                      </p>
                    </Card>
                    <Card>
                      <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                        Ingresos / Egresos manuales
                      </p>
                      <p className="m-0 mt-1 text-lg font-semibold text-text-primary">
                        +{formatMoney(summary.manualIncomeCash)} / -{formatMoney(summary.manualExpenseCash)}
                      </p>
                    </Card>
                  </div>

                  {/* Cobro de cuentas de mesa (D-04) */}
                  <Card>
                    <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-3">
                      Cuentas de mesa abiertas / pendientes de cierre (D-04)
                    </h2>
                    {(snapshot?.openAccounts ?? []).length === 0 ? (
                      <EmptyState
                        icon={<Receipt className="h-5 w-5" />}
                        title="Sin cuentas de mesa pendientes"
                        description="Las cuentas abiertas por el mesero aparecerán aquí para cobro consolidado."
                      />
                    ) : (
                      <div className="space-y-3">
                        {snapshot.openAccounts.map((acc) => {
                          const method = payMethodById[acc.id] || 'Efectivo';
                          const received = method === 'Efectivo' ? cashReceivedById[acc.id] ?? '' : '';
                          const cashCheck = validateCashReceived({
                            method,
                            receivedInput: received,
                            amountDue: acc.total_amount,
                          });

                          return (
                            <div
                              key={acc.id}
                              className="p-4 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated flex flex-wrap items-end justify-between gap-4"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <strong className="text-base text-text-primary">
                                    Mesa {acc.table?.code || '—'} ({acc.table?.zone || 'Salón'})
                                  </strong>
                                  <Badge
                                    variant={acc.status === 'closing_requested' ? 'warning' : 'info'}
                                  >
                                    {acc.status === 'closing_requested'
                                      ? 'Cierre solicitado'
                                      : 'Abierta'}
                                  </Badge>
                                </div>
                                <p className="m-0 mt-1 text-xs text-text-secondary">
                                  Total consolidado:{' '}
                                  <strong className="text-fire text-sm">
                                    {formatMoney(acc.total_amount)}
                                  </strong>
                                </p>
                              </div>

                              <div className="flex flex-wrap items-start gap-2">
                                <Select
                                  aria-label={`Método de pago Mesa ${acc.table?.code || ''}`}
                                  value={method}
                                  onChange={(e) => {
                                    const nextMethod = e.target.value;
                                    setPayMethodById((p) => ({ ...p, [acc.id]: nextMethod }));
                                    if (nextMethod !== 'Efectivo') {
                                      setCashReceivedById((p) => ({ ...p, [acc.id]: '' }));
                                    }
                                  }}
                                  options={PAYMENT_METHODS_LIST.map((m) => ({
                                    value: m,
                                    label: m,
                                  }))}
                                />
                                {method === 'Efectivo' && (
                                  <div className="w-44">
                                    <Input
                                      type="number"
                                      min={0}
                                      placeholder="Recibido"
                                      aria-label={`Efectivo recibido Mesa ${acc.table?.code || ''}`}
                                      value={received}
                                      onChange={(e) =>
                                        setCashReceivedById((p) => ({
                                          ...p,
                                          [acc.id]: e.target.value,
                                        }))
                                      }
                                    />
                                    {!cashCheck.valid ? (
                                      <p className="m-0 mt-1 text-[11px] text-error font-medium">
                                        {cashCheck.error}
                                      </p>
                                    ) : (
                                      received !== '' && (
                                        <span className="block mt-1 text-[11px] text-success font-semibold">
                                          Cambio: {formatMoney(cashCheck.change)}
                                        </span>
                                      )
                                    )}
                                  </div>
                                )}
                                <Button
                                  loading={payBusyId === acc.id}
                                  disabled={!cashCheck.valid}
                                  onClick={() => handleSettleAccount(acc)}
                                  leftIcon={<CheckCircle2 className="h-4 w-4" />}
                                >
                                  Cobrar y cerrar cuenta
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  {/* Pedidos individuales pendientes de cobro (Efectivo domicilio / recoger) */}
                  <Card>
                    <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-3">
                      Pedidos individuales pendientes de pago
                    </h2>
                    {(snapshot?.pendingOrders ?? []).length === 0 ? (
                      <p className="m-0 text-xs text-text-muted">
                        No hay pedidos de domicilio o recoger pendientes de confirmación de pago.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {snapshot.pendingOrders.map((ord) => {
                          const method = payMethodById[ord.id] || 'Efectivo';
                          const received = method === 'Efectivo' ? cashReceivedById[ord.id] ?? '' : '';
                          const cashCheck = validateCashReceived({
                            method,
                            receivedInput: received,
                            amountDue: ord.total,
                          });

                          return (
                            <div
                              key={ord.id}
                              className="p-3.5 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated flex flex-wrap items-start justify-between gap-3"
                            >
                              <div>
                                <strong className="text-sm text-text-primary">
                                  {ord.order_number}
                                </strong>
                                <p className="m-0 text-xs text-text-secondary">
                                  {ord.customer_name} · <span className="capitalize">{ord.modality}</span> ·{' '}
                                  <strong className="text-fire">{formatMoney(ord.total)}</strong>
                                </p>
                              </div>
                              <div className="flex flex-wrap items-start gap-2">
                                <Select
                                  aria-label={`Método pago ${ord.order_number}`}
                                  value={method}
                                  onChange={(e) => {
                                    const nextMethod = e.target.value;
                                    setPayMethodById((p) => ({ ...p, [ord.id]: nextMethod }));
                                    if (nextMethod !== 'Efectivo') {
                                      setCashReceivedById((p) => ({ ...p, [ord.id]: '' }));
                                    }
                                  }}
                                  options={PAYMENT_METHODS_LIST.map((m) => ({
                                    value: m,
                                    label: m,
                                  }))}
                                />
                                {method === 'Efectivo' && (
                                  <div className="w-40">
                                    <Input
                                      type="number"
                                      min={0}
                                      placeholder="Recibido"
                                      aria-label={`Efectivo recibido ${ord.order_number}`}
                                      value={received}
                                      onChange={(e) =>
                                        setCashReceivedById((p) => ({
                                          ...p,
                                          [ord.id]: e.target.value,
                                        }))
                                      }
                                    />
                                    {!cashCheck.valid ? (
                                      <p className="m-0 mt-1 text-[11px] text-error font-medium">
                                        {cashCheck.error}
                                      </p>
                                    ) : (
                                      received !== '' && (
                                        <span className="block mt-1 text-[11px] text-success font-semibold">
                                          Cambio: {formatMoney(cashCheck.change)}
                                        </span>
                                      )
                                    )}
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  loading={payBusyId === ord.id}
                                  disabled={!cashCheck.valid}
                                  onClick={() => handleConfirmOrderPay(ord)}
                                >
                                  Confirmar cobro
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </>
              )}
            </div>
          )}

          {activeTab === 'arqueo' && (
            <Card className="space-y-5">
              <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display">
                Arqueo y cierre de sesión de caja
              </h2>
              {!activeSession ? (
                <p className="m-0 text-xs text-text-secondary">
                  No hay una sesión abierta para arquear o cerrar.
                </p>
              ) : (
                <>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs p-4 rounded-[var(--radius-sm)] bg-cream border border-border-subtle">
                    <div>
                      <dt className="text-text-muted">Saldo inicial</dt>
                      <dd className="m-0 font-bold text-sm">{formatMoney(summary.openingBalance)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">+ Ventas en efectivo</dt>
                      <dd className="m-0 font-bold text-sm">{formatMoney(summary.cashSales)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">- Reembolsos en efectivo</dt>
                      <dd className="m-0 font-bold text-sm">{formatMoney(summary.cashRefunds)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">+ Ingresos manuales efectivo</dt>
                      <dd className="m-0 font-bold text-sm">{formatMoney(summary.manualIncomeCash)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">- Egresos manuales efectivo</dt>
                      <dd className="m-0 font-bold text-sm">{formatMoney(summary.manualExpenseCash)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">= Efectivo físico esperado</dt>
                      <dd className="m-0 font-bold text-base text-fire">{formatMoney(summary.expectedCash)}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Pagos digitales netos (Tarjeta/Nequi/PSE)</dt>
                      <dd className="m-0 font-bold text-sm text-success">{formatMoney(summary.netDigitalSales)}</dd>
                    </div>
                  </dl>

                  {(snapshot?.openAccounts ?? []).length > 0 && (
                    <div className="p-3 rounded-[var(--radius-sm)] bg-warning-bg border border-warning-border text-xs text-warning">
                      Aviso: Existen {snapshot.openAccounts.length} cuenta(s) de mesa abiertas. Cerrar la sesión de caja NO cierra ni cobra automáticamente las cuentas de mesa.
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField id="cash-counted" label="Efectivo físico contado (COP)" required>
                      <Input
                        id="cash-counted"
                        type="number"
                        min={0}
                        value={countedCash}
                        onChange={(e) => setCountedCash(e.target.value)}
                      />
                    </FormField>

                    <div className="flex flex-col justify-center">
                      <span className="text-xs text-text-secondary">Diferencia de arqueo</span>
                      <strong
                        className={`text-2xl sigr-heading-display ${
                          liveDifference === null
                            ? 'text-text-muted'
                            : liveDifference === 0
                              ? 'text-success'
                              : 'text-error'
                        }`}
                      >
                        {liveDifference === null
                          ? '—'
                          : `${liveDifference > 0 ? '+' : ''}${formatMoney(liveDifference)}`}
                      </strong>
                    </div>
                  </div>

                  <FormField id="cash-close-notes" label="Observaciones de cierre">
                    <Textarea
                      id="cash-close-notes"
                      rows={2}
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      placeholder="Justificación de diferencias o notas del turno"
                    />
                  </FormField>

                  <Button
                    variant="danger"
                    disabled={countedCash === ''}
                    onClick={() => setConfirmCloseOpen(true)}
                    leftIcon={<Lock className="h-4 w-4" />}
                  >
                    Cerrar sesión de caja
                  </Button>
                </>
              )}
            </Card>
          )}

          {activeTab === 'history' && (
            <Card>
              <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-4">
                Historial de sesiones de caja
              </h2>
              {(snapshot?.sessions ?? []).length === 0 ? (
                <EmptyState
                  icon={<Wallet className="h-5 w-5" />}
                  title="Sin sesiones registradas"
                  description="Las aperturas y cierres de caja aparecerán aquí para consulta."
                />
              ) : (
                <Table
                  caption="Historial de sesiones de caja"
                  columns={historyColumns}
                  data={snapshot.sessions}
                />
              )}
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        onConfirm={handleConfirmCloseSession}
        loading={closingBusy}
        title="Confirmar cierre definitivo de caja"
        description={`Efectivo esperado: ${formatMoney(summary.expectedCash)} · Contado: ${formatMoney(Number(countedCash) || 0)} · Diferencia: ${formatMoney(liveDifference || 0)}. Esta operación queda auditada y no puede revertirse.`}
        confirmLabel="Cerrar caja ahora"
      />
    </div>
  );
}
