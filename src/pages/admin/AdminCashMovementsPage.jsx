import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Select,
  Table,
} from '../../components/ui';
import { PAYMENT_METHODS_LIST } from '../../schemas/cashSchemas';
import {
  fetchCashSnapshot,
  registerManualCashMovement,
} from '../../services/cashService';
import { formatDateTimeBogota } from '../../utils/formatDate';
import { formatMoney } from '../../utils/formatMoney';

const TYPE_LABELS = {
  sale: { label: 'Venta', variant: 'success' },
  refund: { label: 'Reembolso', variant: 'error' },
  manual_income: { label: 'Ingreso manual', variant: 'info' },
  manual_expense: { label: 'Egreso manual', variant: 'warning' },
};

export function AdminCashMovementsPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [typeFilter, setTypeFilter] = useState('all');
  const [movementType, setMovementType] = useState('manual_income');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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

  const visibleMovements = useMemo(() => {
    const list = snapshot?.movements ?? [];
    if (typeFilter === 'all') return list;
    return list.filter((m) => m.movement_type === typeFilter);
  }, [snapshot?.movements, typeFilter]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setFormSuccess('');
    try {
      const res = await registerManualCashMovement({
        movementType,
        paymentMethod,
        amount: Number(amount),
        concept,
      });
      if (res.error) {
        setFormError(res.error.message);
        return;
      }
      setFormSuccess(
        `Movimiento registrado de forma inmutable por ${formatMoney(res.data.amount)}.`,
      );
      setAmount('');
      setConcept('');
      load();
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'created_at',
      header: 'Fecha (Bogotá)',
      render: (row) => (
        <span className="text-xs whitespace-nowrap">
          {formatDateTimeBogota(row.created_at)}
        </span>
      ),
    },
    {
      key: 'movement_type',
      header: 'Tipo',
      render: (row) => {
        const meta = TYPE_LABELS[row.movement_type] || {
          label: row.movement_type,
          variant: 'info',
        };
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      key: 'payment_method',
      header: 'Medio',
      render: (row) => <span className="text-xs font-semibold">{row.payment_method}</span>,
    },
    {
      key: 'concept',
      header: 'Concepto',
      render: (row) => <span className="text-xs text-text-secondary">{row.concept}</span>,
    },
    {
      key: 'amount',
      header: 'Importe',
      render: (row) => (
        <strong
          className={
            row.movement_type === 'manual_expense' || row.movement_type === 'refund'
              ? 'text-error'
              : 'text-success'
          }
        >
          {row.movement_type === 'manual_expense' || row.movement_type === 'refund'
            ? '-'
            : '+'}
          {formatMoney(row.amount)}
        </strong>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 10 · MOVIMIENTOS DE CAJA"
        title="Ingresos y"
        accent="egresos."
        description="Registro inmutable (append-only) de ingresos extraordinarios y egresos operativos vía RPC register_cash_movement."
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

      {formError && (
        <div className="auth-alert auth-alert-error" role="alert">
          {formError}
        </div>
      )}
      {formSuccess && (
        <div className="auth-alert auth-alert-success" role="status">
          {formSuccess}
        </div>
      )}

      {snapshot?.activeSession ? (
        <Card>
          <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-4">
            Registrar movimiento manual
          </h2>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField id="mov-type" label="Tipo" required>
              <Select
                id="mov-type"
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                options={[
                  { value: 'manual_income', label: 'Ingreso manual' },
                  { value: 'manual_expense', label: 'Egreso manual' },
                ]}
              />
            </FormField>

            <FormField id="mov-method" label="Medio" required>
              <Select
                id="mov-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={PAYMENT_METHODS_LIST.map((m) => ({ value: m, label: m }))}
              />
            </FormField>

            <FormField id="mov-amount" label="Importe (COP)" required>
              <Input
                id="mov-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormField>

            <FormField id="mov-concept" label="Concepto" required>
              <Input
                id="mov-concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej. Compra de hielo, base adicional"
              />
            </FormField>

            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" loading={saving} leftIcon={<Plus className="h-4 w-4" />}>
                Registrar movimiento
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        !isLoading && (
          <div className="p-4 rounded-[var(--radius-sm)] bg-warning-bg border border-warning-border text-xs text-warning">
            Debes abrir una sesión de caja en /admin/caja antes de registrar ingresos o egresos manuales.
          </div>
        )
      )}

      <Card>
        <div className="max-w-xs mb-4">
          <Select
            aria-label="Filtrar movimientos por tipo"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Todos los movimientos' },
              { value: 'sale', label: 'Ventas' },
              { value: 'refund', label: 'Reembolsos' },
              { value: 'manual_income', label: 'Ingresos manuales' },
              { value: 'manual_expense', label: 'Egresos manuales' },
            ]}
          />
        </div>

        {error ? (
          <ErrorState
            title="No fue posible cargar los movimientos"
            description={error.message}
            onRetry={load}
          />
        ) : isLoading ? (
          <LoadingState title="Cargando movimientos inmutables de caja…" />
        ) : visibleMovements.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight className="h-5 w-5" />}
            title="Sin movimientos registrados"
            description="Los cobros, reembolsos y movimientos manuales aparecerán aquí."
          />
        ) : (
          <Table caption="Movimientos de caja" columns={columns} data={visibleMovements} />
        )}
      </Card>
    </div>
  );
}
