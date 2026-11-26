import { expect, test } from '@playwright/test';

function buildSession(role, name) {
  const id = `${role}-e2e-89`;
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
      role_id: role === 'administrador' ? 3 : 2,
      full_name: name,
      email,
      phone: '+57 300 000 0000',
      is_active: true,
      roles: { code: role, name: role },
    },
  };
}

test.describe('Etapas 8 y 9 — Panel del Mesero y Panel Administrativo (E2E)', () => {
  test('Flujo Mesero: dashboard, mapa de mesas, nueva comanda, cuentas y bloqueo de /admin', async ({
    page,
  }) => {
    const auth = buildSession('mesero', 'Mateo Ríos');
    const state = {
      tables: [
        { id: '11111111-1111-4111-8111-111111111101', code: 'M-01', zone: 'Salón', capacity: 4, status: 'disponible', is_active: true },
      ],
      accounts: [],
      orders: [],
    };

    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/token')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth.session) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth.session.user) });
    });
    await page.route('**/rest/v1/profiles*', async (route) => {
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObj ? auth.profile : [auth.profile]) });
    });
    await page.route('**/rest/v1/restaurant_tables*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.tables) });
    });
    await page.route('**/rest/v1/table_accounts*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.accounts) });
    });
    await page.route('**/rest/v1/orders*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.orders) });
    });
    await page.route('**/rest/v1/categories*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'cat-1', slug: 'hamburguesas', name: 'Hamburguesas', display_order: 1, is_active: true }]) });
    });
    await page.route('**/rest/v1/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '22222222-2222-4222-8222-222222222201', category_id: 'cat-1', slug: 'forjada', name: 'La Forjada', price: 28900, is_addon: false, is_available: true, categories: { id: 'cat-1', slug: 'hamburguesas', name: 'Hamburguesas', is_active: true } },
        ]),
      });
    });
    await page.route('**/rest/v1/product_complements*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/rpc/get_salon_staff_directory', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            staff_id: 'mesero-comp-1',
            visible_name: 'Sofía Duarte',
            role_code: 'mesero',
            active_table_codes: ['M-01'],
          },
        ]),
      });
    });
    await page.route('**/rest/v1/rpc/create_table_order', async (route) => {
      const ord = {
        id: 'ord-w1',
        order_number: 'FB-MESA-E2E1',
        table_id: state.tables[0].id,
        table_account_id: 'acc-w1',
        waiter_id: 'mesero-comp-1',
        status: 'Pendiente',
        total: 28900,
        created_at: new Date().toISOString(),
        order_items: [{ id: 'oi-w1', product_name_snapshot: 'La Forjada', quantity: 1, line_total: 28900 }],
      };
      state.tables[0].status = 'ocupada';
      state.accounts = [
        {
          id: 'acc-w1',
          table_id: state.tables[0].id,
          opened_by: 'mesero-comp-1',
          status: 'open',
          total_amount: 28900,
          opened_at: ord.created_at,
        },
      ];
      state.orders = [ord];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ord) });
    });
    await page.route('**/rest/v1/rpc/request_table_account_close', async (route) => {
      state.accounts[0].status = 'closing_requested';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.accounts[0]) });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('mesero@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/mesero$/);

    await page.goto('/mesero/comandas/nueva');
    await page.getByLabel(/mesa de salón/i).selectOption(state.tables[0].id);
    await page.getByRole('button', { name: /agregar/i }).first().click();
    await page.getByRole('button', { name: /confirmar comanda/i }).click();
    await expect(page.getByRole('status')).toContainText('FB-MESA-E2E1');

    await page.goto('/mesero/cuentas');
    await expect(page.getByText('Mesa M-01')).toBeVisible();
    await expect(page.getByText('Sofía Duarte')).toBeVisible();
    await page.getByRole('button', { name: /solicitar cierre/i }).click();
    await page.getByRole('button', { name: /enviar solicitud a caja/i }).click();
    await expect(page.getByRole('status')).toContainText('Solicitud de cierre enviada');

    // Mesero bloqueado en /admin/usuarios
    await page.goto('/admin/usuarios');
    await expect(page).toHaveURL(/\/acceso-denegado$/);
  });

  test('Flujo Administrador: dashboard, productos, pedidos, usuarios, roles y auditoría', async ({
    page,
  }) => {
    const auth = buildSession('administrador', 'Camila Herrera');

    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/token')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth.session) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(auth.session.user) });
    });
    await page.route('**/rest/v1/profiles*', async (route) => {
      const url = route.request().url();
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      if (url.includes('id=eq.')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObj ? auth.profile : [auth.profile]) });
        return;
      }
      const list = [
        auth.profile,
        { id: 'u-cli-1', full_name: 'Valentina Gómez', email: 'val@test.co', is_active: true, roles: { code: 'cliente', name: 'Cliente' } },
      ];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
    });
    await page.route('**/rest/v1/roles*', async (route) => {
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      const rolesList = [
        { id: 1, code: 'cliente', name: 'Cliente', description: 'Cliente' },
        { id: 2, code: 'mesero', name: 'Mesero', description: 'Salón' },
        { id: 3, code: 'administrador', name: 'Administrador', description: 'Control total' },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isObj ? rolesList[2] : rolesList),
      });
    });
    await page.route('**/rest/v1/permissions*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, code: 'orders.create', description: 'Crear pedidos' }]) });
    });
    await page.route('**/rest/v1/role_permissions*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ role_id: 3, permission_id: 1 }]) });
    });
    const adminOrdersState = [
      {
        id: 'ord-ref-1',
        order_number: 'FB-DOM-REF1',
        modality: 'domicilio',
        customer_name: 'Valentina Gómez',
        subtotal: 28900,
        delivery_fee: 6000,
        total: 34900,
        status: 'Cancelado',
        payment_status: 'Confirmación simulada',
        created_at: new Date().toISOString(),
        payments: [
          {
            id: 'pay-ref-1',
            method: 'Nequi',
            status: 'Confirmación simulada',
            amount: 34900,
            transaction_ref: 'DEMO-NEQUI-99',
          },
        ],
        order_items: [{ id: 'oi-r1', product_name_snapshot: 'La Forjada', quantity: 1, line_total: 28900 }],
        order_status_history: [],
      },
    ];

    await page.route('**/rest/v1/orders*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminOrdersState) });
    });
    await page.route('**/rest/v1/rpc/refund_order_payment', async (route) => {
      adminOrdersState[0].payment_status = 'Reembolsado';
      adminOrdersState[0].payments = [
        {
          id: 'pay-ref-2',
          method: 'Nequi',
          status: 'Reembolsado',
          amount: 34900,
          transaction_ref: 'REF-DEMO-NEQUI-99',
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminOrdersState[0].payments[0]),
      });
    });
    await page.route('**/rest/v1/restaurant_tables*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/table_accounts*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/reservations*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/products*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/product_complements*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/categories*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/audit_logs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'log-1', actor_role: 'administrador', entity_name: 'orders', entity_id: 'o-1', action: 'CREATE_ORDER', old_data: null, new_data: { total: 28900 }, created_at: new Date().toISOString() },
        ]),
      });
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/usuarios');
    await expect(page.getByText('Valentina Gómez')).toBeVisible();

    await page.goto('/admin/roles');
    await expect(page.getByText('orders.create')).toBeVisible();

    await page.goto('/admin/auditoria');
    await expect(page.getByText('CREATE_ORDER')).toBeVisible();

    // AUD811-03: Flujo administrativo de reembolso sobre pedido Cancelado con pago confirmado
    await page.goto('/admin/pedidos');
    await expect(page.getByText('FB-DOM-REF1')).toBeVisible();
    await page.getByRole('button', { name: /reembolsar pago/i }).click();
    await expect(page.getByText('DEMO-NEQUI-99')).toBeVisible();
    await expect(page.getByText(/no ejecuta una reversión bancaria real/i)).toBeVisible();
    const confirmRefundBtn = page.getByRole('button', { name: /confirmar reembolso/i });
    await expect(confirmRefundBtn).toBeDisabled();
    await page.locator('#refund-reason').fill('Cancelación por solicitud del cliente tras pago digital');
    await expect(confirmRefundBtn).toBeEnabled();
    await confirmRefundBtn.click();
    await expect(page.getByRole('status').first()).toContainText('Reembolso registrado');
  });
});
