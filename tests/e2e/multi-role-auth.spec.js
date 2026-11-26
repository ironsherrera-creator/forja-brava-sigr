import { expect, test } from '@playwright/test';

const ROLE_ACCOUNTS = {
  cliente: {
    id: '11111111-1111-4111-8111-0000000000c1',
    email: 'cliente@forjabrava.com',
    role: 'cliente',
    roleId: 1,
    name: 'Valentina Gómez (Prueba)',
    homeRegex: /\/cliente$/,
  },
  mesero: {
    id: '22222222-2222-4222-8222-0000000000m2',
    email: 'mesero@forjabrava.com',
    role: 'mesero',
    roleId: 2,
    name: 'Mateo Ríos (Prueba)',
    homeRegex: /\/mesero$/,
  },
  administrador: {
    id: '33333333-3333-4333-8333-0000000000a3',
    email: 'admin@forjabrava.com',
    role: 'administrador',
    roleId: 3,
    name: 'Camila Herrera (Prueba)',
    homeRegex: /\/admin$/,
  },
};

function makeAuthPayload(acc) {
  return {
    session: {
      access_token: `tok-${acc.role}-e2e`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: `ref-${acc.role}-e2e`,
      user: {
        id: acc.id,
        email: acc.email,
        aud: 'authenticated',
        role: 'authenticated',
      },
    },
    profile: {
      id: acc.id,
      role_id: acc.roleId,
      full_name: acc.name,
      email: acc.email,
      phone: '+57 300 100 0000',
      is_active: true,
      roles: { id: acc.roleId, code: acc.role, name: acc.role },
    },
  };
}

async function setupMultiRoleMocks(page) {
  let activeAccount = null;

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/logout')) {
      activeAccount = null;
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (url.includes('/token')) {
      const body = route.request().postDataJSON() || {};
      const found = Object.values(ROLE_ACCOUNTS).find((a) => a.email === body.email);
      if (!found) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
        });
        return;
      }
      activeAccount = found;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeAuthPayload(found).session),
      });
      return;
    }
    if (!activeAccount) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'No session' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeAuthPayload(activeAccount).session.user),
    });
  });

  await page.route('**/rest/v1/profiles*', async (route) => {
    if (!activeAccount) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      return;
    }
    const isObj = (route.request().headers()['accept'] || '').includes('object+json');
    const payload = makeAuthPayload(activeAccount).profile;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isObj ? payload : [payload]),
    });
  });

  await page.route('**/rest/v1/rpc/get_salon_staff_directory', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/rest/v1/rpc/get_admin_reports_summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sales: { totalOrders: 0, validOrdersCount: 0, cancelledOrdersCount: 0, totalSales: 0, avgTicket: 0, salesByDay: [] },
        payments: { totalPaid: 0, count: 0, refundedTotal: 0, refundedCount: 0, byMethod: { Efectivo: 0, Tarjeta: 0, Nequi: 0, PSE: 0 } },
        cashMovements: { manualIncomeTotal: 0, manualExpenseTotal: 0, refundMovementsTotal: 0 },
        products: { topProducts: [], byCategory: [] },
        operation: { ordersByStatus: {}, ordersByModality: { domicilio: 0, recoger: 0, mesa: 0 }, reservationsCount: 0, tablesUsedCount: 0, openAccountsCount: 0, closedAccountsCount: 0 },
        cash: { sessions: [], totalDifference: 0 },
      }),
    });
  });
  await page.route('**/rest/v1/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/profiles') || url.includes('/rpc/')) {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function loginAs(page, email) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.locator('#login-password').fill('E2eMockPass2026');
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
}

test.describe('Validación Multirol E2E — Cliente, Mesero y Administrador', () => {
  test('Cliente (cliente@forjabrava.com): accede a /cliente y es bloqueado (403) en /mesero, /admin, /admin/caja y /admin/reportes', async ({
    page,
  }) => {
    await setupMultiRoleMocks(page);
    await loginAs(page, ROLE_ACCOUNTS.cliente.email);
    await expect(page).toHaveURL(ROLE_ACCOUNTS.cliente.homeRegex);

    for (const forbiddenPath of ['/mesero', '/mesero/mesas', '/admin', '/admin/caja', '/admin/reportes', '/admin/usuarios']) {
      await page.goto(forbiddenPath);
      await expect(page).toHaveURL(/\/acceso-denegado$/);
    }
  });

  test('Mesero (mesero@forjabrava.com): accede a /mesero y es bloqueado (403) en /cliente, /checkout, /admin, /admin/caja y /admin/usuarios', async ({
    page,
  }) => {
    await setupMultiRoleMocks(page);
    await loginAs(page, ROLE_ACCOUNTS.mesero.email);
    await expect(page).toHaveURL(ROLE_ACCOUNTS.mesero.homeRegex);

    await page.goto('/mesero/mesas');
    await expect(page).toHaveURL(/\/mesero\/mesas$/);

    for (const forbiddenPath of ['/cliente', '/checkout', '/admin', '/admin/caja', '/admin/reportes', '/admin/usuarios']) {
      await page.goto(forbiddenPath);
      await expect(page).toHaveURL(/\/acceso-denegado$/);
    }
  });

  test('Administrador (admin@forjabrava.com): accede a /admin, /admin/caja y /admin/reportes, y es bloqueado (403) en /mesero y /cliente', async ({
    page,
  }) => {
    await setupMultiRoleMocks(page);
    await loginAs(page, ROLE_ACCOUNTS.administrador.email);
    await expect(page).toHaveURL(ROLE_ACCOUNTS.administrador.homeRegex);

    await page.goto('/admin/caja');
    await expect(page).toHaveURL(/\/admin\/caja$/);

    await page.goto('/admin/reportes');
    await expect(page).toHaveURL(/\/admin\/reportes$/);

    for (const forbiddenPath of ['/mesero', '/cliente', '/checkout']) {
      await page.goto(forbiddenPath);
      await expect(page).toHaveURL(/\/acceso-denegado$/);
    }
  });
});
