// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asSystem,
  asUser,
  createMigratedDb,
  expectSqlError,
} from './helpers/pgliteHarness';

const TEST_ACCOUNTS = [
  { email: 'cliente@forjabrava.com', role: 'cliente', fullName: 'Valentina Gómez (Prueba)' },
  { email: 'mesero@forjabrava.com', role: 'mesero', fullName: 'Mateo Ríos (Prueba)' },
  { email: 'admin@forjabrava.com', role: 'administrador', fullName: 'Camila Herrera (Prueba)' },
];

describe('Validación Multirol — Cuentas de prueba, Perfiles, RLS y Límites de Permisos (PostgreSQL real)', () => {
  let db;
  const userIds = {};

  beforeAll(async () => {
    db = await createMigratedDb();
    await asSystem(db);

    // 1. Insertar las 3 cuentas en auth.users simulando creación en Supabase Auth
    for (const acc of TEST_ACCOUNTS) {
      const id = (await db.query(`SELECT gen_random_uuid() AS id`)).rows[0].id;
      userIds[acc.role] = id;
      await db.query(
        `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)`,
        [id, acc.email, JSON.stringify({ full_name: acc.fullName, phone: '+57 300 100 0000' })],
      );
    }
  }, 60000);

  afterAll(async () => {
    if (db) await db.close();
  });

  it('asigna rol cliente por defecto al crear usuarios en auth.users y permite promoción administrativa controlada a mesero y administrador', async () => {
    await asSystem(db);

    // Verificar que el trigger on_auth_user_created asignó 'cliente' a las 3 cuentas inicialmente
    const initialProfiles = await db.query(
      `SELECT p.email, r.code AS role_code, p.is_active
       FROM public.profiles p
       JOIN public.roles r ON r.id = p.role_id
       WHERE p.id = ANY($1::uuid[])
       ORDER BY p.email`,
      [Object.values(userIds)],
    );
    expect(initialProfiles.rows).toHaveLength(3);
    for (const row of initialProfiles.rows) {
      expect(row.role_code).toBe('cliente');
      expect(row.is_active).toBe(true);
    }

    // Promover únicamente admin@forjabrava.com -> administrador y mesero@forjabrava.com -> mesero
    await db.query(
      `UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE code = 'administrador') WHERE id = $1`,
      [userIds.administrador],
    );
    await db.query(
      `UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE code = 'mesero') WHERE id = $1`,
      [userIds.mesero],
    );

    const promoted = await db.query(
      `SELECT p.email, r.code AS role_code, p.is_active
       FROM public.profiles p
       JOIN public.roles r ON r.id = p.role_id
       WHERE p.id = ANY($1::uuid[])
       ORDER BY p.email`,
      [Object.values(userIds)],
    );

    expect(promoted.rows).toEqual([
      { email: 'admin@forjabrava.com', role_code: 'administrador', is_active: true },
      { email: 'cliente@forjabrava.com', role_code: 'cliente', is_active: true },
      { email: 'mesero@forjabrava.com', role_code: 'mesero', is_active: true },
    ]);
  });

  it('impide autoescalamiento de rol por cliente o mesero y bloquea acceso no autorizado a Caja, Reportes y Administración', async () => {
    await asSystem(db);
    const adminRoleId = (await db.query(`SELECT id FROM public.roles WHERE code = 'administrador'`)).rows[0].id;
    const categoryId = (await db.query(`SELECT id FROM public.categories LIMIT 1`)).rows[0].id;

    // 1. Cliente: bloqueado en escalamiento de rol, caja, reportes, usuarios, catálogo y directorio de salón
    await asUser(db, userIds.cliente);
    expect(
      await expectSqlError(
        db.query(`UPDATE public.profiles SET role_id = $1 WHERE id = $2`, [adminRoleId, userIds.cliente]),
      ),
    ).toContain('FORBIDDEN_ROLE_CHANGE');
    expect(
      await expectSqlError(db.query(`SELECT * FROM public.open_cash_session(100000, 'Intento cliente')`)),
    ).toContain('FORBIDDEN_ROLE');
    expect(
      await expectSqlError(
        db.query(`SELECT public.get_admin_reports_summary(NULL, NULL, NULL, NULL, NULL, NULL, NULL)`),
      ),
    ).toContain('FORBIDDEN_ROLE');
    expect(
      await expectSqlError(
        db.query(`SELECT * FROM public.admin_update_user_account($1::uuid, 'administrador', true)`, [
          userIds.cliente,
        ]),
      ),
    ).toContain('FORBIDDEN_ROLE');
    expect(
      await expectSqlError(db.query(`SELECT * FROM public.get_salon_staff_directory()`)),
    ).toContain('FORBIDDEN_ROLE');

    // RLS: cliente solo puede ver su propio perfil y no ve permissions/audit_logs/cash_sessions
    const cliProfiles = await db.query(`SELECT email FROM public.profiles`);
    expect(cliProfiles.rows).toEqual([{ email: 'cliente@forjabrava.com' }]);
    expect((await db.query(`SELECT * FROM public.permissions`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT * FROM public.cash_sessions`)).rows).toHaveLength(0);
    expect((await db.query(`SELECT * FROM public.audit_logs`)).rows).toHaveLength(0);

    // 2. Mesero: puede consultar directorio operativo de salón, pero bloqueado en caja, reportes, catálogo y usuarios
    await asUser(db, userIds.mesero);
    expect(
      await expectSqlError(
        db.query(`UPDATE public.profiles SET role_id = $1 WHERE id = $2`, [adminRoleId, userIds.mesero]),
      ),
    ).toContain('FORBIDDEN_ROLE_CHANGE');
    expect(
      await expectSqlError(db.query(`SELECT * FROM public.open_cash_session(100000, 'Intento mesero')`)),
    ).toContain('FORBIDDEN_ROLE');
    expect(
      await expectSqlError(
        db.query(`SELECT public.get_admin_reports_summary(NULL, NULL, NULL, NULL, NULL, NULL, NULL)`),
      ),
    ).toContain('FORBIDDEN_ROLE');
    expect(
      await expectSqlError(
        db.query(
          `SELECT * FROM public.admin_save_product(NULL, $1::uuid, 'No permitido', 'no-permitido', '', NULL, 15000, NULL, NULL, false, true, ARRAY[]::uuid[], false)`,
          [categoryId],
        ),
      ),
    ).toContain('FORBIDDEN_ROLE');
    expect(
      await expectSqlError(
        db.query(`SELECT * FROM public.admin_update_user_account($1::uuid, 'cliente', false)`, [
          userIds.cliente,
        ]),
      ),
    ).toContain('FORBIDDEN_ROLE');

    const staffDir = await db.query(`SELECT staff_id, visible_name, role_code FROM public.get_salon_staff_directory()`);
    expect(staffDir.rows.some((r) => r.staff_id === userIds.mesero)).toBe(true);

    // 3. Administrador: acceso autorizado a reportes, caja, perfiles y permisos
    await asUser(db, userIds.administrador);
    const allProfiles = await db.query(`SELECT email FROM public.profiles ORDER BY email`);
    expect(allProfiles.rows).toHaveLength(3);
    const perms = await db.query(`SELECT code FROM public.permissions`);
    expect(perms.rows.length).toBeGreaterThanOrEqual(15);
    const rep = await db.query(
      `SELECT public.get_admin_reports_summary(NULL, NULL, NULL, NULL, NULL, NULL, NULL) AS summary`,
    );
    expect(rep.rows[0].summary.sales).toBeTruthy();
  });
});
