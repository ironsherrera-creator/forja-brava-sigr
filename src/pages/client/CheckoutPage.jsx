import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentContainer } from '../../components/layout/ContentContainer';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  FormField,
  Input,
  Radio,
  Textarea,
} from '../../components/ui';
import { useAddresses } from '../../hooks/useAddresses';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { useRestaurantSettings } from '../../hooks/useRestaurantSettings';
import { extractFieldErrors } from '../../schemas/authSchemas';
import { checkoutSchema } from '../../schemas/clientSchemas';
import { createTransactionalOrder } from '../../services/orderService';
import { calculateLineTotal } from '../../utils/cartUtils';
import { formatMoney } from '../../utils/formatMoney';

function generateClientRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const PAYMENT_METHODS = [
  {
    value: 'Efectivo',
    label: 'Efectivo',
    description: 'Pago al recibir o recoger. Queda en estado Pendiente hasta confirmación en Caja.',
  },
  {
    value: 'Tarjeta',
    label: 'Tarjeta (simulación controlada)',
    description: 'No solicita ni almacena datos bancarios reales.',
  },
  {
    value: 'Nequi',
    label: 'Nequi (simulación controlada)',
    description: 'Simulación demostrativa sin transacción financiera real.',
  },
  {
    value: 'PSE',
    label: 'PSE (simulación controlada)',
    description: 'Simulación demostrativa sin débito bancario real.',
  },
];

export function CheckoutPage() {
  const { user, profile } = useAuth();
  const {
    items,
    totalUnits,
    subtotal,
    hasUnavailableItems,
    syncNotice,
    clearCart,
    syncWithCatalog,
  } = useCart();
  const { addresses } = useAddresses(user?.id);
  const { settings } = useRestaurantSettings();

  const [modality, setModality] = useState('domicilio');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [deliveryDirections, setDeliveryDirections] = useState('');
  const [pickupEta, setPickupEta] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [simulatePaymentFailure, setSimulatePaymentFailure] = useState(false);
  const [notes, setNotes] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Clave de idempotencia estable por intento de checkout para prevenir duplicados
  const requestIdRef = useRef(generateClientRequestId());

  const defaultAddress = useMemo(
    () => addresses.find((a) => a.is_default) || addresses[0] || null,
    [addresses],
  );

  const activeSavedAddress = useMemo(() => {
    if (useNewAddress) return null;
    if (selectedAddressId) {
      return addresses.find((a) => a.id === selectedAddressId) || defaultAddress;
    }
    return defaultAddress;
  }, [addresses, defaultAddress, selectedAddressId, useNewAddress]);

  const allowClientTableOrders = Boolean(settings?.allow_client_table_orders);
  const deliveryFee =
    modality === 'domicilio' ? Number(settings?.fixed_delivery_fee) || 0 : 0;
  const isProvisionalDeliveryFee =
    modality === 'domicilio' &&
    (deliveryFee === 0 || Boolean(settings?.is_provisional_config));
  const estimatedTotal = subtotal + deliveryFee;

  const handleConfirmOrder = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setFieldErrors({});
    setSubmitError('');

    if (items.length === 0) {
      setSubmitError('Tu carrito está vacío.');
      return;
    }

    if (hasUnavailableItems) {
      setSubmitError('Retira los productos no disponibles de tu carrito antes de confirmar.');
      return;
    }

    if (modality === 'mesa' && !allowClientTableOrders) {
      setSubmitError('Los pedidos en mesa desde clientes no están habilitados.');
      return;
    }

    const effectiveAddress = activeSavedAddress
      ? activeSavedAddress.address
      : deliveryAddress;
    const effectiveNeighborhood = activeSavedAddress
      ? activeSavedAddress.neighborhood
      : deliveryNeighborhood;
    const effectiveDirections = activeSavedAddress
      ? activeSavedAddress.directions || ''
      : deliveryDirections;

    const parsed = checkoutSchema.safeParse({
      modality,
      paymentMethod,
      simulatePaymentFailure:
        paymentMethod !== 'Efectivo' && simulatePaymentFailure,
      deliveryAddress: effectiveAddress,
      deliveryNeighborhood: effectiveNeighborhood,
      deliveryDirections: effectiveDirections,
      pickupEta,
      notes,
      acceptTerms,
    });

    if (!parsed.success) {
      setFieldErrors(extractFieldErrors(parsed.error));
      setSubmitError('Revisa los campos obligatorios antes de confirmar tu pedido.');
      return;
    }

    setSubmitting(true);
    try {
      // Reconciliar catálogo en vivo justo antes de invocar la RPC transaccional
      const syncRes = await syncWithCatalog();
      if (syncRes.unavailableDetected > 0) {
        setSubmitError(
          'Uno de los productos de tu carrito dejó de estar disponible. Revisa tu carrito antes de continuar.',
        );
        return;
      }

      const result = await createTransactionalOrder({
        modality: parsed.data.modality,
        items,
        paymentMethod: parsed.data.paymentMethod,
        simulatePaymentFailure: parsed.data.simulatePaymentFailure,
        clientRequestId: requestIdRef.current,
        deliveryAddress: parsed.data.deliveryAddress,
        deliveryNeighborhood: parsed.data.deliveryNeighborhood,
        deliveryDirections: parsed.data.deliveryDirections,
        pickupEta: parsed.data.pickupEta,
        notes: parsed.data.notes,
      });

      if (result.error) {
        setSubmitError(result.error.message);
        // Si falló por rechazo simulado, rotar clave para permitir un nuevo intento limpio
        if (parsed.data.simulatePaymentFailure) {
          requestIdRef.current = generateClientRequestId();
        }
        return;
      }

      setConfirmedOrder(result.data);
      clearCart();
      requestIdRef.current = generateClientRequestId();
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <ContentContainer size="md" className="py-10">
        <Card className="text-center space-y-5 !p-8">
          <div className="mx-auto h-14 w-14 rounded-full bg-success-bg text-success flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>

          <div>
            <Badge variant="success">Pedido confirmado</Badge>
            <h1 className="m-0 mt-3 text-3xl font-medium text-text-primary sigr-heading-display">
              ¡Gracias, <em className="text-fire">{profile?.full_name}</em>!
            </h1>
            <p className="m-0 mt-2 text-sm text-text-secondary">
              Tu pedido <strong>{confirmedOrder.order_number}</strong> fue registrado de forma segura en PostgreSQL.
            </p>
          </div>

          <div className="max-w-md mx-auto p-4 rounded-[var(--radius-sm)] bg-cream border border-border-subtle text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-text-secondary">Número de pedido</span>
              <strong>{confirmedOrder.order_number}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Modalidad</span>
              <strong className="capitalize">{confirmedOrder.modality}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Estado del pedido</span>
              <strong>{confirmedOrder.status}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Estado del pago</span>
              <strong>{confirmedOrder.payment_status}</strong>
            </div>
            <div className="flex justify-between pt-2 border-t border-border-subtle text-sm">
              <span className="font-semibold">Total calculado en servidor</span>
              <strong className="text-fire">
                {formatMoney(confirmedOrder.total)}
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to={`/cliente/seguimiento/${confirmedOrder.id}`}
              className="inline-flex items-center justify-center h-10 px-5 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
            >
              Seguir mi pedido
            </Link>
            <Link
              to={`/cliente/pedidos/${confirmedOrder.id}`}
              className="inline-flex items-center justify-center h-10 px-5 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
            >
              Ver detalle
            </Link>
          </div>
        </Card>
      </ContentContainer>
    );
  }

  if (items.length === 0) {
    return (
      <ContentContainer size="md" className="py-10">
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Tu carrito está vacío"
          description="Agrega productos del menú antes de iniciar el checkout."
          action={
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--radius-sm)] bg-fire text-white text-xs font-semibold uppercase tracking-wider hover:bg-fire-hover transition-colors"
            >
              Ir al menú
            </Link>
          }
        />
      </ContentContainer>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="FORJA BRAVA · CHECKOUT SEGURO"
        title="Finalizar"
        accent="pedido."
        description="Los precios definitivos, complementos y tarifa vigente se recalculan de forma atómica en PostgreSQL."
        actions={
          <Link
            to="/carrito"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Volver al carrito</span>
          </Link>
        }
      />

      {syncNotice && (
        <div
          role="status"
          className="flex items-start gap-2.5 p-4 rounded-[var(--radius-sm)] bg-warning-bg text-warning border border-warning-border text-xs font-medium"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{syncNotice}</span>
        </div>
      )}

      {submitError && (
        <div className="auth-alert auth-alert-error" role="alert">
          {submitError}
        </div>
      )}

      <form
        onSubmit={handleConfirmOrder}
        noValidate
        className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start"
      >
        <div className="space-y-6">
          {/* 1. Modalidad */}
          <Card>
            <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-4">
              1. Modalidad de entrega
            </h2>
            <div className="space-y-3">
              <Radio
                id="chk-mod-domicilio"
                name="checkout-modality"
                checked={modality === 'domicilio'}
                onChange={() => setModality('domicilio')}
                label="Domicilio"
                description="Entrega en la dirección que selecciones."
              />
              <Radio
                id="chk-mod-recoger"
                name="checkout-modality"
                checked={modality === 'recoger'}
                onChange={() => setModality('recoger')}
                label="Recoger en el restaurante"
                description="Sin costo de domicilio."
              />
              <Radio
                id="chk-mod-mesa"
                name="checkout-modality"
                disabled={!allowClientTableOrders}
                checked={modality === 'mesa'}
                onChange={() => setModality('mesa')}
                label="En mesa"
                description={
                  allowClientTableOrders
                    ? 'Requiere reserva confirmada y vigente.'
                    : 'Los pedidos en mesa son registrados directamente por el mesero del salón (D-07).'
                }
              />
            </div>

            {modality === 'domicilio' && (
              <div className="mt-5 pt-5 border-t border-border-subtle space-y-4">
                {addresses.length > 0 && (
                  <div className="space-y-2">
                    <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-coffee">
                      Selecciona una dirección guardada
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {addresses.map((addr) => {
                        const isSelected =
                          !useNewAddress && activeSavedAddress?.id === addr.id;
                        return (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => {
                              setUseNewAddress(false);
                              setSelectedAddressId(addr.id);
                            }}
                            className={[
                              'p-3 text-left rounded-[var(--radius-sm)] border transition-colors cursor-pointer',
                              isSelected
                                ? 'border-fire bg-fire/8'
                                : 'border-border-subtle bg-surface-elevated hover:border-border-strong',
                            ].join(' ')}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <strong className="text-xs text-text-primary">
                                {addr.label}
                              </strong>
                              {addr.is_default && <Badge variant="fire">Principal</Badge>}
                            </div>
                            <p className="m-0 mt-1 text-xs text-text-secondary">
                              {addr.address} · {addr.neighborhood}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseNewAddress((prev) => !prev)}
                      className="text-xs font-semibold text-fire underline cursor-pointer bg-transparent border-0 p-0"
                    >
                      {useNewAddress
                        ? 'Usar una dirección guardada'
                        : 'Ingresar otra dirección para este pedido'}
                    </button>
                  </div>
                )}

                {(addresses.length === 0 || useNewAddress) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      id="chk-address"
                      label="Dirección de entrega"
                      error={fieldErrors.deliveryAddress}
                      required
                    >
                      <Input
                        id="chk-address"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Ej. Carrera 11 # 93-20"
                        error={Boolean(fieldErrors.deliveryAddress)}
                      />
                    </FormField>

                    <FormField
                      id="chk-neighborhood"
                      label="Barrio"
                      error={fieldErrors.deliveryNeighborhood}
                      required
                    >
                      <Input
                        id="chk-neighborhood"
                        value={deliveryNeighborhood}
                        onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                        placeholder="Ej. Chicó"
                        error={Boolean(fieldErrors.deliveryNeighborhood)}
                      />
                    </FormField>

                    <FormField
                      id="chk-directions"
                      label="Referencia de entrega (opcional)"
                      className="sm:col-span-2"
                    >
                      <Input
                        id="chk-directions"
                        value={deliveryDirections}
                        onChange={(e) => setDeliveryDirections(e.target.value)}
                        placeholder="Ej. Apto 401, dejar en portería"
                      />
                    </FormField>
                  </div>
                )}
              </div>
            )}

            {modality === 'recoger' && (
              <div className="mt-5 pt-5 border-t border-border-subtle max-w-xs">
                <FormField
                  id="chk-pickup-eta"
                  label="Hora estimada de recogida (opcional)"
                >
                  <Input
                    id="chk-pickup-eta"
                    type="time"
                    value={pickupEta}
                    onChange={(e) => setPickupEta(e.target.value)}
                  />
                </FormField>
              </div>
            )}
          </Card>

          {/* 2. Pago simulado */}
          <Card>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display">
                  2. Método de pago simulado
                </h2>
                <p className="m-0 mt-1 text-xs text-text-secondary">
                  Simulación controlada para pruebas y demostración. No solicita ni almacena datos bancarios reales.
                </p>
              </div>
              <CreditCard className="h-5 w-5 text-wood shrink-0" aria-hidden="true" />
            </div>

            <div className="space-y-3 mt-4">
              {PAYMENT_METHODS.map((method) => (
                <Radio
                  key={method.value}
                  id={`pay-${method.value}`}
                  name="checkout-payment"
                  checked={paymentMethod === method.value}
                  onChange={() => {
                    setPaymentMethod(method.value);
                    if (method.value === 'Efectivo') setSimulatePaymentFailure(false);
                  }}
                  label={method.label}
                  description={method.description}
                />
              ))}
            </div>

            {paymentMethod !== 'Efectivo' && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <Checkbox
                  id="chk-sim-fail"
                  checked={simulatePaymentFailure}
                  onChange={(e) => setSimulatePaymentFailure(e.target.checked)}
                  label="Simular rechazo del pago digital (modo demostración)"
                  description="Permite verificar que la transacción se revierte sin crear pedidos parciales."
                />
              </div>
            )}
          </Card>

          {/* 3. Observaciones y aceptación */}
          <Card>
            <FormField id="chk-notes" label="Observaciones del pedido (opcional)">
              <Textarea
                id="chk-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Sin cebolla, salsas aparte"
              />
            </FormField>

            <div className="mt-4 pt-4 border-t border-border-subtle">
              <Checkbox
                id="chk-terms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                label="Confirmo que revisé los productos, cantidades y que los pagos digitales en esta plataforma son simulados."
              />
              {fieldErrors.acceptTerms && (
                <p role="alert" className="m-0 mt-1.5 text-xs font-medium text-error">
                  {fieldErrors.acceptTerms}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Resumen */}
        <Card className="sticky top-[calc(var(--topbar-height)+24px)] space-y-4">
          <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display pb-3 border-b border-border-subtle">
            Resumen ({totalUnits} u.)
          </h2>

          <ul className="m-0 p-0 list-none space-y-3 text-xs">
            {items.map((item) => (
              <li key={item.lineKey} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 font-semibold text-text-primary">
                    {item.quantity} × {item.name}
                  </p>
                  {item.addons.length > 0 && (
                    <p className="m-0 text-[11px] text-text-muted">
                      + {item.addons.map((a) => a.name).join(', ')}
                    </p>
                  )}
                </div>
                <span className="font-semibold text-text-primary whitespace-nowrap">
                  {formatMoney(calculateLineTotal(item.unitPrice, item.addons, item.quantity))}
                </span>
              </li>
            ))}
          </ul>

          <div className="pt-3 border-t border-border-subtle space-y-2 text-xs">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal productos</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {modality === 'domicilio' && (
              <div className="flex justify-between text-text-secondary">
                <span>Tarifa fija de domicilio</span>
                <span>{formatMoney(deliveryFee)}</span>
              </div>
            )}
            {isProvisionalDeliveryFee && (
              <p className="m-0 p-2 rounded-[var(--radius-xs)] bg-warning-bg/70 text-warning text-[11px]">
                Tarifa de domicilio en configuración provisional pendiente de confirmación comercial administrativa (D-03).
              </p>
            )}
            <div className="flex justify-between pt-2 border-t border-border-subtle text-base font-bold text-text-primary">
              <span>Total estimado</span>
              <span className="text-fire">{formatMoney(estimatedTotal)}</span>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={hasUnavailableItems || submitting}
            leftIcon={<ShieldCheck className="h-4 w-4" />}
          >
            {submitting ? 'Registrando pedido…' : 'Confirmar pedido'}
          </Button>
        </Card>
      </form>
    </div>
  );
}
