import { useEffect, useState } from 'react';
import { CalendarClock, Clock, Users, XCircle } from 'lucide-react';
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
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useReservations } from '../../hooks/useReservations';
import { useRestaurantSettings } from '../../hooks/useRestaurantSettings';
import { fetchAvailableReservationSlots } from '../../services/reservationService';
import {
  formatDateTimeBogota,
  formatTimeBogota,
  getTodayBogotaIso,
} from '../../utils/formatDate';

function getReservationStatusVariant(status) {
  switch (status) {
    case 'Confirmada':
      return 'success';
    case 'Atendida':
      return 'info';
    case 'Cancelada':
      return 'error';
    default:
      return 'warning';
  }
}

export function ClientReservationsPage() {
  const { user } = useAuth();
  const { settings } = useRestaurantSettings();
  const {
    reservations,
    isLoading,
    error,
    reload,
    createReservation,
    cancelReservation,
  } = useReservations(user?.id);

  const todayBogota = getTodayBogotaIso();
  const [date, setDate] = useState(todayBogota);
  const [partySize, setPartySize] = useState(2);
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!date || Number(partySize) < 1) return undefined;

    let active = true;
    fetchAvailableReservationSlots({ date, partySize: Number(partySize) }).then(
      (res) => {
        if (!active) return;
        if (res.error) {
          setSlotsError(res.error.message);
          setSlots([]);
        } else {
          setSlotsError('');
          setSlots(res.data);
        }
        setSlotsLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [date, partySize]);

  const handleDateChange = (nextDate) => {
    setDate(nextDate);
    setSelectedTime('');
    setSlotsLoading(true);
    setSubmitError('');
    setSubmitSuccess('');
  };

  const handlePartySizeChange = (nextSize) => {
    setPartySize(nextSize);
    setSelectedTime('');
    setSlotsLoading(true);
    setSubmitError('');
    setSubmitSuccess('');
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitError('');
    setSubmitSuccess('');

    if (!selectedTime) {
      setSubmitError('Selecciona uno de los horarios disponibles.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createReservation({
        date,
        time: selectedTime,
        partySize: Number(partySize),
        notes,
      });

      if (res.error) {
        setSubmitError(res.error.message);
        return;
      }

      setSubmitSuccess(
        `Reserva ${res.data.reservation_code} confirmada automáticamente. La mesa fue asignada por el sistema.`,
      );
      setSelectedTime('');
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setSubmitError('');
    try {
      const res = await cancelReservation(cancelTarget.id, 'Cancelada por el cliente');
      if (res.error) {
        setSubmitError(res.error.message);
      } else {
        setSubmitSuccess(`Reserva ${cancelTarget.reservation_code} cancelada correctamente.`);
      }
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  };

  const durationMinutes = settings?.reservation_duration_minutes ?? 90;
  const cancelCutoff = settings?.reservation_cancel_cutoff_minutes ?? 60;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ÁREA CLIENTE · RESERVAS"
        title="Reservar"
        accent="mesa."
        description={`Duración configurada por turno: ${durationMinutes} minutos (zona horaria America/Bogota). El sistema asigna automáticamente la mesa disponible sin solapamientos.`}
      />

      {submitError && (
        <div className="auth-alert auth-alert-error" role="alert">
          {submitError}
        </div>
      )}
      {submitSuccess && (
        <div className="auth-alert auth-alert-success" role="status">
          {submitSuccess}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] items-start">
        {/* Formulario de disponibilidad y reserva */}
        <Card>
          <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-4">
            Consultar disponibilidad
          </h2>

          <form onSubmit={handleCreate} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="res-date" label="Fecha" required>
                <Input
                  id="res-date"
                  type="date"
                  min={todayBogota}
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </FormField>

              <FormField id="res-party" label="Número de personas" required>
                <Input
                  id="res-party"
                  type="number"
                  min={1}
                  max={30}
                  value={partySize}
                  onChange={(e) => handlePartySizeChange(e.target.value)}
                />
              </FormField>
            </div>

            <div>
              <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-coffee">
                Horarios disponibles
              </p>

              {slotsError ? (
                <p role="alert" className="m-0 text-xs text-error">
                  {slotsError}
                </p>
              ) : slotsLoading ? (
                <p className="m-0 text-xs text-text-muted">Consultando disponibilidad…</p>
              ) : slots.length === 0 ? (
                <p className="m-0 p-3 rounded-[var(--radius-sm)] bg-surface-muted text-xs text-text-secondary">
                  No hay franjas disponibles para la fecha y número de personas seleccionados.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot) => {
                    const timeValue = String(slot.slot_time || '').slice(0, 5);
                    const isSelected = selectedTime === timeValue;
                    return (
                      <button
                        key={slot.slot_time}
                        type="button"
                        onClick={() => setSelectedTime(timeValue)}
                        className={[
                          'h-10 px-2 rounded-[var(--radius-sm)] border text-xs font-semibold transition-colors cursor-pointer',
                          isSelected
                            ? 'bg-fire text-white border-fire'
                            : 'bg-surface-elevated text-text-primary border-border hover:border-fire',
                        ].join(' ')}
                      >
                        {timeValue}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <FormField id="res-notes" label="Observaciones (opcional)">
              <Textarea
                id="res-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Celebración de cumpleaños, silla para bebé"
              />
            </FormField>

            <Button
              type="submit"
              fullWidth
              loading={submitting}
              disabled={!selectedTime || submitting}
              leftIcon={<CalendarClock className="h-4 w-4" />}
            >
              Confirmar reserva
            </Button>

            <p className="m-0 text-[11px] text-text-muted">
              Puedes cancelar en línea hasta {cancelCutoff} minutos antes del inicio de tu reserva. Una reserva no abre cuenta ni genera pedido automáticamente.
            </p>
          </form>
        </Card>

        {/* Listado de reservas propias */}
        <Card>
          <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-4">
            Mis reservas
          </h2>

          {error ? (
            <ErrorState
              title="No fue posible cargar tus reservas"
              description={error.message}
              onRetry={reload}
            />
          ) : isLoading ? (
            <LoadingState title="Cargando tus reservas…" />
          ) : reservations.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-5 w-5" />}
              title="Sin reservas registradas"
              description="Selecciona una fecha y franja disponible para reservar tu mesa."
            />
          ) : (
            <ul className="m-0 p-0 list-none space-y-3">
              {reservations.map((res) => {
                const tableInfo = Array.isArray(res.restaurant_tables)
                  ? res.restaurant_tables[0]
                  : res.restaurant_tables;
                const canCancel =
                  res.status === 'Pendiente' || res.status === 'Confirmada';

                return (
                  <li
                    key={res.id}
                    className="p-3.5 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-elevated space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-sm text-text-primary">
                          {res.reservation_code}
                        </strong>
                        <p className="m-0 mt-0.5 text-xs text-text-secondary flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
                          <span>
                            {formatDateTimeBogota(res.start_at)} – {formatTimeBogota(res.end_at)}
                          </span>
                        </p>
                      </div>
                      <Badge variant={getReservationStatusVariant(res.status)}>
                        {res.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {res.party_size} {res.party_size === 1 ? 'persona' : 'personas'}
                      </span>
                      {tableInfo?.code && (
                        <span>
                          Mesa asignada: <strong className="text-text-primary">{tableInfo.code}</strong> ({tableInfo.zone})
                        </span>
                      )}
                    </div>

                    {canCancel && (
                      <div className="pt-2 border-t border-border-subtle">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelTarget(res)}
                          leftIcon={<XCircle className="h-3.5 w-3.5 text-error" />}
                        >
                          Cancelar reserva
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        loading={cancelling}
        title="¿Cancelar reserva?"
        description={`Se cancelará la reserva ${cancelTarget?.reservation_code || ''} y se liberará la mesa asignada.`}
        confirmLabel="Sí, cancelar reserva"
      />
    </div>
  );
}
