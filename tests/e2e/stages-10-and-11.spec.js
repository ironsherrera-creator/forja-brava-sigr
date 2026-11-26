import { expect, test } from '@playwright/test';

function buildSession(role, name) {
  const id = `${role}-e2e-1011`;
  const email = `${role}@forjabrava.test`;
  return {
    session: {
      access_token: `tok-${role}`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: `ref-${role}`,
      user: { id, email, aud: 'authenticated', role: 'authenticated' },
    },
    profile: {
      id,
      role_id: role === 'administrador' ? 3 : 1,
      full_name: name,
      email,
      phone: '+57 300 000 0000',
      is_active: true,
      roles: { code: role, name: role },
    },
  };
}

test.describe('Etapas 10 y 11 — Caja, Movimientos, Reportes y Permisos (E2E)', () => {
  test('Flujo Administrador: apertura de caja, movimiento manual, arqueo/cierre y reportes', async ({
    page,
  }) => {
    const auth = buildSession('administrador', 'Camila Herrera');
    const state = {
      sessions: [],
      movements: [],
    };

    await page.route('**/auth/v1/**', async (route) => {
      if (route.request().url().includes('/token')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth.session) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth.session.user) });
    });
    await page.route('**/rest/v1/profiles*', async (route) => {
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObj ? auth.profile : [auth.profile]) });
    });
    await page.route('**/rest/v1/cash_sessions*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.sessions) });
    });
    await page.route('**/rest/v1/cash_movements*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.movements) });
    });
    await page.route('**/rest/v1/table_accounts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.openAccounts ?? []),
      });
    });
    await page.route('**/rest/v1/orders*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'o1', modality: 'domicilio', status: 'Entregado', total: 35000, created_at: new Date().toISOString() },
        ]),
      });
    });
    await page.route('**/rest/v1/order_items*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'i1', order_id: 'o1', product_id: 'p1', product_name_snapshot: 'La Forjada', quantity: 1, line_total: 28900 },
        ]),
      });
    });
    await page.route('**/rest/v1/payments*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'pay1', method: 'Nequi', status: 'Confirmación simulada', amount: 35000, paid_at: new Date().toISOString() },
        ]),
      });
    });
    await page.route('**/rest/v1/restaurant_tables*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'tbl-1', code: 'M-05', zone: 'Terraza' }]),
      });
    });
    await page.route('**/rest/v1/reservations*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/products*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'p1', category_id: 'c1', name: 'La Forjada', is_available: true }]) });
    });
    await page.route('**/rest/v1/categories*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'c1', name: 'Hamburguesas' }]) });
    });
    await page.route('**/rest/v1/rpc/open_cash_session', async (route) => {
      const { p_opening_balance } = route.request().postDataJSON();
      const s = { id: 'cs-e2e-1', status: 'open', opening_balance: p_opening_balance, opened_at: new Date().toISOString() };
      state.sessions = [s];
      state.openAccounts = [
        {
          id: 'acc-cash-1',
          table_id: 'tbl-1',
          status: 'closing_requested',
          total_amount: 50000,
          opened_at: new Date().toISOString(),
          closing_requested_at: new Date().toISOString(),
        },
      ];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(s) });
    });
    await page.route('**/rest/v1/rpc/settle_table_account', async (route) => {
      state.openAccounts = [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'acc-cash-1', status: 'closed', total_amount: 50000 }),
      });
    });
    await page.route('**/rest/v1/rpc/get_admin_reports_summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sales: {
            totalOrders: 3505,
            validOrdersCount: 3500,
            cancelledOrdersCount: 5,
            totalSales: 70000000,
            avgTicket: 20000,
            salesByDay: [{ date: '2026-11-25', ordersCount: 3500, total: 70000000 }],
          },
          payments: {
            totalPaid: 70000000,
            count: 3500,
            refundedTotal: 34900,
            refundedCount: 1,
            byMethod: { Efectivo: 20000000, Tarjeta: 15000000, Nequi: 35000000, PSE: 0 },
          },
          cashMovements: {
            manualIncomeTotal: 15000,
            manualExpenseTotal: 0,
            refundMovementsTotal: 34900,
          },
          products: {
            topProducts: [{ productId: 'p1', name: 'La Forjada', quantity: 3500, revenue: 70000000 }],
            byCategory: [{ category: 'Hamburguesas', quantity: 3500, revenue: 70000000 }],
          },
          operation: {
            ordersByStatus: { Entregado: 3500, Cancelado: 5 },
            ordersByModality: { domicilio: 2000, recoger: 1000, mesa: 505 },
            reservationsCount: 12,
            tablesUsedCount: 8,
            openAccountsCount: 0,
            closedAccountsCount: 25,
          },
          cash: {
            sessions: state.sessions,
            totalDifference: 0,
          },
        }),
      });
    });
    await page.route('**/rest/v1/rpc/register_cash_movement', async (route) => {
      const body = route.request().postDataJSON();
      const m = {
        id: 'cm-e2e-1',
        cash_session_id: 'cs-e2e-1',
        movement_type: body.p_movement_type,
        payment_method: body.p_payment_method,
        amount: body.p_amount,
        concept: body.p_concept,
        created_at: new Date().toISOString(),
      };
      state.movements = [m];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) });
    });
    await page.route('**/rest/v1/rpc/close_cash_session', async (route) => {
      const { p_counted_cash } = route.request().postDataJSON();
      state.sessions[0] = {
        ...state.sessions[0],
        status: 'closed',
        expected_cash: 115000,
        counted_cash: p_counted_cash,
        difference: p_counted_cash - 115000,
        closed_at: new Date().toISOString(),
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.sessions[0]) });
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 1. Abrir caja y validar monto recibido en efectivo (AUD811-07)
    await page.goto('/admin/caja');
    await page.getByLabel(/saldo inicial/i).fill('100000');
    await page.getByRole('button', { name: /abrir sesión de caja/i }).click();
    await expect(page.getByRole('status').first()).toContainText('Turno de caja abierto');

    const receivedInput = page.getByLabel(/efectivo recibido mesa m-05/i);
    const settleBtn = page.getByRole('button', { name: /cobrar y cerrar cuenta/i });
    await receivedInput.fill('20000');
    await expect(page.getByText(/inferior al saldo pendiente/i)).toBeVisible();
    await expect(settleBtn).toBeDisabled();

    await receivedInput.fill('60000');
    await expect(page.getByText(/cambio:/i)).toBeVisible();
    await expect(settleBtn).toBeEnabled();
    await settleBtn.click();
    await expect(page.getByRole('status').first()).toContainText('Cuenta de Mesa M-05 cobrada');

    // 2. Registrar movimiento manual
    await page.goto('/admin/movimientos');
    await page.getByLabel(/importe/i).fill('15000');
    await page.getByLabel(/concepto/i).fill('Base adicional');
    await page.getByRole('button', { name: /registrar movimiento/i }).click();
    await expect(page.getByRole('status').first()).toContainText('Movimiento registrado');

    // 3. Arqueo y cierre de caja
    await page.goto('/admin/caja/arqueos');
    await page.getByLabel(/efectivo físico contado/i).fill('115000');
    await page.getByRole('button', { name: /cerrar sesión de caja/i }).click();
    await page.getByRole('button', { name: /cerrar caja ahora/i }).click();
    await expect(page.getByRole('status').first()).toContainText('Sesión de caja cerrada');

    // 4. Reportes agregados en PostgreSQL con los 7 filtros expuestos (AUD811-04)
    await page.goto('/admin/reportes');
    await expect(page.getByRole('cell', { name: 'La Forjada' })).toBeVisible();
    await expect(page.getByLabel('Fecha inicial')).toBeVisible();
    await expect(page.getByLabel('Fecha final')).toBeVisible();
    await expect(page.getByLabel('Estado')).toBeVisible();
    await expect(page.getByLabel('Modalidad')).toBeVisible();
    await expect(page.getByLabel('Método de pago')).toBeVisible();
    await expect(page.getByLabel('Categoría')).toBeVisible();
    await expect(page.getByLabel('Producto')).toBeVisible();
    await expect(page.getByRole('button', { name: /exportar csv/i })).toBeEnabled();
  });

  test('Seguridad: cliente bloqueado en /admin/caja y /admin/reportes (403)', async ({ page }) => {
    const auth = buildSession('cliente', 'Valentina Gómez');
    await page.route('**/auth/v1/**', async (route) => {
      if (route.request().url().includes('/token')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth.session) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth.session.user) });
    });
    await page.route('**/rest/v1/profiles*', async (route) => {
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObj ? auth.profile : [auth.profile]) });
    });
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('cliente@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/cliente$/);

    await page.goto('/admin/caja');
    await expect(page).toHaveURL(/\/acceso-denegado$/);
    await page.goto('/admin/reportes');
    await expect(page).toHaveURL(/\/acceso-denegado$/);
  });
});
