/**
 * Mapeo visual de estados de pedido a variantes de Badge del sistema de diseño.
 */
export function getOrderStatusBadgeVariant(status) {
  switch (status) {
    case 'Entregado':
      return 'success';
    case 'Cancelado':
      return 'error';
    case 'Listo':
    case 'Despachado':
      return 'fire';
    case 'Confirmado':
    case 'En preparación':
      return 'info';
    default:
      return 'warning';
  }
}
