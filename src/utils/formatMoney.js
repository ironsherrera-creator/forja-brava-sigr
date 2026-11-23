export function formatMoney(value, currency = 'COP') {
  const numericValue = Number(value) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(numericValue);
}
