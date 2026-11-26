import { useState } from 'react';
import { Clock, Save } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  FormField,
  Input,
  LoadingState,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useRestaurantSettings } from '../../hooks/useRestaurantSettings';
import { updateRestaurantScheduleConfig } from '../../services/restaurantScheduleService';

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_HOURS = {
  monday: { open: '12:00', close: '22:00', closed: false },
  tuesday: { open: '12:00', close: '22:00', closed: false },
  wednesday: { open: '12:00', close: '22:00', closed: false },
  thursday: { open: '12:00', close: '22:00', closed: false },
  friday: { open: '12:00', close: '23:00', closed: false },
  saturday: { open: '12:00', close: '23:00', closed: false },
  sunday: { open: '12:00', close: '22:00', closed: false },
};

function ScheduleConfigForm({ settings, userId }) {
  const [restaurantName, setRestaurantName] = useState(
    settings?.restaurant_name || 'FORJA BRAVA',
  );
  const [location, setLocation] = useState(settings?.location || '');
  const [phone, setPhone] = useState(settings?.phone || '');
  const [fixedDeliveryFee, setFixedDeliveryFee] = useState(
    settings?.fixed_delivery_fee ?? 0,
  );
  const [durationMinutes, setDurationMinutes] = useState(
    settings?.reservation_duration_minutes ?? 90,
  );
  const [cancelCutoff, setCancelCutoff] = useState(
    settings?.reservation_cancel_cutoff_minutes ?? 60,
  );
  const [allowClientTableOrders, setAllowClientTableOrders] = useState(
    Boolean(settings?.allow_client_table_orders),
  );
  const [businessHours, setBusinessHours] = useState(
    settings?.business_hours || DEFAULT_HOURS,
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const updateDay = (dayKey, patch) => {
    setBusinessHours((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], ...patch },
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSaving(true);
    try {
      const res = await updateRestaurantScheduleConfig(
        {
          restaurant_name: restaurantName,
          location,
          phone,
          fixed_delivery_fee: Number(fixedDeliveryFee),
          reservation_duration_minutes: Number(durationMinutes),
          reservation_cancel_cutoff_minutes: Number(cancelCutoff),
          allow_client_table_orders: allowClientTableOrders,
          business_hours: businessHours,
        },
        userId,
      );

      if (res.error) {
        setErrorMsg(res.error.message);
        return;
      }

      setSuccessMsg(
        'Configuración operativa guardada en Supabase. Las consultas posteriores de disponibilidad y domicilio aplicarán estos valores.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} noValidate className="space-y-6">
      {errorMsg && (
        <div className="auth-alert auth-alert-error" role="alert">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="auth-alert auth-alert-success" role="status">
          {successMsg}
        </div>
      )}

      <Card>
        <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-4">
          Parámetros operativos y comerciales (D-02, D-03, D-07)
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="cfg-name" label="Nombre del restaurante" required>
            <Input
              id="cfg-name"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
            />
          </FormField>

          <FormField id="cfg-location" label="Dirección / Ubicación" required>
            <Input
              id="cfg-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </FormField>

          <FormField id="cfg-phone" label="Teléfono oficial" required>
            <Input
              id="cfg-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>

          <FormField
            id="cfg-duration"
            label="Duración de reservas en minutos (D-02)"
            required
          >
            <Input
              id="cfg-duration"
              type="number"
              min={15}
              max={360}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </FormField>

          <FormField
            id="cfg-cutoff"
            label="Anticipación mínima para cancelar (min)"
            required
          >
            <Input
              id="cfg-cutoff"
              type="number"
              min={0}
              max={1440}
              value={cancelCutoff}
              onChange={(e) => setCancelCutoff(e.target.value)}
            />
          </FormField>

          <FormField
            id="cfg-delivery"
            label="Tarifa fija de domicilio en COP (D-03)"
            required
          >
            <Input
              id="cfg-delivery"
              type="number"
              min={0}
              value={fixedDeliveryFee}
              onChange={(e) => setFixedDeliveryFee(e.target.value)}
            />
          </FormField>
        </div>

        <div className="mt-5 pt-4 border-t border-border-subtle">
          <Checkbox
            id="cfg-allow-table"
            checked={allowClientTableOrders}
            onChange={(e) => setAllowClientTableOrders(e.target.checked)}
            label="Permitir pedidos en mesa directamente desde clientes (D-07)"
            description="Por defecto permanece desactivado; los pedidos en salón los toma el mesero."
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display">
              Horarios semanales de atención (America/Bogota)
            </h2>
            <p className="m-0 mt-1 text-xs text-text-secondary">
              El motor de disponibilidad solo ofrece franjas dentro de los días y horarios abiertos.
            </p>
          </div>
          <Clock className="h-5 w-5 text-wood shrink-0" aria-hidden="true" />
        </div>

        <div className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const cfg = businessHours[key] || { open: '12:00', close: '22:00', closed: false };
            return (
              <div
                key={key}
                className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_140px] items-center p-3 rounded-[var(--radius-sm)] bg-surface-elevated border border-border-subtle"
              >
                <strong className="text-sm text-text-primary">{label}</strong>
                <Input
                  type="time"
                  aria-label={`Hora de apertura ${label}`}
                  value={cfg.open}
                  disabled={cfg.closed}
                  onChange={(e) => updateDay(key, { open: e.target.value })}
                />
                <Input
                  type="time"
                  aria-label={`Hora de cierre ${label}`}
                  value={cfg.close}
                  disabled={cfg.closed}
                  onChange={(e) => updateDay(key, { close: e.target.value })}
                />
                <Checkbox
                  id={`closed-${key}`}
                  checked={Boolean(cfg.closed)}
                  onChange={(e) => updateDay(key, { closed: e.target.checked })}
                  label="Cerrado"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />}>
            Guardar configuración
          </Button>
        </div>
      </Card>
    </form>
  );
}

export function AdminScheduleConfigPage() {
  const { user } = useAuth();
  const { settings, isLoading, error } = useRestaurantSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 7 · CONFIGURACIÓN DEL RESTAURANTE"
        title="Horarios y"
        accent="reservas."
        description="Administra los horarios semanales, duración de turnos (D-02), ventana de cancelación y tarifa fija de domicilio (D-03)."
        badge={
          settings?.is_provisional_config ? (
            <Badge variant="warning">Configuración provisional</Badge>
          ) : (
            <Badge variant="success">Configuración activa</Badge>
          )
        }
      />

      {error ? (
        <ErrorState
          title="No fue posible cargar la configuración"
          description={error.message}
        />
      ) : isLoading ? (
        <LoadingState title="Cargando configuración del restaurante…" />
      ) : (
        <ScheduleConfigForm
          key={settings?.updated_at || 'settings'}
          settings={settings}
          userId={user?.id}
        />
      )}
    </div>
  );
}
