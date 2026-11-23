import { StageNotice } from '../components/StageNotice';

export function ClientPlaceholderPage() {
  return (
    <StageNotice
      kicker="FORJA BRAVA · EXPERIENCIA DEL CLIENTE"
      title="Área de"
      accent="Cliente."
      description="Esta ruta queda preparada dentro de la nueva arquitectura React + Vite. En etapas posteriores se integrará con Supabase Auth y PostgreSQL para ofrecer la experiencia completa del cliente."
      plannedModules={[
        'Registro, inicio de sesión y recuperación de contraseña',
        'Dashboard personal, perfil y libreta de direcciones',
        'Carrito persistente y Checkout en 5 pasos (Domicilio, Recoger, Mesa)',
        'Pagos simulados, comprobante imprimible y seguimiento en vivo',
        'Reservas públicas con disponibilidad y confirmación automática',
      ]}
    />
  );
}
