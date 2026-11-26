/**
 * Cálculos financieros puros de Caja y Arqueo (FORJA BRAVA — SIGR).
 * Alineados 1:1 con `public.close_cash_session` (Migración 05):
 *   expected_cash = opening_balance + cash_sales - cash_refunds + manual_in_cash - manual_out_cash
 *   net_digital_sales = digital_sales - digital_refunds
 * Los pagos digitales (Tarjeta, Nequi, PSE) NUNCA se suman al efectivo físico esperado.
 */
const DIGITAL_METHODS = new Set(['Tarjeta', 'Nequi', 'PSE']);

export function calculateCashSessionSummary(session, movements = []) {
  const openingBalance = Number(session?.opening_balance) || 0;

  let cashSales = 0;
  let cashRefunds = 0;
  let digitalSales = 0;
  let digitalRefunds = 0;
  let manualIncomeCash = 0;
  let manualExpenseCash = 0;
  let manualIncomeDigital = 0;
  let manualExpenseDigital = 0;

  const byMethod = {
    Efectivo: 0,
    Tarjeta: 0,
    Nequi: 0,
    PSE: 0,
  };

  for (const m of movements) {
    const amt = Number(m.amount) || 0;
    const isCash = m.payment_method === 'Efectivo';
    const isDigital = DIGITAL_METHODS.has(m.payment_method);

    if (m.movement_type === 'sale') {
      if (isCash) cashSales += amt;
      else if (isDigital) digitalSales += amt;
      if (Object.hasOwn(byMethod, m.payment_method)) {
        byMethod[m.payment_method] += amt;
      }
    } else if (m.movement_type === 'refund') {
      if (isCash) cashRefunds += amt;
      else if (isDigital) digitalRefunds += amt;
    } else if (m.movement_type === 'manual_income') {
      if (isCash) manualIncomeCash += amt;
      else if (isDigital) manualIncomeDigital += amt;
    } else if (m.movement_type === 'manual_expense') {
      if (isCash) manualExpenseCash += amt;
      else if (isDigital) manualExpenseDigital += amt;
    }
  }

  const expectedCash =
    openingBalance + cashSales - cashRefunds + manualIncomeCash - manualExpenseCash;
  const netDigitalSales = digitalSales - digitalRefunds;
  const totalSalesGross = cashSales + digitalSales;

  return {
    openingBalance,
    cashSales,
    cashRefunds,
    digitalSales,
    digitalRefunds,
    netDigitalSales,
    manualIncomeCash,
    manualExpenseCash,
    manualIncomeDigital,
    manualExpenseDigital,
    totalSalesGross,
    expectedCash,
    byMethod,
  };
}

export function calculateCashDifference(countedCash, expectedCash) {
  const counted = Number(countedCash);
  const expected = Number(expectedCash) || 0;
  if (Number.isNaN(counted)) return 0;
  return counted - expected;
}

export function calculateCashChange(receivedAmount, amountDue) {
  const received = Number(receivedAmount);
  const due = Number(amountDue) || 0;
  if (Number.isNaN(received) || received < due) return 0;
  return received - due;
}

/**
 * Valida el importe recibido en efectivo antes de cobrar en Caja (AUD811-07):
 * - En medios digitales (Tarjeta, Nequi, PSE), no admite efectivo recibido ni calcula cambio.
 * - En Efectivo, si se ingresa un valor, rechaza importes negativos, con más de 2 decimales o menores al saldo pendiente.
 */
export function validateCashReceived({
  method = 'Efectivo',
  receivedInput = '',
  amountDue = 0,
} = {}) {
  const due = Math.max(0, Number(amountDue) || 0);
  const raw = receivedInput === null || receivedInput === undefined ? '' : String(receivedInput).trim();

  if (method !== 'Efectivo') {
    if (raw !== '') {
      return {
        valid: false,
        receivedAmount: null,
        change: 0,
        error: 'El monto recibido en efectivo no aplica para medios digitales.',
      };
    }
    return { valid: true, receivedAmount: null, change: 0, error: '' };
  }

  if (raw === '') {
    return { valid: true, receivedAmount: null, change: 0, error: '' };
  }

  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) {
    return {
      valid: false,
      receivedAmount: null,
      change: 0,
      error: 'El importe recibido en efectivo no puede ser negativo.',
    };
  }

  if (Math.round(num * 100) !== num * 100) {
    return {
      valid: false,
      receivedAmount: null,
      change: 0,
      error: 'El importe recibido debe tener máximo 2 decimales.',
    };
  }

  if (num < due) {
    return {
      valid: false,
      receivedAmount: num,
      change: 0,
      error: 'El efectivo recibido es inferior al saldo pendiente a cobrar.',
    };
  }

  return {
    valid: true,
    receivedAmount: num,
    change: Math.round((num - due) * 100) / 100,
    error: '',
  };
}
