import { describe, expect, it } from 'vitest';
import { validateRuntimeEnv } from '../../src/lib/env';
import { getAuthRedirectUrl } from '../../src/lib/supabase';
import { mapSupabaseAuthError } from '../../src/services/authService';
import {
  canRoleAccessPath,
  canRolePerform,
  getDefaultRouteForRole,
  hasAllowedRole,
  isValidRole,
  resolvePostAuthRedirect,
  ROLES,
} from '../../src/utils/rbac';

describe('Validación de entorno y cliente Supabase', () => {
  it('detecta ausencia de VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY sin filtrar secretos', () => {
    const result = validateRuntimeEnv({});
    expect(result.isSupabaseConfigured).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('VITE_SUPABASE_URL');
    expect(result.errors[1]).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('rechaza URLs de Supabase con protocolo inválido', () => {
    const result = validateRuntimeEnv({
      VITE_SUPABASE_URL: 'ftp://proyecto-invalido.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-placeholder',
    });
    expect(result.isSupabaseConfigured).toBe(false);
    expect(result.errors[0]).toContain('formato de URL válido');
  });

  it('aprueba una configuración pública válida', () => {
    const result = validateRuntimeEnv({
      VITE_SUPABASE_URL: 'https://demo-ref.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-placeholder',
    });
    expect(result.isSupabaseConfigured).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.env.VITE_APP_TIMEZONE).toBe('America/Bogota');
  });

  it('construye URLs de redirección internas seguras bloqueando rutas protocolo-relativas', () => {
    expect(getAuthRedirectUrl('/actualizar-contrasena')).toMatch(
      /\/actualizar-contrasena$/,
    );
    expect(getAuthRedirectUrl('//sitio-malicioso.com')).toMatch(/\/$/);
    expect(getAuthRedirectUrl('https://sitio-malicioso.com')).toMatch(/\/$/);
  });
});

describe('RBAC — Roles, permisos y sanitización de redirecciones', () => {
  it('reconoce únicamente los tres roles oficiales del dominio', () => {
    expect(isValidRole(ROLES.CLIENTE)).toBe(true);
    expect(isValidRole(ROLES.MESERO)).toBe(true);
    expect(isValidRole(ROLES.ADMINISTRADOR)).toBe(true);
    expect(isValidRole('superadmin')).toBe(false);
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole('')).toBe(false);
  });

  it('evalúa listas de roles permitidos con política de denegación ante rol nulo', () => {
    expect(hasAllowedRole(ROLES.ADMINISTRADOR, [ROLES.ADMINISTRADOR])).toBe(true);
    expect(hasAllowedRole(ROLES.CLIENTE, [ROLES.ADMINISTRADOR, ROLES.MESERO])).toBe(
      false,
    );
    expect(hasAllowedRole(null, [ROLES.CLIENTE])).toBe(false);
  });

  it('separa estrictamente capacidades de cliente, mesero y administrador', () => {
    expect(canRolePerform(ROLES.CLIENTE, 'orders.create_client')).toBe(true);
    expect(canRolePerform(ROLES.CLIENTE, 'cash.manage')).toBe(false);
    expect(canRolePerform(ROLES.CLIENTE, 'orders.create_table')).toBe(false);

    expect(canRolePerform(ROLES.MESERO, 'orders.create_table')).toBe(true);
    expect(canRolePerform(ROLES.MESERO, 'table_accounts.request_close')).toBe(true);
    expect(canRolePerform(ROLES.MESERO, 'cash.manage')).toBe(false);
    expect(canRolePerform(ROLES.MESERO, 'users.manage')).toBe(false);

    expect(canRolePerform(ROLES.ADMINISTRADOR, 'cash.manage')).toBe(true);
    expect(canRolePerform(ROLES.ADMINISTRADOR, 'users.manage')).toBe(true);
    expect(canRolePerform(ROLES.ADMINISTRADOR, 'audit.read')).toBe(true);
  });

  it('resuelve la ruta inicial correcta para cada rol', () => {
    expect(getDefaultRouteForRole(ROLES.ADMINISTRADOR)).toBe('/admin');
    expect(getDefaultRouteForRole(ROLES.MESERO)).toBe('/mesero');
    expect(getDefaultRouteForRole(ROLES.CLIENTE)).toBe('/cliente');
    expect(getDefaultRouteForRole(null)).toBe('/');
  });

  it('verifica acceso por prefijo de ruta privada', () => {
    expect(canRoleAccessPath(ROLES.CLIENTE, '/cliente/pedidos')).toBe(true);
    expect(canRoleAccessPath(ROLES.CLIENTE, '/admin')).toBe(false);
    expect(canRoleAccessPath(ROLES.CLIENTE, '/mesero')).toBe(false);
    expect(canRoleAccessPath(ROLES.MESERO, '/mesero/mesas')).toBe(true);
    expect(canRoleAccessPath(ROLES.MESERO, '/admin/caja')).toBe(false);
    expect(canRoleAccessPath(ROLES.ADMINISTRADOR, '/admin/usuarios')).toBe(true);
    expect(canRoleAccessPath(ROLES.ADMINISTRADOR, '/cliente')).toBe(false);
  });

  it('previene Open Redirect, bucles de login y redirecciones cruzadas no autorizadas', () => {
    expect(
      resolvePostAuthRedirect('https://attacker.example/phish', ROLES.CLIENTE),
    ).toBe('/cliente');
    expect(resolvePostAuthRedirect('//attacker.example', ROLES.MESERO)).toBe(
      '/mesero',
    );
    expect(resolvePostAuthRedirect('/\\attacker.example', ROLES.CLIENTE)).toBe(
      '/cliente',
    );
    expect(resolvePostAuthRedirect('/login', ROLES.ADMINISTRADOR)).toBe('/admin');
    expect(resolvePostAuthRedirect('/registro', ROLES.CLIENTE)).toBe('/cliente');
    expect(resolvePostAuthRedirect('/admin/caja', ROLES.CLIENTE)).toBe(
      '/cliente',
    );
    expect(
      resolvePostAuthRedirect('/cliente/reservas?tab=activas', ROLES.CLIENTE),
    ).toBe('/cliente/reservas?tab=activas');
  });
});

describe('Mapeo seguro de errores de autenticación', () => {
  it('traduce errores técnicos de Supabase a mensajes amigables en español sin exponer trazas', () => {
    expect(
      mapSupabaseAuthError({ message: 'Invalid login credentials' }),
    ).toBe('El correo electrónico o la contraseña no son correctos.');

    expect(mapSupabaseAuthError({ code: 'email_not_confirmed' })).toContain(
      'confirmar tu correo electrónico',
    );

    expect(mapSupabaseAuthError({ code: 'over_email_send_rate_limit' })).toContain(
      'demasiados intentos',
    );

    expect(mapSupabaseAuthError({ code: 'otp_expired' })).toContain(
      'inválido o ha expirado',
    );
  });
});
