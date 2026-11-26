import { z } from 'zod';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9 ()-]{7,24}$/;

export const emailSchema = z
  .string({ error: 'El correo electrónico es obligatorio.' })
  .trim()
  .min(1, 'El correo electrónico es obligatorio.')
  .max(180, 'El correo electrónico no puede superar 180 caracteres.')
  .transform((val) => val.toLowerCase())
  .refine((val) => EMAIL_REGEX.test(val), {
    message: 'Ingresa un correo electrónico con formato válido.',
  });

export const loginPasswordSchema = z
  .string({ error: 'La contraseña es obligatoria.' })
  .min(1, 'Ingresa tu contraseña.')
  .max(128, 'La contraseña excede la longitud máxima permitida.');

export const strongPasswordSchema = z
  .string({ error: 'La contraseña es obligatoria.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña no puede superar 128 caracteres.')
  .refine((val) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(val), {
    message: 'La contraseña debe incluir al menos una letra.',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'La contraseña debe incluir al menos un número.',
  });

export const fullNameSchema = z
  .string({ error: 'El nombre completo es obligatorio.' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(120, 'El nombre no puede superar 120 caracteres.');

export const phoneOptionalSchema = z
  .string()
  .trim()
  .max(30, 'El teléfono no puede superar 30 caracteres.')
  .optional()
  .default('')
  .refine((val) => val === '' || PHONE_REGEX.test(val), {
    message: 'Ingresa un teléfono válido (7 a 24 dígitos/símbolos).',
  });

export const loginSchema = z
  .object({
    email: emailSchema,
    password: loginPasswordSchema,
  })
  .strict();

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneOptionalSchema,
    password: strongPasswordSchema,
    confirmPassword: z
      .string({ error: 'Confirma tu contraseña.' })
      .min(1, 'Debes confirmar tu contraseña.'),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z
      .string({ error: 'Confirma tu nueva contraseña.' })
      .min(1, 'Debes confirmar tu nueva contraseña.'),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export const profileUpdateSchema = z
  .object({
    fullName: fullNameSchema,
    phone: phoneOptionalSchema,
  })
  .strict();

/**
 * Convierte un ZodError en un mapa plano { campo: primerMensaje } apto para UI.
 */
export function extractFieldErrors(zodError) {
  const fieldErrors = {};
  if (!zodError?.issues) return fieldErrors;

  for (const issue of zodError.issues) {
    const key = issue.path?.[0] ? String(issue.path[0]) : '_form';
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}
