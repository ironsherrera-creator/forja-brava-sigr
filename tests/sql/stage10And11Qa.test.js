// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asSystem,
  asUser,
  createMigratedDb,
  createUser,
  expectSqlError,
} from './helpers/pgliteHarness';

describe('Etapa 11 — PostgreSQL real (PGlite): Flujos completos A–E, Caja y Matriz de Permisos', () => {
  let db;
  let adminId;
  let waiterId;
  let clientId;
  let productId;

  beforeAll(async () => {
    db = await createMigratedDb();
    adminId = await createUser(db, { role: 'administrador', name: 'Admin QA' });
    waiterId = await createUser(db, { role: 'mesero', name: 'Mesero QA' });
    clientId = await createUser(db, { role: 'cliente', name: 'Cliente QA' });

    await asSystem(db);
    productId = (await db.query(`SELECT id FROM public.products WHERE slug = 'forjada' LIMIT 1`)).rows[0].id;
    // Configurar tarifa de domicilio explícita en restaurant_settings (D-03)
    await db.query(`UPDATE public.restaurant_settings SET fixed_delivery_fee = 6000 WHERE id = 1`);
  }, 60000);

  afterAll(async () => {
    if (db) await db.close();
  });

  it('Flujo E (Seguridad y Permisos): cliente y mesero rechazados en operaciones de caja y pagos administrativos', async () => {
    await asUser(db, clientId);
    expect(await expectSqlError(db.query(`SELECT * FROM public.open_cash_session(100000, 'Intento cliente')`))).toContain('FORBIDDEN_ROLE');
    expect(await expectSqlError(db.query(`SELECT * FROM public.register_cash_movement('manual_income', 'Efectivo', 5000, 'Test')`))).toContain('FORBIDDEN_ROLE');

    await asUser(db, waiterId);
    expect(await expectSqlError(db.query(`SELECT * FROM public.open_cash_session(100000, 'Intento mesero')`))).toContain('FORBIDDEN_ROLE');
    expect(await expectSqlError(db.query(`SELECT * FROM public.register_cash_movement('manual_expense', 'Efectivo', 5000, 'Test')`))).toContain('FORBIDDEN_ROLE');

    // RLS: ni cliente ni mesero leen cash_sessions ni cash_movements
    const waiterSessions = await db.query(`SELECT * FROM public.cash_sessions`);
    expect(waiterSessions.rows).toHaveLength(0);
  });

  it('Flujos A, B, C y D completos: apertura caja, mesa (2 pedidos -> 1 cuenta -> cobro -> liberación), recoger, domicilio (D-03), movimientos, arqueo y cierre', async () => {
    // 1. Flujo D: Apertura de caja
    await asUser(db, adminId);
    const session = (await db.query(`SELECT * FROM public.open_cash_session(100000, 'Turno QA')`)).rows[0];
    expect(session.status).toBe('open');

    // No permite segunda apertura simultánea
    expect(await expectSqlError(db.query(`SELECT * FROM public.open_cash_session(50000, 'Duplicada')`))).toContain('CASH_ALREADY_OPEN');

    // Ingreso y egreso manuales en efectivo
    const inc = (await db.query(`SELECT * FROM public.register_cash_movement('manual_income', 'Efectivo', 20000, 'Cambio adicional')`)).rows[0];
    await db.query(`SELECT * FROM public.register_cash_movement('manual_expense', 'Efectivo', 10000, 'Compra de hielo')`);

    // Movimientos son inmutables (no pueden editarse ni eliminarse ni por sistema)
    await asSystem(db);
    expect(await expectSqlError(db.query(`UPDATE public.cash_movements SET amount = 1 WHERE id = $1`, [inc.id]))).toContain('IMMUTABLE_RECORD');

    // 2. Flujo A — Servicio en mesa (D-04)
    await asUser(db, adminId);
    const tbl = (await db.query(`SELECT * FROM public.admin_save_restaurant_table(NULL, 'M-QA1', 'Salón', 4::smallint, true)`)).rows[0];

    await asUser(db, waiterId);
    const items1 = JSON.stringify([{ product_id: productId, quantity: 1, addon_ids: [] }]);
    const o1 = (await db.query(`SELECT * FROM public.create_table_order($1::uuid, $2::jsonb, NULL, '11111111-1111-4111-8111-111111111901'::uuid, NULL)`, [tbl.id, items1])).rows[0];
    const o2 = (await db.query(`SELECT * FROM public.create_table_order($1::uuid, $2::jsonb, NULL, '11111111-1111-4111-8111-111111111902'::uuid, NULL)`, [tbl.id, items1])).rows[0];
    expect(o2.table_account_id).toBe(o1.table_account_id);

    // Entregar ambos pedidos (Admin -> Listo, Mesero -> Entregado)
    await asUser(db, adminId);
    await db.query(`SELECT * FROM public.update_order_status($1::uuid, 'Listo', NULL)`, [o1.id]);
    await db.query(`SELECT * FROM public.update_order_status($1::uuid, 'Listo', NULL)`, [o2.id]);
    await asUser(db, waiterId);
    await db.query(`SELECT * FROM public.update_order_status($1::uuid, 'Entregado', NULL)`, [o1.id]);
    await db.query(`SELECT * FROM public.update_order_status($1::uuid, 'Entregado', NULL)`, [o2.id]);

    // Solicitar cierre -> cobrar en Caja (Efectivo: 28900 * 2 = 57800) -> mesa liberada
    await db.query(`SELECT * FROM public.request_table_account_close($1::uuid)`, [o1.table_account_id]);
    await asUser(db, adminId);
    const settled = (await db.query(`SELECT * FROM public.settle_table_account($1::uuid, 'Efectivo')`, [o1.table_account_id])).rows[0];
    expect(settled.status).toBe('closed');
    const tblAfter = (await db.query(`SELECT status FROM public.restaurant_tables WHERE id = $1`, [tbl.id])).rows[0];
    expect(tblAfter.status).toBe('disponible');

    // 3. Flujo B — Pedido para recoger (Nequi digital -> NO suma efectivo físico)
    await asUser(db, clientId);
    const pickup = (
      await db.query(
        `SELECT * FROM public.create_order('recoger', $1::jsonb, 'Nequi', false, '11111111-1111-4111-8111-111111111903'::uuid, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
        [items1],
      )
    ).rows[0];
    expect(Number(pickup.delivery_fee)).toBe(0);
    expect(pickup.payment_status).toBe('Confirmación simulada');

    // 4. Flujo C — Pedido a domicilio (Efectivo -> tarifa D-03 = 6000 -> total 34900 -> confirmar pago en Caja)
    const delivery = (
      await db.query(
        `SELECT * FROM public.create_order('domicilio', $1::jsonb, 'Efectivo', false, '11111111-1111-4111-8111-111111111904'::uuid, 'Cra 11 # 93-20', 'Chicó', NULL, NULL, NULL, NULL, NULL, NULL)`,
        [items1],
      )
    ).rows[0];
    expect(Number(delivery.delivery_fee)).toBe(6000);
    expect(Number(delivery.total)).toBe(34900);

    await asUser(db, adminId);
    await db.query(`SELECT * FROM public.confirm_order_payment($1::uuid, 'Efectivo')`, [delivery.id]);

    // 5. Cierre de caja:
    // Efectivo esperado = 100000 (base) + 57800 (mesa) + 34900 (domicilio) + 20000 (ing) - 10000 (egr) = 202700
    // Ventas digitales netas = 28900 (Nequi)
    const closed = (await db.query(`SELECT * FROM public.close_cash_session($1::uuid, 200000, 'Faltante de prueba')`, [session.id])).rows[0];
    expect(closed.status).toBe('closed');
    expect(Number(closed.expected_cash)).toBe(202700);
    expect(Number(closed.net_digital_sales)).toBe(28900);
    expect(Number(closed.difference)).toBe(-2700);
  });
});
