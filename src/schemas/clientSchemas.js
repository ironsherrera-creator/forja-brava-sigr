import { z } from 'zod';

export const addressSchema = z
  .object({
    label: z
      .string({ error: 'La etiqueta es obligatoria.' })
      .trim()
      .min(2, 'Ingresa una etiqueta de al menos 2 caracteres (ej. Casa, Trabajo).')
      .max(60, 'La etiqueta no puede superar 60 caracteres.'),
    address: z
      .string({ error: 'La dirección es obligatoria.' })
      .trim()
      .min(4, 'Ingresa una dirección completa de al menos 4 caracteres.')
      .max(200, 'La dirección no puede superar 200 caracteres.'),
    neighborhood: z
      .string({ error: 'El barrio es obligatorio.' })
      .trim()
      .min(2, 'Ingresa el barrio (mínimo 2 caracteres).')
      .max(100, 'El barrio no puede superar 100 caracteres.'),
    directions: z
      .string()
      .trim()
      .max(300, 'Las referencias no pueden superar 300 caracteres.')
      .optional()
      .default(''),
    isDefault: z.boolean().optional().default(false),
  })
  .strict();

export const checkoutSchema = z
  .object({
    modality: z.enum(['domicilio', 'recoger', 'mesa']),
    paymentMethod: z.enum(['Efectivo', 'Tarjeta', 'Nequi', 'PSE']),
    simulatePaymentFailure: z.boolean().default(false),
    deliveryAddress: z.string().trim().max(200).optional().default(''),
    deliveryNeighborhood: z.string().trim().max(100).optional().default(''),
    deliveryDirections: z.string().trim().max(300).optional().default(''),
    pickupEta: z.string().trim().optional().default(''),
    notes: z.string().trim().max(300).optional().default(''),
    acceptTerms: z.literal(true, {
      error: 'Debes aceptar las condiciones del pedido antes de confirmar.',
    }),
  })
  .superRefine((data, ctx) => {
    if (data.modality === 'domicilio') {
      if (!data.deliveryAddress || data.deliveryAddress.length < 4) {
        ctx.addIssue({
          code: 'custom',
          path: ['deliveryAddress'],
          message: 'La dirección de entrega es obligatoria para domicilio.',
        });
      }
      if (!data.deliveryNeighborhood || data.deliveryNeighborhood.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['deliveryNeighborhood'],
          message: 'El barrio es obligatorio para domicilio.',
        });
      }
    }
  });

export const reservationCreateSchema = z
  .object({
    date: z
      .string({ error: 'Selecciona una fecha.' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD).'),
    time: z
      .string({ error: 'Selecciona un horario disponible.' })
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Selecciona una franja horaria válida.'),
    partySize: z.coerce
      .number({ error: 'Indica el número de personas.' })
      .int('Debe ser un número entero.')
      .min(1, 'Mínimo 1 persona.')
      .max(30, 'Para grupos superiores a 30 personas contáctanos directamente.'),
    zone: z.string().trim().max(60).optional().default(''),
    notes: z.string().trim().max(300).optional().default(''),
  })
  .strict();

export const emailChangeSchema = z
  .object({
    email: z
      .string({ error: 'Ingresa el nuevo correo electrónico.' })
      .trim()
      .toLowerCase()
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Formato de correo inválido.')
      .max(180, 'Máximo 180 caracteres.'),
  })
  .strict();
