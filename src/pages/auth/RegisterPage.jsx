import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured, supabaseConfigErrors } from '../../lib/env';
import { ROLES, resolvePostAuthRedirect } from '../../utils/rbac';

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect') || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const result = await signUp({
        fullName,
        email,
        phone,
        password,
        confirmPassword,
      });

      if (result.error) {
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors);
        }
        setFormError(result.error.message);
        return;
      }

      if (result.data?.requiresEmailConfirmation) {
        setSuccessMessage(
          'Cuenta registrada. Revisa tu bandeja de correo electrónico y confirma tu enlace de activación antes de iniciar sesión.',
        );
        setPassword('');
        setConfirmPassword('');
        return;
      }

      if (result.data?.session) {
        const destination = resolvePostAuthRedirect(
          redirectParam,
          ROLES.CLIENTE,
        );
        navigate(destination, { replace: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginHref = redirectParam
    ? `/login?redirect=${encodeURIComponent(redirectParam)}`
    : '/login';

  return (
    <AuthShell
      kicker="FORJA BRAVA · REGISTRO DE CLIENTE"
      title="Únete a"
      accent="la mesa."
      subtitle="Crea tu cuenta personal para realizar pedidos en línea y reservar tu mesa."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span>¿Ya tienes una cuenta registrada?</span>
          <Link to={loginHref} className="under-link !mt-0">
            INICIAR SESIÓN <span>↗</span>
          </Link>
        </div>
      }
    >
      {!isSupabaseConfigured && (
        <div className="auth-alert auth-alert-error" role="alert">
          <strong>Configuración pendiente:</strong>{' '}
          {supabaseConfigErrors.join(' ')}
        </div>
      )}

      {formError && (
        <div className="auth-alert auth-alert-error" role="alert">
          {formError}
        </div>
      )}

      {successMessage && (
        <div className="auth-alert auth-alert-success" role="status">
          {successMessage}
          <div className="mt-3">
            <Link to={loginHref} className="under-link !mt-0">
              IR A INICIAR SESIÓN <span>↗</span>
            </Link>
          </div>
        </div>
      )}

      {!successMessage && (
        <form onSubmit={handleSubmit} noValidate className="auth-form">
          <div className="auth-field">
            <label htmlFor="register-fullname">Nombre completo</label>
            <input
              id="register-fullname"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Ej. Valentina Gómez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={
                fieldErrors.fullName ? 'register-fullname-error' : undefined
              }
              disabled={isSubmitting}
              required
            />
            {fieldErrors.fullName && (
              <span id="register-fullname-error" className="auth-field-error">
                {fieldErrors.fullName}
              </span>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">Correo electrónico</label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? 'register-email-error' : undefined
              }
              disabled={isSubmitting}
              required
            />
            {fieldErrors.email && (
              <span id="register-email-error" className="auth-field-error">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="register-phone">Teléfono de contacto (opcional)</label>
            <input
              id="register-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+57 300 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={
                fieldErrors.phone ? 'register-phone-error' : undefined
              }
              disabled={isSubmitting}
            />
            {fieldErrors.phone && (
              <span id="register-phone-error" className="auth-field-error">
                {fieldErrors.phone}
              </span>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">
              Contraseña (mín. 8 caracteres, letras y números)
            </label>
            <div className="auth-password-wrap">
              <input
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password ? 'register-password-error' : undefined
                }
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'
                }
              >
                {showPassword ? 'OCULTAR' : 'VER'}
              </button>
            </div>
            {fieldErrors.password && (
              <span id="register-password-error" className="auth-field-error">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="register-confirm-password">
              Confirmar contraseña
            </label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={
                fieldErrors.confirmPassword
                  ? 'register-confirm-error'
                  : undefined
              }
              disabled={isSubmitting}
              required
            />
            {fieldErrors.confirmPassword && (
              <span id="register-confirm-error" className="auth-field-error">
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="button button-fire w-full mt-2"
            disabled={isSubmitting || !isSupabaseConfigured}
          >
            {isSubmitting ? 'REGISTRANDO CUENTA…' : 'CREAR CUENTA'}
            <span>↗</span>
          </button>
        </form>
      )}
    </AuthShell>
  );
}
