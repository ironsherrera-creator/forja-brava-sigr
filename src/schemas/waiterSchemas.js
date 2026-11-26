import { z } from 'zod';

export const waiterOrderLineSchema = z.object({
  productId: z.string().uuid('Producto inválido.'),
  quantity: z.coerce.number().int().min(1, 'La cantidad mínima es 1.').max(50, 'Máximo 50 unidades por línea.'),
  addonIds: z.array(z.string().uuid()).default([]),
  notes: z.string().trim().max(200, 'Máximo 200 caracteres por observación de producto.').optional().default(''),
});

export const waiterCreateOrderSchema = z.object({
  tableId: z.string().uuid('Debes seleccionar una mesa válida.'),
  notes: z.string().trim().max(300, 'Máximo 300 caracteres para observaciones generales.').optional().default(''),
  items: z.array(waiterOrderLineSchema).min(1, 'Agrega al menos un producto a la comanda.'),
});
