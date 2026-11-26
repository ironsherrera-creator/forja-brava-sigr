// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asSystem,
  asUser,
  createMigratedDb,
  createUser,
  expectSqlError,
  futureDate,
  setUniformHours,
} from './helpers/pgliteHarness';

describe('PostgreSQL real (PGlite) — Correcciones postauditoría AUD-01..AUD-09 y AUD-13', () => {
  let db;
  let adminId;
  let clientA;
  let clientB;
  let waiterId;
  let productId;
  let addonId;

  beforeAll(async () => {
    db = await createMigratedDb();
    adminId = await createUser(db, { role: 'administrador', name: 'Admin Auditoría' });
    clientA = await createUser(db, { role: 'cliente', name: 'Cliente A' });
    clientB = await createUser(db, { role: 'cliente', name: 'Cliente B' });
    waiterId = await createUser(db, { role: 'mesero', name: 'Mesero Salón' });

    await asSystem(db);
    const prodRes = await db.query(`SELECT id FROM public.products WHERE slug = 'forjada' LIMIT 1`);
    productId = prodRes.rows[0].id;
    const addonRes = await db.query(`SELECT id FROM public.products WHERE slug = 'adiciones' LIMIT 1`);
    addonId = addonRes.rows[0].id;
  }, 60000);

  afterAll(async () => {
    if (db) await db.close();
  });

  it('AUD-01: valida horarios completos en America/Bogota, elimina wrap de medianoche y soporta cruce de medianoche', async () => {
    await asUser(db, adminId);
    await db.query(`SELECT public.admin_save_restaurant_table(NULL, 'M-AUD1', 'Salón', 6::smallint, true)`);

    // 1. Horario estándar 12:00 - 22:00, duración 90 min
    await setUniformHours(db, { open: '12:00', close: '22:00', duration: 90 });
    const d1 = await futureDate(db, 15);
    const d2 = await futureDate(db, 16);

    await asUser(db, clientA);
    // Reserva dentro del horario
    const okRes = await db.query(
      `SELECT * FROM public.create_reservation($1::date, '19:00'::time, 4::smallint, NULL, NULL, NULL)`,
      [d1],
    );
    expect(okRes.rows[0].status).toBe('Confirmada');

    // Reserva que termina exactamente al cierre (20:30 + 90m = 22:00)
    const exactClose = await db.query(
      `SELECT * FROM public.create_reservation($1::date, '20:30'::time, 2::smallint, NULL, NULL, NULL)`,
      [d2],
    );
    expect(exactClose.rows[0].status).toBe('Confirmada');

    // Reserva que excede el cierre (21:00 + 90m = 22:30 > 22:00)
    const errExceed = await expectSqlError(
      db.query(`SELECT * FROM public.create_reservation($1::date, '21:00'::time, 2::smallint, NULL, NULL, NULL)`, [d2]),
    );
    expect(errExceed).toContain('OUT_OF_HOURS');

    // Intento de bypass por wrap de medianoche (23:30 + 90m = 01:00 < 22:00 en ::time antiguo)
    const errWrap = await expectSqlError(
      db.query(`SELECT * FROM public.create_reservation($1::date, '23:30'::time, 2::smallint, NULL, NULL, NULL)`, [d2]),
    );
    expect(errWrap).toContain('OUT_OF_HOURS');

    // Reserva antes de la apertura
    const errBefore = await expectSqlError(
      db.query(`SELECT * FROM public.create_reservation($1::date, '11:00'::time, 2::smallint, NULL, NULL, NULL)`, [d2]),
    );
    expect(errBefore).toContain('OUT_OF_HOURS');

    // 2. Horario que cruza medianoche (18:00 -> 02:00, duración 90 min)
    await setUniformHours(db, { open: '18:00', close: '02:00', duration: 90 });
    const d3 = await futureDate(db, 17);
    await asUser(db, clientA);
    const crossOk = await db.query(
      `SELECT * FROM public.create_reservation($1::date, '23:30'::time, 2::smallint, NULL, NULL, NULL)`,
      [d3],
    );
    expect(crossOk.rows[0].status).toBe('Confirmada');

    const crossExceed = await expectSqlError(
      db.query(`SELECT * FROM public.create_reservation($1::date, '01:00'::time, 2::smallint, NULL, NULL, NULL)`, [d3]),
    );
    expect(crossExceed).toContain('OUT_OF_HOURS');

    // 3. Duración superior al periodo disponible (18:00 -> 19:00 con 90 min)
    await setUniformHours(db, { open: '18:00', close: '19:00', duration: 90 });
    const d4 = await futureDate(db, 18);
    await asUser(db, clientA);
    const slots = await db.query(`SELECT * FROM public.get_available_reservation_slots($1::date, 2, NULL)`, [d4]);
    expect(slots.rows).toHaveLength(0);
    const errShort = await expectSqlError(
      db.query(`SELECT * FROM public.create_reservation($1::date, '18:00'::time, 2::smallint, NULL, NULL, NULL)`, [d4]),
    );
    expect(errShort).toContain('OUT_OF_HOURS');

    // Restaurar horario estándar
    await setUniformHours(db, { open: '12:00', close: '22:00', duration: 90 });
  });

  it('AUD-02, AUD-03 y AUD-04: idempotencia por huella SHA-256, rechazo de conflicto y consistencia de precios', async () => {
    const reqKey1 = '11111111-1111-4111-8111-111111111111';
    const reqKey2 = '22222222-2222-4222-8222-222222222222';
    const itemsA = JSON.stringify([{ product_id: productId, quantity: 2, addon_ids: [addonId] }]);
    const itemsDifferent = JSON.stringify([{ product_id: productId, quantity: 3, addon_ids: [addonId] }]);

    await asUser(db, clientA);
    // 1. Primera creación
    const first = await db.query(
      `SELECT * FROM public.create_order('domicilio', $1::jsonb, 'Efectivo', false, $2::uuid, 'Calle 85 # 15-40', 'Chapinero', 'Apto 302', NULL, NULL, NULL, 'Sin cebolla', NULL)`,
      [itemsA, reqKey1],
    );
    expect(first.rows[0].request_payload_hash).toHaveLength(64);

    // 2. Reintento legítimo (misma clave y mismo contenido -> devuelve mismo pedido)
    const retry = await db.query(
      `SELECT * FROM public.create_order('domicilio', $1::jsonb, 'Efectivo', false, $2::uuid, 'Calle 85 # 15-40', 'Chapinero', 'Apto 302', NULL, NULL, NULL, 'Sin cebolla', NULL)`,
      [itemsA, reqKey1],
    );
    expect(retry.rows[0].id).toBe(first.rows[0].id);

    // 3. Misma clave con contenido diferente -> IDEMPOTENCY_CONFLICT
    const conflictErr = await expectSqlError(
      db.query(
        `SELECT * FROM public.create_order('domicilio', $1::jsonb, 'Efectivo', false, $2::uuid, 'Calle 85 # 15-40', 'Chapinero', 'Apto 302', NULL, NULL, NULL, 'Sin cebolla', NULL)`,
        [itemsDifferent, reqKey1],
      ),
    );
    expect(conflictErr).toContain('IDEMPOTENCY_CONFLICT');

    // 4. Otro usuario intenta reutilizar la misma clave -> DUPLICATE_REQUEST_ID
    await asUser(db, clientB);
    const otherUserErr = await expectSqlError(
      db.query(
        `SELECT * FROM public.create_order('domicilio', $1::jsonb, 'Efectivo', false, $2::uuid, 'Calle 85 # 15-40', 'Chapinero', 'Apto 302', NULL, NULL, NULL, 'Sin cebolla', NULL)`,
        [itemsA, reqKey1],
      ),
    );
    expect(otherUserErr).toContain('DUPLICATE_REQUEST_ID');

    // 5. Clave distinta -> nuevo pedido independiente
    await asUser(db, clientA);
    const second = await db.query(
      `SELECT * FROM public.create_order('recoger', $1::jsonb, 'Efectivo', false, $2::uuid, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`,
      [itemsA, reqKey2],
    );
    expect(second.rows[0].id).not.toBe(first.rows[0].id);

    // 6. AUD-04: Suma de order_items coincide con orders.subtotal y snapshots son inmutables tras cambio de precio
    await asSystem(db);
    const sumRes = await db.query(
      `SELECT o.subtotal, SUM(oi.line_total) AS items_sum
         FROM public.orders o
         JOIN public.order_items oi ON oi.order_id = o.id
        WHERE o.id = $1
        GROUP BY o.subtotal`,
      [first.rows[0].id],
    );
    expect(Number(sumRes.rows[0].subtotal)).toBe(Number(sumRes.rows[0].items_sum));
    const originalUnit = Number(first.rows[0].subtotal);

    await db.query(`UPDATE public.products SET price = price + 5000 WHERE id = $1`, [productId]);
    const afterPriceChange = await db.query(`SELECT subtotal FROM public.orders WHERE id = $1`, [first.rows[0].id]);
    expect(Number(afterPriceChange.rows[0].subtotal)).toBe(originalUnit);
  });

  it('AUD-05 y AUD-08: transiciones estrictas en admin_manage_reservation, limpieza de cancelled_at y revocación de UPDATE directo', async () => {
    await asUser(db, adminId);
    const tblSmall = (
      await db.query(`SELECT * FROM public.admin_save_restaurant_table(NULL, 'M-AUD5-S', 'Salón', 2::smallint, true)`)
    ).rows[0];
    const tblBig = (
      await db.query(`SELECT * FROM public.admin_save_restaurant_table(NULL, 'M-AUD5-B', 'Salón', 6::smallint, true)`)
    ).rows[0];

    const d = await futureDate(db, 20);
    await asUser(db, clientA);
    const resRow = (
      await db.query(
        `SELECT * FROM public.create_reservation($1::date, '15:00'::time, 4::smallint, 'Salón', NULL, NULL)`,
        [d],
      )
    ).rows[0];

    // Cliente y mesero NO pueden invocar admin_manage_reservation
    const clientErr = await expectSqlError(
      db.query(`SELECT * FROM public.admin_manage_reservation($1::uuid, 'Cancelada', NULL, NULL)`, [resRow.id]),
    );
    expect(clientErr).toContain('FORBIDDEN_ROLE');

    await asUser(db, waiterId);
    const waiterErr = await expectSqlError(
      db.query(`SELECT * FROM public.admin_manage_reservation($1::uuid, 'Cancelada', NULL, NULL)`, [resRow.id]),
    );
    expect(waiterErr).toContain('FORBIDDEN_ROLE');

    // AUD-08: UPDATE directo sobre reservations rechazado incluso para admin
    await asUser(db, adminId);
    const directUpdateErr = await expectSqlError(
      db.query(`UPDATE public.reservations SET status = 'Cancelada' WHERE id = $1`, [resRow.id]),
    );
    expect(directUpdateErr).toMatch(/permission denied/i);

    // Reasignar a mesa pequeña (cap 2 < 4) -> INSUFFICIENT_CAPACITY
    const capErr = await expectSqlError(
      db.query(`SELECT * FROM public.admin_manage_reservation($1::uuid, NULL, $2::uuid, NULL)`, [resRow.id, tblSmall.id]),
    );
    expect(capErr).toContain('INSUFFICIENT_CAPACITY');

    // Cancelar -> fija cancelled_at
    const cancelled = (
      await db.query(`SELECT * FROM public.admin_manage_reservation($1::uuid, 'Cancelada', NULL, 'Cliente avisó')`, [
        resRow.id,
      ])
    ).rows[0];
    expect(cancelled.status).toBe('Cancelada');
    expect(cancelled.cancelled_at).not.toBeNull();

    // Cancelada -> Atendida directamente PROHIBIDO
    const badTrans = await expectSqlError(
      db.query(`SELECT * FROM public.admin_manage_reservation($1::uuid, 'Atendida', NULL, NULL)`, [resRow.id]),
    );
    expect(badTrans).toContain('INVALID_TRANSITION');

    // Cancelada -> Confirmada (reactivación) limpia cancelled_at
    const reactivated = (
      await db.query(`SELECT * FROM public.admin_manage_reservation($1::uuid, 'Confirmada', $2::uuid, '')`, [
        resRow.id,
        tblBig.id,
      ])
    ).rows[0];
    expect(reactivated.status).toBe('Confirmada');
    expect(reactivated.cancelled_at).toBeNull();
    expect(reactivated.notes).toBeNull();

    // Confirmada -> Atendida (terminal) -> intento de volver a Cancelada rechazado
    await db.query(`SELECT * FROM public.admin_manage_reservation($1::uuid, 'Atendida', NULL, NULL)`, [resRow.id]);
    const terminalErr = await expectSqlError(
      db.query(`SELECT * FROM public.admin_manage_reservation($1::uuid, 'Cancelada', NULL, NULL)`, [resRow.id]),
    );
    expect(terminalErr).toContain('INVALID_TRANSITION');
  });

  it('AUD-06 y AUD-09: integridad de mesas en PostgreSQL (capacidad, reservas, cuenta abierta) y reactivación coherente', async () => {
    await asUser(db, adminId);
    const tbl = (
      await db.query(`SELECT * FROM public.admin_save_restaurant_table(NULL, 'M-AUD6', 'Terraza', 6::smallint, true)`)
    ).rows[0];

    const d = await futureDate(db, 25);
    await asUser(db, clientA);
    const resRow = (
      await db.query(
        `SELECT * FROM public.create_reservation($1::date, '16:00'::time, 5::smallint, 'Terraza', NULL, NULL)`,
        [d],
      )
    ).rows[0];

    await asUser(db, adminId);
    // Reducir capacidad por debajo de reserva futura (5 personas -> 4) rechazado en BD
    const capErr = await expectSqlError(
      db.query(`SELECT * FROM public.admin_save_restaurant_table($1::uuid, 'M-AUD6', 'Terraza', 4::smallint, true)`, [
        tbl.id,
      ]),
    );
    expect(capErr).toContain('TABLE_CAPACITY_CONFLICT');

    // Desactivar mesa con reserva futura rechazado en BD
    const deactErr = await expectSqlError(
      db.query(`SELECT * FROM public.admin_save_restaurant_table($1::uuid, 'M-AUD6', 'Terraza', 6::smallint, false)`, [
        tbl.id,
      ]),
    );
    expect(deactErr).toContain('TABLE_HAS_ACTIVE_RESERVATIONS');

    // Cancelar reserva -> ahora sí permite desactivar y luego reactivar restaurando status = 'disponible'
    await db.query(`SELECT * FROM public.admin_manage_reservation($1::uuid, 'Cancelada', NULL, NULL)`, [resRow.id]);
    const deactivated = (
      await db.query(`SELECT * FROM public.admin_save_restaurant_table($1::uuid, 'M-AUD6', 'Terraza', 6::smallint, false)`, [
        tbl.id,
      ])
    ).rows[0];
    expect(deactivated.is_active).toBe(false);
    expect(deactivated.status).toBe('fuera_de_servicio');

    const reactivated = (
      await db.query(`SELECT * FROM public.admin_save_restaurant_table($1::uuid, 'M-AUD6', 'Terraza', 6::smallint, true)`, [
        tbl.id,
      ])
    ).rows[0];
    expect(reactivated.is_active).toBe(true);
    expect(reactivated.status).toBe('disponible');
  });

  it('AUD-13: set_default_customer_address y save_customer_address exigen perfil activo, dueño y unicidad', async () => {
    await asUser(db, clientA);
    const a1 = (
      await db.query(
        `SELECT * FROM public.save_customer_address(NULL, 'Casa', 'Calle 10 # 20-30', 'Centro', NULL, true)`,
      )
    ).rows[0];
    const a2 = (
      await db.query(
        `SELECT * FROM public.save_customer_address(NULL, 'Oficina', 'Cra 7 # 72-10', 'Chapinero', NULL, true)`,
      )
    ).rows[0];
    expect(a2.is_default).toBe(true);

    // Cambiar predeterminada de vuelta a a1 atómicamente
    const switched = (
      await db.query(`SELECT * FROM public.set_default_customer_address($1::uuid)`, [a1.id])
    ).rows[0];
    expect(switched.is_default).toBe(true);

    const defaults = await db.query(
      `SELECT id FROM public.customer_addresses WHERE user_id = $1 AND is_default = true`,
      [clientA],
    );
    expect(defaults.rows).toHaveLength(1);
    expect(defaults.rows[0].id).toBe(a1.id);

    // Cliente B no puede modificar dirección de Cliente A
    await asUser(db, clientB);
    const forbErr = await expectSqlError(
      db.query(`SELECT * FROM public.set_default_customer_address($1::uuid)`, [a1.id]),
    );
    expect(forbErr).toContain('FORBIDDEN_ADDRESS');

    // Usuario desactivado no puede invocar set_default_customer_address
    await asSystem(db);
    await db.query(`UPDATE public.profiles SET is_active = false WHERE id = $1`, [clientA]);
    await asUser(db, clientA);
    const inactiveErr = await expectSqlError(
      db.query(`SELECT * FROM public.set_default_customer_address($1::uuid)`, [a2.id]),
    );
    expect(inactiveErr).toContain('AUTH_REQUIRED');
  });
});
