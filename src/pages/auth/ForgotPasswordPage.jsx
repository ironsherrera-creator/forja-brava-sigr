import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured, supabaseConfigErrors } from '../../lib/env';

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [neutralMessage, setNeutralMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setNeutralMessage('');
    setIsSubmitting(true);

    try {
      const result = await requestPasswordReset({ email });

      if (result.error) {
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors);
        }
        setFormError(result.error.message);
        return;
      }

      setNeutralMessage(result.data?.neutralMessage || '');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      kicker="FORJA BRAVA · RECUPERACIÓN DE ACCESO"
      title="Recupera tu"
      accent="contraseña."
      subtitle="Ingresa tu correo electrónico y te enviaremos instrucciones para restablecer tu clave."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span>¿Recordaste tu contraseña?</span>
          <Link to="/login" className="under-link !mt-0">
            VOLVER A INICIAR SESIÓN <span>↗</span>
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

      {neutralMessage ? (
        <div className="auth-alert auth-alert-success" role="status">
          {neutralMessage}
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="auth-form">
          <div className="auth-field">
            <label htmlFor="forgot-email">Correo electrónico asociado</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? 'forgot-email-error' : undefined
              }
              disabled={isSubmitting}
              required
            />
            {fieldErrors.email && (
              <span id="forgot-email-error" className="auth-field-error">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="button button-fire w-full mt-2"
            disabled={isSubmitting || !isSupabaseConfigured}
          >
            {isSubmitting ? 'ENVIANDO ENLACE…' : 'ENVIAR ENLACE DE RECUPERACIÓN'}
            <span>↗</span>
          </button>
        </form>
      )}
    </AuthShell>
  );
}
