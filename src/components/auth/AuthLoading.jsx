export function AuthLoading({ message = 'Verificando sesión segura…' }) {
  return (
    <div
      className="auth-loading-screen"
      role="status"
      aria-label={message}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="auth-loading-box">
        <div className="brand justify-center">
          <span className="brand-mark">
            F<span>B</span>
          </span>
          <span className="brand-name text-left">
            FORJA <b>BRAVA</b>
            <small>SEGURIDAD · SIGR</small>
          </span>
        </div>
        <div className="auth-spinner" aria-hidden="true" />
        <p className="auth-loading-text">{message}</p>
      </div>
    </div>
  );
}
