import { z } from 'zod';

export const PAYMENT_METHODS_LIST = ['Efectivo', 'Tarjeta', 'Nequi', 'PSE'];

export const openCashSessionSchema = z.object({
  openingBalance: z.coerce
    .number({ error: 'Ingresa un saldo inicial válido.' })
    .min(0, 'El saldo inicial no puede ser negativo.'),
  notes: z.string().trim().max(300, 'Máximo 300 caracteres.').optional().default(''),
});

export const cashMovementSchema = z.object({
  movementType: z.enum(['manual_income', 'manual_expense']),
  paymentMethod: z.enum(['Efectivo', 'Tarjeta', 'Nequi', 'PSE']),
  amount: z.coerce
    .number({ error: 'Ingresa un monto válido.' })
    .positive('El monto debe ser mayor a 0.'),
  concept: z
    .string({ error: 'El concepto es obligatorio.' })
    .trim()
    .min(2, 'El concepto debe tener al menos 2 caracteres.')
    .max(200, 'Máximo 200 caracteres.'),
});

export const closeCashSessionSchema = z.object({
  countedCash: z.coerce
    .number({ error: 'Ingresa el efectivo contado.' })
    .min(0, 'El efectivo contado no puede ser negativo.'),
  notes: z.string().trim().max(400, 'Máximo 400 caracteres.').optional().default(''),
});
