// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asSystem,
  asUser,
  createMigratedDb,
  createUser,
  expectSqlError,
} from './helpers/pgliteHarness';

describe('PostgreSQL real (PGlite) — Etapas 8 y 9 (Migración 10, D-04, D-05, Usuarios y Auditoría)', () => {
  let db;
  let adminId;
  let waiterId;
  let clientId;
  let productId;
  let addonId;

  beforeAll(async () => {
    db = await createMigratedDb();
    adminId = await createUser(db, { role: 'administrador', name: 'Admin Principal' });
    waiterId = await createUser(db, { role: 'mesero', name: 'Mesero Salón' });
    clientId = await createUser(db, { role: 'cliente', name: 'Cliente Prueba' });

    await asSystem(db);
    productId = (await db.query(`SELECT id FROM public.products WHERE slug = 'forjada' LIMIT 1`)).rows[0].id;
    addonId = (await db.query(`SELECT id FROM public.products WHERE slug = 'adiciones' LIMIT 1`)).rows[0].id;
  }, 60000);

  afterAll(async () => {
    if (db) await db.close();
  });

  it('Etapa 8 (D-04 + D-05 + Migración 10): acumula comandas en única cuenta, bloquea tras cierre solicitado y aplica D-05', async () => {
    await asUser(db, adminId);
    const tbl = (
      await db.query(`SELECT * FROM public.admin_save_restaurant_table(NULL, 'M-E8', 'Salón', 4::smallint, true)`)
    ).rows[0];

    await asUser(db, waiterId);
    const items1 = JSON.stringify([{ product_id: productId, quantity: 1, addon_ids: [addonId], notes: 'Sin cebolla' }]);
    const items2 = JSON.stringify([{ product_id: productId, quantity: 2, addon_ids: [] }]);

    // 1. Primera comanda abre cuenta acumulada única y marca mesa ocupada
    const ord1 = (
      await db.query(
        `SELECT * FROM public.create_table_order($1::uuid, $2::jsonb, 'Mesa 1', '11111111-1111-4111-8111-111111111801'::uuid, NULL)`,
        [tbl.id, items1],
      )
    ).rows[0];
    expect(ord1.table_account_id).toBeTruthy();

    // 2. Segunda comanda se acumula en la MISMA cuenta (no crea otra)
    const ord2 = (
      await db.query(
        `SELECT * FROM public.create_table_order($1::uuid, $2::jsonb, NULL, '11111111-1111-4111-8111-111111111802'::uuid, NULL)`,
        [tbl.id, items2],
      )
    ).rows[0];
    expect(ord2.table_account_id).toBe(ord1.table_account_id);

    const acc = (
      await db.query(`SELECT * FROM public.table_accounts WHERE id = $1`, [ord1.table_account_id])
    ).rows[0];
    expect(Number(acc.total_amount)).toBe(Number(ord1.total) + Number(ord2.total));

    // 3. D-05: Mesero NO puede pasar a 'En preparación' ni 'Listo'
    const kitchenErr = await expectSqlError(
      db.query(`SELECT * FROM public.update_order_status($1::uuid, 'En preparación', NULL)`, [ord1.id]),
    );
    expect(kitchenErr).toContain('FORBIDDEN_ROLE');

    // 4. D-05: Mesero SÍ puede cancelar pedido recién registrado en estado Pendiente
    const cancelled = (
      await db.query(`SELECT * FROM public.update_order_status($1::uuid, 'Cancelado', 'Error de toma')`, [ord2.id])
    ).rows[0];
    expect(cancelled.status).toBe('Cancelado');

    // 5. Admin avanza ord1 a Listo -> Mesero SÍ puede entregarlo
    await asUser(db, adminId);
    await db.query(`SELECT * FROM public.update_order_status($1::uuid, 'Listo', 'Cocina terminó')`, [ord1.id]);

    await asUser(db, waiterId);
    const delivered = (
      await db.query(`SELECT * FROM public.update_order_status($1::uuid, 'Entregado', 'Servido')`, [ord1.id])
    ).rows[0];
    expect(delivered.status).toBe('Entregado');

    // 6. Solicitar cierre de cuenta (NO cobra ni cierra) -> bloquea nuevos pedidos (Migración 10)
    const closingAcc = (
      await db.query(`SELECT * FROM public.request_table_account_close($1::uuid)`, [ord1.table_account_id])
    ).rows[0];
    expect(closingAcc.status).toBe('closing_requested');

    const blockedOrderErr = await expectSqlError(
      db.query(
        `SELECT * FROM public.create_table_order($1::uuid, $2::jsonb, NULL, '11111111-1111-4111-8111-111111111803'::uuid, NULL)`,
        [tbl.id, items1],
      ),
    );
    expect(blockedOrderErr).toContain('ACCOUNT_CLOSING_REQUESTED');
  });

  it('Etapa 9 (Migración 10): admin_update_user_account controla roles, protege último admin/propia cuenta y audita catálogo', async () => {
    // Mesero no puede gestionar usuarios
    await asUser(db, waiterId);
    const waiterErr = await expectSqlError(
      db.query(`SELECT * FROM public.admin_update_user_account($1::uuid, 'mesero', NULL)`, [clientId]),
    );
    expect(waiterErr).toContain('FORBIDDEN_ROLE');

    // Admin no puede cambiar su propio rol ni desactivarse
    await asUser(db, adminId);
    const selfErr = await expectSqlError(
      db.query(`SELECT * FROM public.admin_update_user_account($1::uuid, 'cliente', NULL)`, [adminId]),
    );
    expect(selfErr).toContain('CANNOT_MODIFY_OWN_PRIVILEGES');

    // Admin promueve cliente a mesero y desactiva -> registra auditoría
    const updatedUser = (
      await db.query(`SELECT * FROM public.admin_update_user_account($1::uuid, 'mesero', false)`, [clientId])
    ).rows[0];
    expect(updatedUser.is_active).toBe(false);

    // Auditoría automática al editar producto y configuración
    await db.query(`UPDATE public.products SET tag = 'AUD-E9' WHERE id = $1`, [productId]);
    const logs = await db.query(
      `SELECT action, entity_name FROM public.audit_logs WHERE entity_name IN ('profiles', 'products')`,
    );
    expect(logs.rows.some((r) => r.action === 'ADMIN_UPDATE_USER_ACCOUNT')).toBe(true);
    expect(logs.rows.some((r) => r.action === 'ADMIN_UPDATE_PRODUCTS')).toBe(true);
  });
});
