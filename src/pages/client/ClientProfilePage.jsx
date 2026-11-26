import { useState } from 'react';
import { Mail, MapPin, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { requestEmailChange } from '../../services/profileService';

function ProfileBasicForm({ profile, updateProfile }) {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setSuccessMsg('');
    setErrorMsg('');
    setSaving(true);
    try {
      const res = await updateProfile({ fullName, phone });
      if (res.error) {
        if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
        setErrorMsg(res.error.message);
        return;
      }
      setSuccessMsg('Tu perfil fue actualizado correctamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="client-profile-fullname"
          label="Nombre completo"
          error={fieldErrors.fullName}
          required
        >
          <Input
            id="client-profile-fullname"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={Boolean(fieldErrors.fullName)}
            disabled={saving}
            required
          />
        </FormField>

        <FormField
          id="client-profile-phone"
          label="Teléfono de contacto"
          error={fieldErrors.phone}
        >
          <Input
            id="client-profile-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={Boolean(fieldErrors.phone)}
            disabled={saving}
            placeholder="+57 300 000 0000"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <ShieldCheck className="h-4 w-4 text-wood" aria-hidden="true" />
          El rol y el estado de la cuenta están protegidos en PostgreSQL.
        </span>
        <Button type="submit" loading={saving}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

export function ClientProfilePage() {
  const { profile, role, updateProfile } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  const profileKey = profile?.id || 'guest';

  const handleEmailChange = async (event) => {
    event.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setUpdatingEmail(true);
    try {
      const res = await requestEmailChange({ email: newEmail });
      if (res.error) {
        setEmailError(res.error.fieldErrors?.email || res.error.message);
        return;
      }
      setEmailSuccess(res.data.message);
      setNewEmail('');
    } finally {
      setUpdatingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ÁREA CLIENTE · MI PERFIL"
        title="Información"
        accent="personal."
        description="Administra tus datos básicos de contacto. Tus permisos y rol se verifican exclusivamente desde PostgreSQL."
        badge={<Badge variant="fire">Rol {role}</Badge>}
        actions={
          <Link
            to="/cliente/direcciones"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] border border-border-strong text-xs font-semibold uppercase tracking-wider text-text-primary hover:bg-surface-muted transition-colors"
          >
            <MapPin className="h-3.5 w-3.5 text-fire" aria-hidden="true" />
            <span>Mis direcciones</span>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Datos básicos</CardTitle>
            <CardDescription>
              Actualiza el nombre y teléfono que se asociarán a tus pedidos y reservas.
            </CardDescription>
          </div>
          <Badge variant="success">Cuenta activa</Badge>
        </CardHeader>

        <ProfileBasicForm
          key={profileKey}
          profile={profile}
          updateProfile={updateProfile}
        />
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Correo electrónico de acceso</CardTitle>
            <CardDescription>
              Correo actual: <strong className="text-text-primary">{profile?.email}</strong>. El cambio se realiza mediante Supabase Auth y requiere confirmación por correo.
            </CardDescription>
          </div>
          <Mail className="h-5 w-5 text-wood" aria-hidden="true" />
        </CardHeader>

        {emailError && (
          <div className="auth-alert auth-alert-error" role="alert">
            {emailError}
          </div>
        )}
        {emailSuccess && (
          <div className="auth-alert auth-alert-success" role="status">
            {emailSuccess}
          </div>
        )}

        <form onSubmit={handleEmailChange} noValidate className="flex flex-col sm:flex-row gap-3 items-end max-w-xl">
          <FormField
            id="client-new-email"
            label="Nuevo correo electrónico"
            className="flex-1 w-full"
          >
            <Input
              id="client-new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nuevo@correo.com"
              disabled={updatingEmail}
            />
          </FormField>
          <Button type="submit" variant="secondary" loading={updatingEmail}>
            Solicitar cambio
          </Button>
        </form>
      </Card>
    </div>
  );
}
