import { expect, test } from '@playwright/test';

const WAITER = {
  id: '22222222-2222-4222-8222-0000000000w1',
  email: 'mesero@forjabrava.com',
  name: 'Mateo Ríos (Prueba)',
};

async function setup(page, state) {
  const session = {
    access_token: 'tok-w',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'ref-w',
    user: { id: WAITER.id, email: WAITER.email, aud: 'authenticated', role: 'authenticated' },
  };
  const profile = {
    id: WAITER.id,
    role_id: 2,
    full_name: WAITER.name,
    email: WAITER.email,
    phone: '',
    is_active: true,
    roles: { id: 2, code: 'mesero', name: 'Mesero' },
  };
  await page.route('**/auth/v1/**', async (route) => {
    const body = route.request().url().includes('/token') ? session : session.user;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/rest/v1/profiles*', async (route) => {
    const isObj = (route.request().headers()['accept'] || '').includes('object+json');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObj ? profile : [profile]) });
  });
  await page.route('**/rest/v1/restaurant_tables*', async (route) => {
    if (state.tablesError) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'permission denied' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.tables) });
  });
  await page.route('**/rest/v1/table_accounts*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/rest/v1/orders*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/rest/v1/rpc/get_salon_staff_directory', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(WAITER.email);
  await page.locator('#login-password').fill('E2eMockPass2026');
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/mesero$/);
}

test.describe('Mesero — mapa de mesas', () => {
  test('sin mesas configuradas muestra aviso al administrador y tras configurarlas se reflejan al actualizar', async ({ page }) => {
    const state = { tables: [] };
    await setup(page, state);
    await login(page);

    await page.goto('/mesero/mesas');
    await expect(page.getByText('Aún no hay mesas configuradas')).toBeVisible();

    state.tables = [
      { id: 't-e2e-1', code: 'M-01', zone: 'Salón', capacity: 4, status: 'disponible', is_active: true },
      { id: 't-e2e-2', code: 'M-02', zone: 'Salón', capacity: 2, status: 'ocupada', is_active: true },
    ];
    await page.getByRole('button', { name: /actualizar/i }).click();
    await expect(page.getByRole('heading', { name: 'M-01' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'M-02' })).toBeVisible();
    await expect(page.getByText('Aún no hay mesas configuradas')).toHaveCount(0);
  });

  test('error de permisos al leer mesas se muestra como error, no como lista vacía', async ({ page }) => {
    await setup(page, { tables: [], tablesError: true });
    await login(page);
    await page.goto('/mesero/mesas');
    await expect(page.getByText('No fue posible cargar el mapa de mesas')).toBeVisible();
  });
});
