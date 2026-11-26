import { useState } from 'react';
import { CalendarClock, ClipboardList, MapPin, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, FormField, Input } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

function ClientProfileForm({ profile, updateProfile }) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setStatusMessage('');
    setErrorMessage('');
    setSaving(true);

    try {
      const result = await updateProfile({ fullName, phone });
      if (result.error) {
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors);
        }
        setErrorMessage(result.error.message);
        return;
      }
      setStatusMessage('Tus datos personales fueron actualizados.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {errorMessage && (
        <div className="auth-alert auth-alert-error" role="alert">
          {errorMessage}
        </div>
      )}
      {statusMessage && (
        <div className="auth-alert auth-alert-success" role="status">
          {statusMessage}
        </div>
      )}

      <form
        onSubmit={handleProfileSave}
        noValidate
        className="grid gap-4 sm:grid-cols-2 max-w-2xl"
      >
        <FormField
          id="profile-fullname"
          label="Nombre completo"
          error={fieldErrors.fullName}
          required
        >
          <Input
            id="profile-fullname"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={Boolean(fieldErrors.fullName)}
            disabled={saving}
            required
          />
        </FormField>

        <FormField id="profile-email" label="Correo electrónico (verificado)">
          <Input
            id="profile-email"
            type="email"
            value={profile?.email || ''}
            readOnly
            className="opacity-75 cursor-not-allowed"
          />
        </FormField>

        <FormField
          id="profile-phone"
          label="Teléfono"
          error={fieldErrors.phone}
        >
          <Input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={Boolean(fieldErrors.phone)}
            disabled={saving}
            placeholder="+57 300 000 0000"
          />
        </FormField>

        <div className="flex items-end">
          <Button type="submit" fullWidth loading={saving}>
            {saving ? 'Guardando…' : 'Guardar perfil'}
          </Button>
        </div>
      </form>
    </>
  );
}

const CLIENT_SHORTCUTS = [
  {
    to: '/cliente/nuevo-pedido',
    title: 'Realizar pedido',
    desc: 'Domicilio, recoger en tienda o reserva asociada.',
    icon: ShoppingBag,
  },
  {
    to: '/cliente/pedidos',
    title: 'Mis pedidos',
    desc: 'Consulta tu historial y estado en tiempo real.',
    icon: ClipboardList,
  },
  {
    to: '/cliente/reservas',
    title: 'Mis reservas',
    desc: 'Consulta disponibilidad y administra tus mesas.',
    icon: CalendarClock,
  },
  {
    to: '/cliente/direcciones',
    title: 'Mis direcciones',
    desc: 'Guarda ubicaciones frecuentes para entregas rápidas.',
    icon: MapPin,
  },
];

export function ClientPlaceholderPage() {
  const { profile, role, updateProfile } = useAuth();
  const profileKey = `${profile?.id || 'guest'}-${profile?.updated_at || ''}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="FORJA BRAVA · EXPERIENCIA DEL CLIENTE"
        title="Hola,"
        accent={profile?.full_name || 'bienvenido.'}
        description="Gestiona tus datos personales, pedidos, seguimiento y reservas desde un entorno unificado."
        badge={<Badge variant="fire">Rol {role}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CLIENT_SHORTCUTS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group block bg-surface border border-border-subtle rounded-[var(--radius-sm)] p-5 hover:border-fire transition-colors shadow-[var(--shadow-xs)]"
            >
              <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-surface-muted text-wood group-hover:bg-fire group-hover:text-white flex items-center justify-center transition-colors mb-3">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <h2 className="m-0 text-base font-medium text-text-primary sigr-heading-display">
                {item.title}
              </h2>
              <p className="m-0 mt-1 text-xs text-text-secondary leading-relaxed">
                {item.desc}
              </p>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Datos de tu cuenta</CardTitle>
            <CardDescription>
              Tu identidad y rol provienen de PostgreSQL bajo protección Row Level Security (RLS).
            </CardDescription>
          </div>
          <Badge variant="success">Cuenta activa</Badge>
        </CardHeader>

        <ClientProfileForm
          key={profileKey}
          profile={profile}
          updateProfile={updateProfile}
        />
      </Card>
    </div>
  );
}
