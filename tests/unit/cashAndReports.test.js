import { describe, expect, it } from 'vitest';
import {
  cashMovementSchema,
  closeCashSessionSchema,
  openCashSessionSchema,
} from '../../src/schemas/cashSchemas';
import { getOrderRefundSummary } from '../../src/services/adminOrdersService';
import { mapCashRpcError } from '../../src/services/cashService';
import { aggregateReportsData } from '../../src/services/reportsService';
import {
  calculateCashChange,
  calculateCashDifference,
  calculateCashSessionSummary,
  validateCashReceived,
} from '../../src/utils/cashCalculations';
import { buildReportCsv } from '../../src/utils/exportReports';

describe('Etapas 10 y 11 — Cálculos de Caja, Esquemas Zod, Reportes y CSV', () => {
  it('calcula efectivo físico esperado sin sumar pagos digitales y separa ventas digitales netas', () => {
    const summary = calculateCashSessionSummary(
      { opening_balance: 100000 },
      [
        { movement_type: 'sale', payment_method: 'Efectivo', amount: 50000 },
        { movement_type: 'sale', payment_method: 'Nequi', amount: 80000 },
        { movement_type: 'sale', payment_method: 'Tarjeta', amount: 40000 },
        { movement_type: 'refund', payment_method: 'Efectivo', amount: 10000 },
        { movement_type: 'refund', payment_method: 'Nequi', amount: 20000 },
        { movement_type: 'manual_income', payment_method: 'Efectivo', amount: 15000 },
        { movement_type: 'manual_expense', payment_method: 'Efectivo', amount: 25000 },
      ],
    );

    // 100k + 50k - 10k + 15k - 25k = 130k (Nequi y Tarjeta NO suman al efectivo físico)
    expect(summary.expectedCash).toBe(130000);
    // (80k + 40k) - 20k = 100k
    expect(summary.netDigitalSales).toBe(100000);
    expect(summary.byMethod.Nequi).toBe(80000);
    expect(summary.byMethod.Tarjeta).toBe(40000);

    expect(calculateCashDifference(128000, summary.expectedCash)).toBe(-2000);
    expect(calculateCashDifference(135000, summary.expectedCash)).toBe(5000);
    expect(calculateCashChange(50000, 32900)).toBe(17100);
    expect(calculateCashChange(20000, 32900)).toBe(0);
  });

  it('valida esquemas Zod de apertura, movimiento y cierre de caja', () => {
    expect(openCashSessionSchema.safeParse({ openingBalance: 50000 }).success).toBe(true);
    expect(openCashSessionSchema.safeParse({ openingBalance: -1 }).success).toBe(false);

    expect(
      cashMovementSchema.safeParse({
        movementType: 'manual_expense',
        paymentMethod: 'Efectivo',
        amount: 12000,
        concept: 'Compra de hielo',
      }).success,
    ).toBe(true);
    expect(
      cashMovementSchema.safeParse({
        movementType: 'manual_income',
        paymentMethod: 'Efectivo',
        amount: 0,
        concept: 'x',
      }).success,
    ).toBe(false);

    expect(closeCashSessionSchema.safeParse({ countedCash: 0 }).success).toBe(true);
    expect(closeCashSessionSchema.safeParse({ countedCash: -5 }).success).toBe(false);
  });

  it('agrega reportes sin duplicar montos por joins y diferencia ventas vs pagos confirmados', () => {
    const agg = aggregateReportsData({
      orders: [
        { id: 'o1', modality: 'domicilio', status: 'Entregado', total: 35000, created_at: '2026-11-25T15:00:00Z' },
        { id: 'o2', modality: 'mesa', status: 'Cancelado', total: 20000, created_at: '2026-11-25T16:00:00Z' },
      ],
      orderItems: [
        { id: 'i1', order_id: 'o1', product_id: 'p1', product_name_snapshot: 'La Forjada', quantity: 1, line_total: 28900 },
        { id: 'i2', order_id: 'o1', product_id: 'p2', product_name_snapshot: 'Adición', quantity: 1, line_total: 6100 },
        { id: 'i3', order_id: 'o2', product_id: 'p1', product_name_snapshot: 'La Forjada', quantity: 1, line_total: 20000 },
      ],
      payments: [
        { id: 'pay1', method: 'Nequi', status: 'Confirmación simulada', amount: 35000, paid_at: '2026-11-25T15:01:00Z' },
      ],
      reservations: [{ id: 'r1', reservation_date: '2026-11-25', status: 'Confirmada' }],
      accounts: [{ id: 'a1', status: 'open', total_amount: 0 }],
      cashSessions: [{ id: 'cs1', opened_at: '2026-11-25T14:00:00Z', difference: -1000 }],
      products: [{ id: 'p1', category_id: 'c1', name: 'La Forjada' }],
      categories: [{ id: 'c1', name: 'Hamburguesas' }],
    });

    expect(agg.sales.totalOrders).toBe(2);
    expect(agg.sales.validOrdersCount).toBe(1);
    expect(agg.sales.totalSales).toBe(35000);
    expect(agg.payments.totalPaid).toBe(35000);
    expect(agg.payments.byMethod.Nequi).toBe(35000);
    expect(agg.products.topProducts[0].name).toBe('La Forjada');
    expect(agg.cash.totalDifference).toBe(-1000);
  });

  it('construye CSV con metadatos de período y mapea errores de caja', () => {
    const csv = buildReportCsv({
      reportName: 'Ventas',
      periodLabel: '2026-11-01 a 2026-11-25',
      headers: ['Producto', 'Total'],
      rows: [['La "Forjada"', 28900]],
    });
    expect(csv).toContain('# Reporte: Ventas');
    expect(csv).toContain('# Periodo: 2026-11-01 a 2026-11-25');
    expect(csv).toContain('"La ""Forjada""",28900');
    expect(mapCashRpcError({ message: 'CASH_ALREADY_OPEN' })).toContain('Ya existe');
    expect(mapCashRpcError({ message: 'PENDING_ORDERS_IN_ACCOUNT' })).toContain('sin entregar');
    expect(mapCashRpcError({ message: 'INSUFFICIENT_CASH_RECEIVED' })).toContain('inferior al saldo');
  });

  it('AUD811-07: valida monto recibido en efectivo y bloquea efectivo insuficiente, negativo o en medios digitales', () => {
    expect(validateCashReceived({ method: 'Efectivo', receivedInput: '', amountDue: 35000 })).toEqual({
      valid: true,
      receivedAmount: null,
      change: 0,
      error: '',
    });

    expect(validateCashReceived({ method: 'Efectivo', receivedInput: '50000', amountDue: 35000 })).toEqual({
      valid: true,
      receivedAmount: 50000,
      change: 15000,
      error: '',
    });

    const low = validateCashReceived({ method: 'Efectivo', receivedInput: '20000', amountDue: 35000 });
    expect(low.valid).toBe(false);
    expect(low.error).toContain('inferior al saldo');

    const neg = validateCashReceived({ method: 'Efectivo', receivedInput: '-500', amountDue: 35000 });
    expect(neg.valid).toBe(false);

    const badDec = validateCashReceived({ method: 'Efectivo', receivedInput: '35000.129', amountDue: 35000 });
    expect(badDec.valid).toBe(false);

    const digitalWithCash = validateCashReceived({ method: 'Nequi', receivedInput: '40000', amountDue: 35000 });
    expect(digitalWithCash.valid).toBe(false);

    expect(validateCashReceived({ method: 'Tarjeta', receivedInput: '', amountDue: 35000 }).valid).toBe(true);
  });

  it('AUD811-03: calcula elegibilidad y saldo reembolsable solo para pedidos cancelados con pago confirmado', () => {
    const activeOrd = getOrderRefundSummary({
      status: 'Confirmado',
      modality: 'domicilio',
      payment_status: 'Confirmación simulada',
      payments: [{ id: 'p1', method: 'Nequi', status: 'Confirmación simulada', amount: 42000, transaction_ref: 'DEMO-1' }],
    });
    expect(activeOrd.canRefund).toBe(false);

    const refundable = getOrderRefundSummary({
      status: 'Cancelado',
      modality: 'domicilio',
      payment_status: 'Confirmación simulada',
      payments: [{ id: 'p1', method: 'Efectivo', status: 'Confirmación simulada', amount: 42000, transaction_ref: 'DEMO-2' }],
    });
    expect(refundable.canRefund).toBe(true);
    expect(refundable.refundableBalance).toBe(42000);
    expect(refundable.paymentMethod).toBe('Efectivo');

    const alreadyRefunded = getOrderRefundSummary({
      status: 'Cancelado',
      modality: 'domicilio',
      payment_status: 'Reembolsado',
      payments: [{ id: 'p2', method: 'Efectivo', status: 'Reembolsado', amount: 42000, transaction_ref: 'REF-DEMO-2' }],
    });
    expect(alreadyRefunded.canRefund).toBe(false);
    expect(alreadyRefunded.refundedAmount).toBe(42000);
    expect(alreadyRefunded.refundableBalance).toBe(0);
  });
});
