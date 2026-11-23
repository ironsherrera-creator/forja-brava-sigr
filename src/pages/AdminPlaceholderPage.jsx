import { StageNotice } from '../components/StageNotice';

export function AdminPlaceholderPage() {
  return (
    <StageNotice
      kicker="FORJA BRAVA · SIGR ADMINISTRACIÓN"
      title="Panel"
      accent="Administrativo."
      description="Ruta base preparada para migrar progresivamente el panel administrativo SIGR existente hacia React + Supabase con políticas RLS y control de roles en servidor."
      plannedModules={[
        'Dashboard KPI diario en zona horaria America/Bogota',
        'Gestión de productos (Storage), categorías y complementos',
        'Gestión de pedidos y control de estados de preparación',
        'Gestión de reservas con calendario e inventario dinámico de mesas',
        'Usuarios y roles, Caja completa con arqueo, Reportes, Auditoría y Configuración',
      ]}
    />
  );
}
