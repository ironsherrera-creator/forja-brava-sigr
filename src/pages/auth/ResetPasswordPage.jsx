import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured, supabaseConfigErrors } from '../../lib/env';
import { verifyRecoverySessionFromUrl } from '../../services/authService';

export function ResetPasswordPage() {
  const { updatePassword, signOut, isRecoveryMode, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [verifyingLink, setVerifyingLink] = useState(true);
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkRecovery() {
      if (!isSupabaseConfigured) {
        if (active) setVerifyingLink(false);
        return;
      }

      if (isRecoveryMode || session) {
        if (active) {
          setLinkError('');
          setVerifyingLink(false);
        }
        return;
      }

      const result = await verifyRecoverySessionFromUrl(location.search);
      if (!active) return;

      if (result.error || !result.session) {
        setLinkError(
          result.error?.message ||
            'El enlace de recuperación es inválido o ha expirado.',
        );
      } else {
        setLinkError('');
      }
      setVerifyingLink(false);
    }

    checkRecovery();
    return () => {
      active = false;
    };
  }, [isRecoveryMode, location.search, session]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setIsSubmitting(true);

    try {
      const result = await updatePassword({ password, confirmPassword });

      if (result.error) {
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors);
        }
        setFormError(result.error.message);
        return;
      }

      await signOut();
      setSuccessMessage(
        'Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tu nueva clave.',
      );
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2400);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      kicker="FORJA BRAVA · NUEVA CONTRASEÑA"
      title="Actualiza tu"
      accent="clave."
      subtitle="Define una contraseña segura de mínimo 8 caracteres con letras y números."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <Link to="/recuperar-contrasena" className="under-link !mt-0">
            SOLICITAR NUEVO ENLACE <span>↗</span>
          </Link>
          <Link to="/login" className="text-[#68452f] underline">
            Ir a iniciar sesión
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

      {verifyingLink && (
        <p className="text-xs text-[#685a4d]" role="status">
          Validando enlace de recuperación…
        </p>
      )}

      {!verifyingLink && linkError && !successMessage && (
        <div className="auth-alert auth-alert-error" role="alert">
          {linkError}
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
        </div>
      )}

      {!verifyingLink && !linkError && !successMessage && (
        <form onSubmit={handleSubmit} noValidate className="auth-form">
          <div className="auth-field">
            <label htmlFor="reset-password">Nueva contraseña</label>
            <div className="auth-password-wrap">
              <input
                id="reset-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password ? 'reset-password-error' : undefined
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
              <span id="reset-password-error" className="auth-field-error">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="reset-confirm-password">
              Confirmar nueva contraseña
            </label>
            <input
              id="reset-confirm-password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repite la nueva contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={
                fieldErrors.confirmPassword ? 'reset-confirm-error' : undefined
              }
              disabled={isSubmitting}
              required
            />
            {fieldErrors.confirmPassword && (
              <span id="reset-confirm-error" className="auth-field-error">
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="button button-fire w-full mt-2"
            disabled={isSubmitting || !isSupabaseConfigured}
          >
            {isSubmitting ? 'GUARDANDO CONTRASEÑA…' : 'ACTUALIZAR CONTRASEÑA'}
            <span>↗</span>
          </button>
        </form>
      )}
    </AuthShell>
  );
}
