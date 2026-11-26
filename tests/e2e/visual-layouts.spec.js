import { expect, test } from '@playwright/test';

function toBase64Url(input) {
  return Buffer.from(JSON.stringify(input))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function buildRoleSession(roleCode, fullName) {
  const id = `99999999-9999-4999-8999-${roleCode.padEnd(12, '0').slice(0, 12)}`;
  const email = `${roleCode}@forjabrava.test`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 3600;
  const header = toBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = toBase64Url({
    aud: 'authenticated',
    exp: expiresAt,
    iat: now,
    sub: id,
    email,
    role: 'authenticated',
  });

  return {
    session: {
      access_token: `${header}.${payload}.mocksignature`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: `refresh-${roleCode}`,
      user: {
        id,
        aud: 'authenticated',
        role: 'authenticated',
        email,
        email_confirmed_at: '2026-11-24T12:00:00Z',
        user_metadata: { full_name: fullName },
        app_metadata: { provider: 'email', providers: ['email'] },
      },
    },
    profile: {
      id,
      role_id: `role-${roleCode}`,
      full_name: fullName,
      email,
      phone: '+57 300 000 0000',
      is_active: true,
      created_at: '2026-11-24T12:00:00Z',
      updated_at: '2026-11-24T12:00:00Z',
      roles: {
        id: `role-${roleCode}`,
        code: roleCode,
        name: roleCode,
      },
    },
  };
}

async function mockAuthenticatedRole(page, roleCode, fullName) {
  const { session, profile } = buildRoleSession(roleCode, fullName);

  await page.route('**/rest/v1/profiles*', async (route) => {
    const accept = route.request().headers()['accept'] || '';
    const isSingle = accept.includes('application/vnd.pgrst.object+json');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isSingle ? profile : [profile]),
    });
  });

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      });
      return;
    }
    if (url.includes('/auth/v1/logout')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session.user),
    });
  });

  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(`${roleCode}@forjabrava.test`);
  await page.locator('#login-password').fill('Brava2026');
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
}

test.describe('Etapa 4 — Sistema Visual, 4 Layouts y Responsive (E2E)', () => {
  test('PublicLayout: escritorio (1366px), móvil (360px/390px), drawer y cero errores de consola', async ({
    page,
  }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await expect(
      page.getByRole('navigation', { name: /navegación principal/i }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/evidencias-etapa-4/public-desktop-1366.png',
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: /abrir menú de navegación/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({
      path: 'test-results/evidencias-etapa-4/public-mobile-390.png',
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.setViewportSize({ width: 360, height: 780 });
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    expect(hasOverflow).toBe(false);
    expect(consoleErrors).toEqual([]);
  });

  test('ClientLayout: navegación completa, breadcrumbs, menú usuario y capturas desktop/móvil', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockAuthenticatedRole(page, 'cliente', 'Valentina Gómez');
    await expect(page).toHaveURL(/\/cliente$/);

    await page.screenshot({
      path: 'test-results/evidencias-etapa-4/client-desktop-1366.png',
    });

    await page
      .getByRole('complementary', { name: /navegación del cliente/i })
      .getByRole('link', { name: 'Mis pedidos' })
      .click();
    await expect(page).toHaveURL(/\/cliente\/pedidos$/);
    await expect(
      page.getByRole('navigation', { name: /ruta de navegación/i }),
    ).toContainText('Pedidos');

    // Vista móvil 390px + Drawer móvil
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /abrir menú de navegación/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({
      path: 'test-results/evidencias-etapa-4/client-mobile-390.png',
    });
    await page.keyboard.press('Escape');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    expect(overflow).toBe(false);
  });

  test('WaiterLayout: operación rápida en tablet (768px) y escritorio (1366px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mockAuthenticatedRole(page, 'mesero', 'Mateo Rojas');
    await expect(page).toHaveURL(/\/mesero$/);

    await page.screenshot({
      path: 'test-results/evidencias-etapa-4/waiter-desktop-1366.png',
    });

    await page
      .getByRole('complementary', { name: /navegación operativa del mesero/i })
      .getByRole('link', { name: 'Mesas' })
      .click();
    await expect(page).toHaveURL(/\/mesero\/mesas$/);

    // Tablet 768px + drawer operativo
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.getByRole('button', { name: /abrir menú de navegación/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({
      path: 'test-results/evidencias-etapa-4/waiter-tablet-768.png',
    });
    await page.keyboard.press('Escape');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    expect(overflow).toBe(false);
  });

  test('AdminLayout: navegación agrupada, colapso sidebar, resolución 1920px y móvil 390px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await mockAuthenticatedRole(page, 'administrador', 'Camila Herrera');
    await expect(page).toHaveURL(/\/admin$/);

    await page.screenshot({
      path: 'test-results/evidencias-etapa-4/admin-desktop-1920.png',
    });

    await page
      .getByRole('complementary', { name: /navegación administrativa/i })
      .getByRole('link', { name: 'Caja' })
      .click();
    await expect(page).toHaveURL(/\/admin\/caja$/);

    // Contraer y volver a expandir sidebar
    await page.getByRole('button', { name: /contraer menú lateral/i }).click();
    await expect(
      page.getByRole('button', { name: /expandir menú lateral/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /expandir menú lateral/i }).click();

    // Móvil 390px
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /abrir menú de navegación/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({
      path: 'test-results/evidencias-etapa-4/admin-mobile-390.png',
    });
    await page.keyboard.press('Escape');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    expect(overflow).toBe(false);
  });
});
