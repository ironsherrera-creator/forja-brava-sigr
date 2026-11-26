import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured, supabaseConfigErrors } from '../../lib/env';
import { resolvePostAuthRedirect } from '../../utils/rbac';

export function LoginPage() {
  const { signIn, authNotice, clearAuthNotice } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearAuthNotice();
    setFieldErrors({});
    setFormError('');
    setIsSubmitting(true);

    try {
      const result = await signIn({ email, password });

      if (result.error) {
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors);
        }
        setFormError(result.error.message);
        return;
      }

      const targetRoute = resolvePostAuthRedirect(
        redirectParam,
        result.data?.role,
      );
      navigate(targetRoute, { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerHref = redirectParam
    ? `/registro?redirect=${encodeURIComponent(redirectParam)}`
    : '/registro';

  return (
    <AuthShell
      kicker="FORJA BRAVA · IDENTIDAD Y ACCESO"
      title="Tu cuenta"
      accent="al fuego."
      subtitle="Ingresa con tus credenciales para gestionar tus pedidos, reservas o panel asignado."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span>¿Aún no tienes cuenta de cliente?</span>
          <Link to={registerHref} className="under-link !mt-0">
            CREAR CUENTA <span>↗</span>
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

      {authNotice && (
        <div className="auth-alert auth-alert-error" role="alert">
          {authNotice}
        </div>
      )}

      {formError && (
        <div className="auth-alert auth-alert-error" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-form">
        <div className="auth-field">
          <label htmlFor="login-email">Correo electrónico</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={
              fieldErrors.email ? 'login-email-error' : undefined
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.email && (
            <span id="login-email-error" className="auth-field-error">
              {fieldErrors.email}
            </span>
          )}
        </div>

        <div className="auth-field">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password">Contraseña</label>
            <Link
              to="/recuperar-contrasena"
              className="text-[11px] font-medium text-[#68452f] underline hover:text-[#c66a32]"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="auth-password-wrap">
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? 'login-password-error' : undefined
              }
              disabled={isSubmitting}
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
              }
            >
              {showPassword ? 'OCULTAR' : 'VER'}
            </button>
          </div>
          {fieldErrors.password && (
            <span id="login-password-error" className="auth-field-error">
              {fieldErrors.password}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="button button-fire w-full mt-2"
          disabled={isSubmitting || !isSupabaseConfigured}
        >
          {isSubmitting ? 'VERIFICANDO ACCESO…' : 'INICIAR SESIÓN'}
          <span>↗</span>
        </button>
      </form>
    </AuthShell>
  );
}
