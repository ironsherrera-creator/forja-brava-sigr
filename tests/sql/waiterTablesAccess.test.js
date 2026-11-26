// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asSystem, asUser, createMigratedDb, createUser, expectSqlError } from './helpers/pgliteHarness';

describe('Mesas — visibilidad del mesero, bloqueo administrativo e integridad (PostgreSQL real)', () => {
  let db;
  let adminId;
  let waiterId;
  let clientId;
  let activeTable;
  let inactiveTable;
  let productId;

  beforeAll(async () => {
    db = await createMigratedDb();
    adminId = await createUser(db, { role: 'administrador', name: 'Admin Mesas' });
    waiterId = await createUser(db, { role: 'mesero', name: 'Mesero Mesas' });
    clientId = await createUser(db, { role: 'cliente', name: 'Cliente Mesas' });
    await asSystem(db);
    productId = (await db.query(`SELECT id FROM public.products WHERE is_addon = false LIMIT 1`)).rows[0].id;

    await asUser(db, adminId);
    activeTable = (await db.query(`SELECT * FROM public.admin_save_restaurant_table(NULL, 'M-V1', 'Salón', 4::smallint, true)`)).rows[0];
    inactiveTable = (await db.query(`SELECT * FROM public.admin_save_restaurant_table(NULL, 'M-V2', 'Terraza', 2::smallint, false)`)).rows[0];
  }, 60000);

  afterAll(async () => {
    if (db) await db.close();
  });

  it('el mesero consulta mesas (activas e inactivas con su estado) y el cliente sin reservas no ve ninguna', async () => {
    await asUser(db, waiterId);
    const rows = (await db.query(`SELECT code, is_active, status FROM public.restaurant_tables ORDER BY code`)).rows;
    expect(rows.map((r) => r.code)).toEqual(['M-V1', 'M-V2']);
    expect(rows.find((r) => r.code === 'M-V2').is_active).toBe(false);

    await asUser(db, clientId);
    expect((await db.query(`SELECT * FROM public.restaurant_tables`)).rows).toHaveLength(0);
  });

  it('el mesero no puede crear, modificar ni eliminar mesas ni usar RPC administrativas', async () => {
    await asUser(db, waiterId);
    expect(await expectSqlError(db.query(`INSERT INTO public.restaurant_tables (code, zone, capacity) VALUES ('M-X', 'Salón', 2)`))).toMatch(/permission denied|row-level security/i);
    expect(await expectSqlError(db.query(`SELECT * FROM public.admin_save_restaurant_table(NULL, 'M-X', 'Salón', 2::smallint, true)`))).toContain('FORBIDDEN_ROLE');

    const upd = await db.query(`UPDATE public.restaurant_tables SET capacity = 99 WHERE id = $1`, [activeTable.id]).catch((e) => e);
    if (!(upd instanceof Error)) expect(upd.affectedRows ?? 0).toBe(0);
    const del = await db.query(`DELETE FROM public.restaurant_tables WHERE id = $1`, [activeTable.id]).catch((e) => e);
    if (!(del instanceof Error)) expect(del.affectedRows ?? 0).toBe(0);

    await asSystem(db);
    const still = (await db.query(`SELECT capacity FROM public.restaurant_tables WHERE id = $1`, [activeTable.id])).rows[0];
    expect(Number(still.capacity)).toBe(4);
  });

  it('el administrador modifica código, capacidad y activa/desactiva mesas', async () => {
    await asUser(db, adminId);
    const edited = (await db.query(`SELECT * FROM public.admin_save_restaurant_table($1::uuid, 'M-V2B', 'Terraza', 8::smallint, true)`, [inactiveTable.id])).rows[0];
    expect(edited.code).toBe('M-V2B');
    expect(Number(edited.capacity)).toBe(8);
    expect(edited.is_active).toBe(true);
    await db.query(`SELECT * FROM public.admin_save_restaurant_table($1::uuid, 'M-V2B', 'Terraza', 8::smallint, false)`, [inactiveTable.id]);
  });

  it('comanda sobre mesa inactiva rechazada; sobre mesa activa se acumula y la cuenta es visible para el mesero', async () => {
    const items = JSON.stringify([{ product_id: productId, quantity: 1, addon_ids: [] }]);
    await asUser(db, waiterId);
    expect(
      await expectSqlError(db.query(`SELECT * FROM public.create_table_order($1::uuid, $2::jsonb, NULL, 'cccccccc-1111-4111-8111-000000000001'::uuid, NULL)`, [inactiveTable.id, items])),
    ).toContain('TABLE_UNAVAILABLE');

    const o = (await db.query(`SELECT * FROM public.create_table_order($1::uuid, $2::jsonb, NULL, 'cccccccc-1111-4111-8111-000000000002'::uuid, NULL)`, [activeTable.id, items])).rows[0];
    const acc = (await db.query(`SELECT id, status, total_amount FROM public.table_accounts WHERE id = $1`, [o.table_account_id])).rows[0];
    expect(acc.status).toBe('open');
    expect(Number(acc.total_amount)).toBe(Number(o.total));

    const t = (await db.query(`SELECT status FROM public.restaurant_tables WHERE id = $1`, [activeTable.id])).rows[0];
    expect(t.status).toBe('ocupada');

    await db.query(`SELECT * FROM public.request_table_account_close($1::uuid)`, [o.table_account_id]);
    const closing = (await db.query(`SELECT status FROM public.table_accounts WHERE id = $1`, [o.table_account_id])).rows[0];
    expect(closing.status).toBe('closing_requested');
  });
});
