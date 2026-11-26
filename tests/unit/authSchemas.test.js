import { describe, expect, it } from 'vitest';
import {
  extractFieldErrors,
  forgotPasswordSchema,
  loginSchema,
  profileUpdateSchema,
  registerSchema,
  resetPasswordSchema,
} from '../../src/schemas/authSchemas';

describe('authSchemas — Validación estricta con Zod', () => {
  describe('loginSchema', () => {
    it('acepta credenciales válidas y normaliza el correo a minúsculas sin espacios laterales', () => {
      const parsed = loginSchema.safeParse({
        email: '  Cliente.Forja@Ejemplo.COM  ',
        password: 'Password123',
      });

      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({
        email: 'cliente.forja@ejemplo.com',
        password: 'Password123',
      });
    });

    it('rechaza correos mal formados o contraseñas vacías', () => {
      const parsed = loginSchema.safeParse({
        email: 'correo-invalido',
        password: '',
      });

      expect(parsed.success).toBe(false);
      const errors = extractFieldErrors(parsed.error);
      expect(errors.email).toBeTruthy();
      expect(errors.password).toBeTruthy();
    });

    it('rechaza propiedades no autorizadas gracias a .strict()', () => {
      const parsed = loginSchema.safeParse({
        email: 'cliente@ejemplo.com',
        password: 'Password123',
        role: 'administrador',
      });

      expect(parsed.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('valida un registro completo de cliente con teléfono opcional', () => {
      const parsed = registerSchema.safeParse({
        fullName: '  Valentina Gómez  ',
        email: 'Valentina@ForjaBrava.com',
        phone: '+57 300 123 4567',
        password: 'Brava2026',
        confirmPassword: 'Brava2026',
      });

      expect(parsed.success).toBe(true);
      expect(parsed.data.fullName).toBe('Valentina Gómez');
      expect(parsed.data.email).toBe('valentina@forjabrava.com');
      expect(parsed.data.phone).toBe('+57 300 123 4567');
    });

    it('permite omitir el teléfono opcional normalizándolo a cadena vacía', () => {
      const parsed = registerSchema.safeParse({
        fullName: 'Carlos Ruiz',
        email: 'carlos@ejemplo.com',
        password: 'Fuego2026',
        confirmPassword: 'Fuego2026',
      });

      expect(parsed.success).toBe(true);
      expect(parsed.data.phone).toBe('');
    });

    it('rechaza contraseñas débiles (menos de 8 caracteres, sin números o sin letras)', () => {
      const shortPwd = registerSchema.safeParse({
        fullName: 'Ana Pérez',
        email: 'ana@ejemplo.com',
        password: 'Ab1',
        confirmPassword: 'Ab1',
      });
      expect(shortPwd.success).toBe(false);

      const noNumbers = registerSchema.safeParse({
        fullName: 'Ana Pérez',
        email: 'ana@ejemplo.com',
        password: 'SoloLetrasPassword',
        confirmPassword: 'SoloLetrasPassword',
      });
      expect(noNumbers.success).toBe(false);

      const noLetters = registerSchema.safeParse({
        fullName: 'Ana Pérez',
        email: 'ana@ejemplo.com',
        password: '1234567890',
        confirmPassword: '1234567890',
      });
      expect(noLetters.success).toBe(false);
    });

    it('rechaza cuando la confirmación de contraseña no coincide', () => {
      const parsed = registerSchema.safeParse({
        fullName: 'Ana Pérez',
        email: 'ana@ejemplo.com',
        password: 'Brava2026',
        confirmPassword: 'OtraPassword99',
      });

      expect(parsed.success).toBe(false);
      const errors = extractFieldErrors(parsed.error);
      expect(errors.confirmPassword).toBe('Las contraseñas no coinciden.');
    });

    it('bloquea intentos de inyección de rol o estado activo en el registro público', () => {
      const parsed = registerSchema.safeParse({
        fullName: 'Atacante Prueba',
        email: 'atacante@ejemplo.com',
        password: 'Brava2026',
        confirmPassword: 'Brava2026',
        role: 'administrador',
        is_active: true,
      });

      expect(parsed.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema, resetPasswordSchema y profileUpdateSchema', () => {
    it('valida el correo de recuperación y rechaza vacíos', () => {
      expect(
        forgotPasswordSchema.safeParse({ email: 'usuario@dominio.co' }).success,
      ).toBe(true);
      expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
    });

    it('exige contraseña robusta y confirmación idéntica en resetPasswordSchema', () => {
      expect(
        resetPasswordSchema.safeParse({
          password: 'NuevaClave2026',
          confirmPassword: 'NuevaClave2026',
        }).success,
      ).toBe(true);

      const mismatch = resetPasswordSchema.safeParse({
        password: 'NuevaClave2026',
        confirmPassword: 'NuevaClave2027',
      });
      expect(mismatch.success).toBe(false);
      expect(extractFieldErrors(mismatch.error).confirmPassword).toBe(
        'Las contraseñas no coinciden.',
      );
    });

    it('valida actualización de perfil propio y bloquea escalamiento de rol', () => {
      const valid = profileUpdateSchema.safeParse({
        fullName: 'Camila Torres',
        phone: '3105551234',
      });
      expect(valid.success).toBe(true);

      const injected = profileUpdateSchema.safeParse({
        fullName: 'Camila Torres',
        phone: '3105551234',
        role_id: '00000000-0000-0000-0000-000000000001',
      });
      expect(injected.success).toBe(false);
    });
  });
});
