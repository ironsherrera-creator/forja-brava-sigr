import { StageNotice } from '../components/StageNotice';

export function WaiterPlaceholderPage() {
  return (
    <StageNotice
      kicker="FORJA BRAVA · SERVICIO EN SALÓN"
      title="Panel del"
      accent="Mesero."
      description="Ruta base reservada para el panel operativo táctil del mesero. Su implementación completa con control de rol y persistencia en tiempo real se realizará en etapas posteriores."
      plannedModules={[
        'Dashboard operativo con alertas de pedidos listos para entregar',
        'Mapa y cuadrícula de mesas configurables con estados en vivo',
        'Toma de comandas multi-producto reutilizando el catálogo',
        'Entrega de pedidos y cancelación restringida a pedidos recién registrados',
        'Consulta de cuenta acumulada de mesa y solicitud de cierre',
      ]}
    />
  );
}
