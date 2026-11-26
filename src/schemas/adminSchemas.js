import { z } from 'zod';

export const restaurantTableSchema = z
  .object({
    code: z
      .string({ error: 'El código de mesa es obligatorio.' })
      .trim()
      .min(1, 'Ingresa un código o número de mesa (ej. M-01).')
      .max(30, 'Máximo 30 caracteres.'),
    zone: z
      .string({ error: 'La zona es obligatoria.' })
      .trim()
      .min(2, 'Ingresa la zona (ej. Salón, Terraza, Barra).')
      .max(60, 'Máximo 60 caracteres.'),
    capacity: z.coerce
      .number({ error: 'La capacidad es obligatoria.' })
      .int('La capacidad debe ser un número entero.')
      .min(1, 'La capacidad mínima es 1 persona.')
      .max(40, 'Capacidad máxima por mesa: 40 personas.'),
    isActive: z.boolean().default(true),
  })
  .strict();

const dayScheduleSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/, 'Usa formato HH:MM.'),
  close: z.string().regex(/^\d{2}:\d{2}$/, 'Usa formato HH:MM.'),
  closed: z.boolean(),
});

export const restaurantScheduleConfigSchema = z.object({
  restaurant_name: z.string().trim().min(2, 'Nombre obligatorio.').max(120),
  location: z.string().trim().min(4, 'Ubicación obligatoria.').max(200),
  phone: z.string().trim().min(7, 'Teléfono obligatorio.').max(40),
  fixed_delivery_fee: z.coerce.number().min(0, 'La tarifa no puede ser negativa.'),
  reservation_duration_minutes: z.coerce
    .number()
    .int()
    .min(15, 'La duración mínima es 15 minutos.')
    .max(360, 'Duración máxima: 360 minutos.'),
  reservation_cancel_cutoff_minutes: z.coerce
    .number()
    .int()
    .min(0, 'No puede ser negativo.')
    .max(1440, 'Máximo 1440 minutos.'),
  allow_client_table_orders: z.boolean(),
  business_hours: z.object({
    monday: dayScheduleSchema,
    tuesday: dayScheduleSchema,
    wednesday: dayScheduleSchema,
    thursday: dayScheduleSchema,
    friday: dayScheduleSchema,
    saturday: dayScheduleSchema,
    sunday: dayScheduleSchema,
  }),
});
