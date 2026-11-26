// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asAnon,
  asSystem,
  asUser,
  createUser,
  expectSqlError,
  listMigrationFiles,
  MIGRATIONS_DIR,
  SUPABASE_BOOTSTRAP_SQL,
} from './helpers/pgliteHarness';

/**
 * Crea una base PGlite emulando fielmente Supabase remoto:
 * `pgcrypto` instalada EXCLUSIVAMENTE en el esquema `extensions` (NO en `public`).
 */
async function createSupabaseLikeDb() {
  const db = await PGlite.create({ extensions: { btree_gist, pgcrypto } });
  await db.exec(SUPABASE_BOOTSTRAP_SQL);
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
    GRANT USAGE ON SCHEMA extensions TO PUBLIC, anon, authenticated;
  `);

  for (const file of listMigrationFiles()) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await db.exec(sql);
  }
  return db;
}

describe('Correcciones Postauditoría Etapas 8–11 (AUD811-01 a AUD811-07) — PostgreSQL real', () => {
  let db;
  let adminId;
  let admin2Id;
  let waiterId;
  let waiter2Id;
  let clientId;
  let client2Id;
  let categoryId;
  let productId;
  let addonId;

  beforeAll(async () => {
    db = await createSupabaseLikeDb();
    adminId = await createUser(db, { role: 'administrador', name: 'Camila Admin' });
    admin2Id = await createUser(db, { role: 'administrador', name: 'Andrés Admin' });
    waiterId = await createUser(db, { role: 'mesero', name: 'Mateo Ríos' });
    waiter2Id = await createUser(db, { role: 'mesero', name: 'Sofía Duarte' });
    clientId = await createUser(db, { role: 'cliente', name: 'Valentina Gómez' });
    client2Id = await createUser(db, { role: 'cliente', name: 'Carlos Pérez' });

    await asSystem(db);
    categoryId = (await db.query(`SELECT id FROM public.categories ORDER BY display_order ASC LIMIT 1`)).rows[0].id;
    productId = (await db.query(`SELECT id FROM public.products WHERE is_addon = false LIMIT 1`)).rows[0].id;
    addonId = (await db.query(`SELECT id FROM public.products WHERE is_addon = true LIMIT 1`)).rows[0].id;
  }, 60000);

  afterAll(async () => {
    if (db) await db.close();
  });

  it('AUD811-01: create_order y create_table_order funcionan con pgcrypto en esquema extensions (sin depender de public)', async () => {
    await asSystem(db);
    const extRes = await db.query(
      `SELECT extnamespace::regnamespace::text AS schema_name FROM pg_extension WHERE extname = 'pgcrypto'`,
    );
    expect(extRes.rows[0].schema_name).toBe('extensions');

    // Abrir sesión de caja para que pagos digitales simulados ('Nequi') puedan asentarse en caja
    await asUser(db, adminId);
    const s01 = (
      await db.query(`SELECT * FROM public.open_cash_session(50000, 'Turno AUD811-01')`)
    ).rows[0];

    await asUser(db, clientId);
    const reqId = 'aaaaaaaa-1111-4111-8111-000000000001';
    const itemsA = JSON.stringify([{ product_id: productId, quantity: 1, addon_ids: [] }]);
    const itemsB = JSON.stringify([{ product_id: productId, quantity: 2, addon_ids: [] }]);

    // 1. Creación inicial exitosa usando pg_catalog.sha256 nativo
    const first = (
      await db.query(
        `SELECT * FROM public.create_order('recoger', $1::jsonb, 'Nequi', false, $2::uuid, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
        [itemsA, reqId],
      )
    ).rows[0];
    expect(first.id).toBeTruthy();

    // 2. Reintento idempotente con el mismo payload devuelve exactamente el mismo pedido
    const replay = (
      await db.query(
        `SELECT * FROM public.create_order('recoger', $1::jsonb, 'Nequi', false, $2::uuid, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
        [itemsA, reqId],
      )
    ).rows[0];
    expect(replay.id).toBe(first.id);

    // 3. Mismo request_id con payload distinto lanza IDEMPOTENCY_CONFLICT
    expect(
      await expectSqlError(
        db.query(
          `SELECT * FROM public.create_order('recoger', $1::jsonb, 'Nequi', false, $2::uuid, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
          [itemsB, reqId],
        ),
      ),
    ).toContain('IDEMPOTENCY_CONFLICT');

    // 4. Otro usuario reutilizando el mismo request_id lanza DUPLICATE_REQUEST_ID
    await asUser(db, client2Id);
    expect(
      await expectSqlError(
        db.query(
          `SELECT * FROM public.create_order('recoger', $1::jsonb, 'Nequi', false, $2::uuid, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
          [itemsA, reqId],
        ),
      ),
    ).toContain('DUPLICATE_REQUEST_ID');

    // 5. create_table_order (que delega en create_order) también opera sin depender de pgcrypto en public
    await asUser(db, adminId);
    const tbl = (
      await db.query(`SELECT * FROM public.admin_save_restaurant_table(NULL, 'M-SHA1', 'Salón', 4::smallint, true)`)
    ).rows[0];

    await asUser(db, waiterId);
    const tblOrder = (
      await db.query(
        `SELECT * FROM public.create_table_order($1::uuid, $2::jsonb, 'Sin cebolla', 'aaaaaaaa-1111-4111-8111-000000000002'::uuid, NULL)`,
        [tbl.id, itemsA],
      )
    ).rows[0];
    expect(tblOrder.modality).toBe('mesa');

    // Cerrar sesión de caja temporal de AUD811-01 (las cuentas de mesa abiertas se preservan)
    await asUser(db, adminId);
    await db.query(`SELECT * FROM public.close_cash_session($1::uuid, 50000, 'Fin AUD811-01')`, [
      s01.id,
    ]);
  });

  it('AUD811-02: admin_save_product guarda producto + complementos atómicamente y hace rollback total si un complemento falla', async () => {
    // Mesero rechazado
    await asUser(db, waiterId);
    expect(
      await expectSqlError(
        db.query(
          `SELECT * FROM public.admin_save_product(NULL, $1::uuid, 'Intento Mesero', 'intento-mesero', '', NULL, 25000, NULL, NULL, false, true, ARRAY[]::uuid[], true)`,
          [categoryId],
        ),
      ),
    ).toContain('FORBIDDEN_ROLE');

    // Creación atómica con complemento válido y deduplicación de array
    await asUser(db, adminId);
    const created = (
      await db.query(
        `SELECT * FROM public.admin_save_product(NULL, $1::uuid, 'Hamburguesa Atómica', 'hamburguesa-atomica', 'Doble carne', 'Carne, queso', 32000, NULL, 'NUEVA', false, true, ARRAY[$2::uuid, $2::uuid], true)`,
        [categoryId, addonId],
      )
    ).rows[0];
    expect(Number(created.price)).toBe(32000);

    const compsBefore = await db.query(
      `SELECT complement_id FROM public.product_complements WHERE product_id = $1`,
      [created.id],
    );
    expect(compsBefore.rows).toHaveLength(1);
    expect(compsBefore.rows[0].complement_id).toBe(addonId);

    // Intento de actualización pasando un producto NO-addon como complemento -> ROLLBACK TOTAL
    // (ni el precio cambia a 99000 ni se pierden los complementos previos)
    expect(
      await expectSqlError(
        db.query(
          `SELECT * FROM public.admin_save_product($1::uuid, $2::uuid, 'Nombre Fallido', 'hamburguesa-atomica', 'Desc', NULL, 99000, NULL, NULL, false, true, ARRAY[$3::uuid], true)`,
          [created.id, categoryId, productId],
        ),
      ),
    ).toContain('INVALID_COMPLEMENT');

    const prodAfterRollback = (
      await db.query(`SELECT name, price FROM public.products WHERE id = $1`, [created.id])
    ).rows[0];
    expect(prodAfterRollback.name).toBe('Hamburguesa Atómica');
    expect(Number(prodAfterRollback.price)).toBe(32000);

    const compsAfterRollback = await db.query(
      `SELECT complement_id FROM public.product_complements WHERE product_id = $1`,
      [created.id],
    );
    expect(compsAfterRollback.rows).toHaveLength(1);

    // Cambio rápido de disponibilidad con p_sync_complements = false conserva complementos intactos
    const toggled = (
      await db.query(
        `SELECT * FROM public.admin_save_product($1::uuid, $2::uuid, 'Hamburguesa Atómica', 'hamburguesa-atomica', 'Doble carne', 'Carne, queso', 32000, NULL, 'NUEVA', false, false, ARRAY[]::uuid[], false)`,
        [created.id, categoryId],
      )
    ).rows[0];
    expect(toggled.is_available).toBe(false);

    const compsAfterToggle = await db.query(
      `SELECT complement_id FROM public.product_complements WHERE product_id = $1`,
      [created.id],
    );
    expect(compsAfterToggle.rows).toHaveLength(1);

    // Auditoría registrada
    await asSystem(db);
    const logs = await db.query(
      `SELECT action FROM public.audit_logs WHERE entity_id = $1 AND action = 'ADMIN_SYNC_PRODUCT_COMPLEMENTS'`,
      [created.id],
    );
    expect(logs.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('AUD811-03 y AUD811-07: reembolsos controlados y validación de efectivo recibido en cobros de caja', async () => {
    await asUser(db, adminId);
    // Abrir sesión de caja con base pequeña ($10.000) para probar control de liquidez en reembolso efectivo
    const session = (
      await db.query(`SELECT * FROM public.open_cash_session(10000, 'Turno AUD811')`)
    ).rows[0];

    const items = JSON.stringify([{ product_id: productId, quantity: 1, addon_ids: [] }]);

    // Pedido recoger en Efectivo ($28.900 aprox)
    await asUser(db, clientId);
    const cashOrd = (
      await db.query(
        `SELECT * FROM public.create_order('recoger', $1::jsonb, 'Efectivo', false, 'aaaaaaaa-1111-4111-8111-000000000010'::uuid, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
        [items],
      )
    ).rows[0];
    const ordTotal = Number(cashOrd.total);

    await asUser(db, adminId);
    // AUD811-07: rechaza efectivo recibido menor al saldo pendiente
    expect(
      await expectSqlError(
        db.query(`SELECT * FROM public.confirm_order_payment($1::uuid, 'Efectivo', $2::numeric)`, [
          cashOrd.id,
          ordTotal - 1000,
        ]),
      ),
    ).toContain('INSUFFICIENT_CASH_RECEIVED');

    // AUD811-07: rechaza efectivo recibido cuando el método es digital
    expect(
      await expectSqlError(
        db.query(`SELECT * FROM public.confirm_order_payment($1::uuid, 'Nequi', $2::numeric)`, [
          cashOrd.id,
          ordTotal + 5000,
        ]),
      ),
    ).toContain('RECEIVED_AMOUNT_ONLY_FOR_CASH');

    // AUD811-07: acepta efectivo recibido suficiente y audita el cambio
    const paidCash = (
      await db.query(`SELECT * FROM public.confirm_order_payment($1::uuid, 'Efectivo', 50000)`, [
        cashOrd.id,
      ])
    ).rows[0];
    expect(paidCash.status).toBe('Confirmación simulada');

    // AUD811-03: no permite reembolsar pedido no cancelado
    expect(
      await expectSqlError(
        db.query(`SELECT * FROM public.refund_order_payment($1::uuid, 'Intento prematuro')`, [
          cashOrd.id,
        ]),
      ),
    ).toContain('ORDER_NOT_CANCELLED');

    // Cancelar pedido y drenar efectivo físico con egreso manual para probar INSUFFICIENT_CASH_FOR_REFUND
    await db.query(`SELECT * FROM public.update_order_status($1::uuid, 'Cancelado', 'Agotado')`, [
      cashOrd.id,
    ]);
    await db.query(
      `SELECT * FROM public.register_cash_movement('manual_expense', 'Efectivo', 35000, 'Pago proveedor urgente')`,
    );

    expect(
      await expectSqlError(
        db.query(`SELECT * FROM public.refund_order_payment($1::uuid, 'Reembolso sin liquidez')`, [
          cashOrd.id,
        ]),
      ),
    ).toContain('INSUFFICIENT_CASH_FOR_REFUND');

    // Reponer liquidez y ejecutar reembolso exitoso; segundo intento falla (sin duplicados)
    await db.query(
      `SELECT * FROM public.register_cash_movement('manual_income', 'Efectivo', 40000, 'Reposición base')`,
    );
    const refPayment = (
      await db.query(
        `SELECT * FROM public.refund_order_payment($1::uuid, 'Cliente solicitó devolución tras cancelación')`,
        [cashOrd.id],
      )
    ).rows[0];
    expect(refPayment.status).toBe('Reembolsado');

    expect(
      await expectSqlError(
        db.query(`SELECT * FROM public.refund_order_payment($1::uuid, 'Intento duplicado')`, [
          cashOrd.id,
        ]),
      ),
    ).toMatch(/ALREADY_REFUNDED|NO_CONFIRMED_PAYMENT/);

    // Cerrar sesión de caja limpia para las siguientes pruebas
    await db.query(`SELECT * FROM public.close_cash_session($1::uuid, 15000, 'Cierre AUD811-03')`, [
      session.id,
    ]);
  });

  it('AUD811-06: get_salon_staff_directory expone solo id, nombre visible y mesas activas a mesero/admin (sin email ni teléfono)', async () => {
    await asAnon(db);
    expect(
      await expectSqlError(db.query(`SELECT * FROM public.get_salon_staff_directory()`)),
    ).toMatch(/permission denied|FORBIDDEN_ROLE/i);

    await asUser(db, clientId);
    expect(
      await expectSqlError(db.query(`SELECT * FROM public.get_salon_staff_directory()`)),
    ).toContain('FORBIDDEN_ROLE');

    // El segundo mesero consulta el directorio y ve a Mateo Ríos con su mesa activa M-SHA1, sin PII
    await asUser(db, waiter2Id);
    const dir = await db.query(`SELECT * FROM public.get_salon_staff_directory()`);
    expect(dir.rows.length).toBeGreaterThanOrEqual(2);

    const mateo = dir.rows.find((r) => r.staff_id === waiterId);
    expect(mateo).toBeTruthy();
    expect(mateo.visible_name).toBe('Mateo Ríos');
    expect(mateo.active_table_codes).toContain('M-SHA1');
    expect(Object.keys(mateo).sort()).toEqual([
      'active_table_codes',
      'role_code',
      'staff_id',
      'visible_name',
    ]);
    expect(mateo.email).toBeUndefined();
    expect(mateo.phone).toBeUndefined();
  });

  it('AUD811-05: admin_update_user_account protege al último administrador activo y bloquea automodificación', async () => {
    await asSystem(db);
    const waiterRoleId = (await db.query(`SELECT id FROM public.roles WHERE code = 'mesero'`)).rows[0].id;

    // Automodificación bloqueada
    await asUser(db, adminId);
    expect(
      await expectSqlError(
        db.query(`SELECT * FROM public.admin_update_user_account($1::uuid, 'administrador', false)`, [
          adminId,
        ]),
      ),
    ).toContain('CANNOT_MODIFY_OWN_PRIVILEGES');

    // Admin 1 degrada a Admin 2 a mesero (válido porque Admin 1 sigue activo)
    const downgraded = (
      await db.query(`SELECT * FROM public.admin_update_user_account($1::uuid, 'mesero', true)`, [
        admin2Id,
      ])
    ).rows[0];
    expect(downgraded.role_id).toBe(waiterRoleId);

    // Admin 2 (ya degradado) intenta desactivar a Admin 1 -> FORBIDDEN_ROLE
    await asUser(db, admin2Id);
    expect(
      await expectSqlError(
        db.query(`SELECT * FROM public.admin_update_user_account($1::uuid, 'administrador', false)`, [
          adminId,
        ]),
      ),
    ).toContain('FORBIDDEN_ROLE');

    // Restaurar Admin 2 para mantener estado limpio
    await asUser(db, adminId);
    await db.query(`SELECT * FROM public.admin_update_user_account($1::uuid, 'administrador', true)`, [
      admin2Id,
    ]);
  });

  it('AUD811-04: get_admin_reports_summary agrega > 3.500 registros reales en PostgreSQL sin truncamiento ni duplicación por joins', async () => {
    await asSystem(db);
    // Insertar masivamente 3.500 pedidos históricos + 7.000 order_items (2 líneas por pedido) + 3.500 pagos
    // en fecha controlada 2026-10-15 (America/Bogota) para verificar cero truncamiento y cero multiplicación por joins
    await db.exec(`
      WITH gen AS (
        SELECT
          g AS seq,
          gen_random_uuid() AS oid
        FROM generate_series(1, 3500) AS g
      ),
      ins_orders AS (
        INSERT INTO public.orders (
          id,
          order_number,
          customer_id,
          modality,
          customer_name,
          customer_phone,
          delivery_address,
          delivery_neighborhood,
          subtotal,
          delivery_fee,
          total,
          status,
          payment_status,
          created_at,
          updated_at
        )
        SELECT
          oid,
          'FB-BULK-' || lpad(seq::text, 5, '0'),
          '${clientId}'::uuid,
          CASE WHEN seq % 2 = 0 THEN 'domicilio' ELSE 'recoger' END,
          'Cliente Volumen',
          '3001234567',
          CASE WHEN seq % 2 = 0 THEN 'Cra 15 # 85-10' ELSE NULL END,
          CASE WHEN seq % 2 = 0 THEN 'Chapinero' ELSE NULL END,
          20000,
          0,
          20000,
          CASE WHEN seq <= 100 THEN 'Cancelado' ELSE 'Entregado' END,
          CASE WHEN seq <= 100 THEN 'Pendiente' ELSE 'Confirmación simulada' END,
          TIMESTAMPTZ '2026-10-15 14:00:00-05',
          TIMESTAMPTZ '2026-10-15 14:30:00-05'
        FROM gen
        RETURNING id, status
      ),
      ins_items AS (
        INSERT INTO public.order_items (
          order_id,
          product_id,
          product_name_snapshot,
          unit_price_snapshot,
          quantity,
          addons_snapshot,
          addons_total,
          line_total
        )
        SELECT
          io.id,
          '${productId}'::uuid,
          'Producto Bulk',
          10000,
          1,
          '[]'::jsonb,
          0,
          10000
        FROM ins_orders io
        UNION ALL
        SELECT
          io.id,
          '${addonId}'::uuid,
          'Complemento Bulk',
          10000,
          1,
          '[]'::jsonb,
          0,
          10000
        FROM ins_orders io
      )
      INSERT INTO public.payments (
        order_id,
        method,
        status,
        amount,
        transaction_ref,
        is_simulated,
        paid_at,
        created_at
      )
      SELECT
        io.id,
        'Nequi',
        'Confirmación simulada',
        20000,
        'BULK-PAY-' || io.id::text,
        true,
        TIMESTAMPTZ '2026-10-15 14:05:00-05',
        TIMESTAMPTZ '2026-10-15 14:05:00-05'
      FROM ins_orders io
      WHERE io.status <> 'Cancelado';
    `);

    // Mesero bloqueado en reportes
    await asUser(db, waiterId);
    expect(
      await expectSqlError(
        db.query(`SELECT public.get_admin_reports_summary('2026-10-15', '2026-10-15', NULL, NULL, NULL, NULL, NULL)`),
      ),
    ).toContain('FORBIDDEN_ROLE');

    // Administrador consulta el día 2026-10-15 con 3.500 pedidos y 7.000 order_items
    await asUser(db, adminId);
    const res = await db.query(
      `SELECT public.get_admin_reports_summary('2026-10-15'::date, '2026-10-15'::date, NULL, NULL, NULL, NULL, NULL) AS summary`,
    );
    const summary = res.rows[0].summary;

    // Sin truncamiento (supera ampliamente los antiguos límites de 1.000 y 3.000)
    expect(summary.sales.totalOrders).toBe(3500);
    expect(summary.sales.validOrdersCount).toBe(3400);
    expect(summary.sales.cancelledOrdersCount).toBe(100);

    // Sin multiplicación por joins (3.400 pedidos válidos * $20.000 = $68.000.000 exactos, NO duplicado por las 2 líneas de order_items)
    expect(Number(summary.sales.totalSales)).toBe(68000000);
    expect(Number(summary.payments.totalPaid)).toBe(68000000);
    expect(Number(summary.payments.count)).toBe(3400);

    // Las 7.000 líneas de order_items (6.800 válidas) también se agregan completas sin el antiguo .limit(3000)
    const totalUnitsSold = summary.products.topProducts.reduce(
      (acc, p) => acc + Number(p.quantity),
      0,
    );
    expect(totalUnitsSold).toBe(6800);

    // Verificación de filtros combinados (estado, modalidad, método, categoría y producto)
    const filteredDomicilio = (
      await db.query(
        `SELECT public.get_admin_reports_summary('2026-10-15'::date, '2026-10-15'::date, 'Entregado', 'domicilio', 'Nequi', $1::uuid, $2::uuid) AS summary`,
        [categoryId, productId],
      )
    ).rows[0].summary;
    // De 3.500, pares son domicilio (1.750); entre 1..100 hay 50 pares cancelados -> 1.700 entregados domicilio
    expect(filteredDomicilio.sales.totalOrders).toBe(1700);
    expect(Number(filteredDomicilio.sales.totalSales)).toBe(34000000);
  }, 60000);
});
