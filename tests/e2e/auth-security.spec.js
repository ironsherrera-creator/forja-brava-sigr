import { expect, test } from '@playwright/test';

function toBase64Url(input) {
  return Buffer.from(JSON.stringify(input))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createMockSession({
  id = '11111111-1111-4111-8111-111111111111',
  email = 'cliente@forjabrava.test',
  fullName = 'Valentina Gómez',
}) {
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
  const accessToken = `${header}.${payload}.mocksignature`;

  const user = {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-11-24T12:00:00Z',
    user_metadata: { full_name: fullName },
    app_metadata: { provider: 'email', providers: ['email'] },
    created_at: '2026-11-24T12:00:00Z',
    updated_at: '2026-11-24T12:00:00Z',
  };

  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: `refresh-${id}`,
    user,
  };
}

function createProfileRecord({
  id = '11111111-1111-4111-8111-111111111111',
  email = 'cliente@forjabrava.test',
  fullName = 'Valentina Gómez',
  roleCode = 'cliente',
  roleName = 'Cliente',
  isActive = true,
}) {
  return {
    id,
    role_id: `role-${roleCode}`,
    full_name: fullName,
    email,
    phone: '+57 300 123 4567',
    is_active: isActive,
    created_at: '2026-11-24T12:00:00Z',
    updated_at: '2026-11-24T12:00:00Z',
    roles: {
      id: `role-${roleCode}`,
      code: roleCode,
      name: roleName,
    },
  };
}

async function installSupabaseMocks(page, handlers = {}) {
  await page.route('**/rest/v1/profiles*', async (route) => {
    const accept = route.request().headers()['accept'] || '';
    const record = handlers.getProfile ? handlers.getProfile() : null;

    if (accept.includes('application/vnd.pgrst.object+json')) {
      await route.fulfill({
        status: record ? 200 : 406,
        contentType: 'application/json',
        body: JSON.stringify(record || { message: 'No rows found' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(record ? [record] : []),
    });
  });

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/auth/v1/signup') && method === 'POST') {
      const response = handlers.onSignUp
        ? handlers.onSignUp(route.request().postDataJSON())
        : { status: 200, body: {} };
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
      });
      return;
    }

    if (url.includes('/auth/v1/token') && method === 'POST') {
      const response = handlers.onToken
        ? handlers.onToken(route.request().postDataJSON())
        : {
            status: 400,
            body: {
              code: 'invalid_credentials',
              message: 'Invalid login credentials',
            },
          };
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
      });
      return;
    }

    if (url.includes('/auth/v1/recover') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
      return;
    }

    if (url.includes('/auth/v1/verify') && method === 'POST') {
      const response = handlers.onVerifyOtp
        ? handlers.onVerifyOtp(route.request().postDataJSON())
        : {
            status: 400,
            body: { code: 'otp_expired', message: 'Token has expired or is invalid' },
          };
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
      });
      return;
    }

    if (url.includes('/auth/v1/user') && (method === 'PUT' || method === 'GET')) {
      const response = handlers.onUser
        ? handlers.onUser(method, route.request().postDataJSON?.())
        : { status: 200, body: {} };
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
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
      body: JSON.stringify({}),
    });
  });
}

test.describe('Etapa 3 — Seguridad, Autenticación y Control de Acceso (E2E)', () => {
  test('1. Registro exitoso de cliente con aviso de confirmación de correo', async ({
    page,
  }) => {
    await installSupabaseMocks(page, {
      onSignUp: (payload) => ({
        status: 200,
        body: {
          id: '22222222-2222-4222-8222-222222222222',
          aud: 'authenticated',
          email: payload.email,
          identities: [{ id: 'ident-1' }],
          confirmation_sent_at: '2026-11-24T12:00:00Z',
        },
      }),
    });

    await page.goto('/registro');
    await page.getByLabel('Nombre completo').fill('Valentina Gómez');
    await page.getByLabel('Correo electrónico').fill('valentina@forjabrava.test');
    await page
      .getByLabel('Teléfono de contacto (opcional)')
      .fill('+57 300 123 4567');
    await page.locator('#register-password').fill('Brava2026');
    await page.locator('#register-confirm-password').fill('Brava2026');
    await page.getByRole('button', { name: /crear cuenta/i }).click();

    await expect(page.getByRole('status')).toContainText('Cuenta registrada');
  });

  test('2. Registro con datos inválidos muestra errores de validación por campo', async ({
    page,
  }) => {
    await installSupabaseMocks(page);
    await page.goto('/registro');

    await page.getByLabel('Nombre completo').fill('A');
    await page.getByLabel('Correo electrónico').fill('correo-invalido');
    await page.locator('#register-password').fill('123');
    await page.locator('#register-confirm-password').fill('999');
    await page.getByRole('button', { name: /crear cuenta/i }).click();

    await expect(page.locator('#register-fullname-error')).toBeVisible();
    await expect(page.locator('#register-email-error')).toBeVisible();
    await expect(page.locator('#register-password-error')).toBeVisible();
    await expect(page.locator('#register-confirm-error')).toContainText(
      'Las contraseñas no coinciden',
    );
  });

  test('3, 7 y 8. Inicio de sesión correcto, persistencia tras recarga y cierre de sesión', async ({
    page,
  }) => {
    const session = createMockSession({});
    const profile = createProfileRecord({ roleCode: 'cliente' });

    await installSupabaseMocks(page, {
      onToken: () => ({ status: 200, body: session }),
      getProfile: () => profile,
      onUser: () => ({ status: 200, body: session.user }),
    });

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('cliente@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(page).toHaveURL(/\/cliente$/);
    await expect(
      page.getByRole('heading', { name: /Hola, Valentina Gómez/i }),
    ).toBeVisible();

    // Escenario 7: Persistencia de sesión tras recarga de página
    await page.reload();
    await expect(page).toHaveURL(/\/cliente$/);
    await expect(
      page.getByRole('heading', { name: /Hola, Valentina Gómez/i }),
    ).toBeVisible();

    // Escenario 8: Cierre de sesión limpia estado y redirige a /login
    await page.getByRole('button', { name: /cerrar sesión/i }).click();
    await expect(page).toHaveURL(/\/login(\?redirect=%2Fcliente)?$/);

    // Tras cerrar sesión, intentar volver a /cliente redirige a /login
    await page.goto('/cliente');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcliente/);
  });

  test('4. Inicio de sesión incorrecto presenta mensaje seguro sin exponer detalles internos', async ({
    page,
  }) => {
    await installSupabaseMocks(page, {
      onToken: () => ({
        status: 400,
        body: {
          code: 'invalid_credentials',
          message: 'Invalid login credentials',
        },
      }),
    });

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('cliente@forjabrava.test');
    await page.locator('#login-password').fill('ClaveIncorrecta99');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(page.getByRole('alert')).toContainText(
      'El correo electrónico o la contraseña no son correctos.',
    );
  });

  test('5. Recuperación de contraseña devuelve mensaje neutral contra enumeración', async ({
    page,
  }) => {
    await installSupabaseMocks(page);

    await page.goto('/recuperar-contrasena');
    await page
      .getByLabel('Correo electrónico asociado')
      .fill('cualquier@forjabrava.test');
    await page
      .getByRole('button', { name: /enviar enlace de recuperación/i })
      .click();

    await expect(page.getByRole('status')).toContainText(
      'Si el correo está asociado a una cuenta activa, recibirás un enlace',
    );
  });

  test('6. Actualización de contraseña valida enlace token_hash y guarda nueva clave', async ({
    page,
  }) => {
    const recoverySession = createMockSession({});
    const profile = createProfileRecord({ roleCode: 'cliente' });

    await installSupabaseMocks(page, {
      onVerifyOtp: () => ({ status: 200, body: recoverySession }),
      getProfile: () => profile,
      onUser: () => ({ status: 200, body: recoverySession.user }),
    });

    await page.goto(
      '/actualizar-contrasena?token_hash=mock-recovery-hash&type=recovery',
    );
    await expect(page.locator('#reset-password')).toBeVisible();

    await page.locator('#reset-password').fill('NuevaClave2026');
    await page.locator('#reset-confirm-password').fill('NuevaClave2026');
    await page
      .getByRole('button', { name: /actualizar contraseña/i })
      .click();

    await expect(page.getByRole('status')).toContainText(
      'Tu contraseña ha sido actualizada correctamente',
    );
  });

  test('9. Acceso a rutas protegidas (/cliente, /mesero, /admin) sin sesión redirige a /login', async ({
    page,
  }) => {
    await installSupabaseMocks(page);

    for (const privatePath of ['/cliente', '/mesero', '/admin']) {
      await page.goto(privatePath);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?redirect=${encodeURIComponent(privatePath)}`),
      );
    }
  });

  test('10. Bloqueo de acceso por rol incorrecto redirige a /acceso-denegado (403)', async ({
    page,
  }) => {
    const clientSession = createMockSession({});
    const clientProfile = createProfileRecord({ roleCode: 'cliente' });

    await installSupabaseMocks(page, {
      onToken: () => ({ status: 200, body: clientSession }),
      getProfile: () => clientProfile,
      onUser: () => ({ status: 200, body: clientSession.user }),
    });

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('cliente@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/cliente$/);

    // Intento de entrar a /admin con sesión de cliente
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/acceso-denegado$/);
    await expect(page.getByText('Acceso restringido · 403')).toBeVisible();

    // Intento de entrar a /mesero con sesión de cliente
    await page.goto('/mesero');
    await expect(page).toHaveURL(/\/acceso-denegado$/);
  });

  test('11. Bloqueo inmediato de cuentas desactivadas (is_active = false)', async ({
    page,
  }) => {
    const disabledSession = createMockSession({
      email: 'suspendido@forjabrava.test',
    });
    const disabledProfile = createProfileRecord({
      email: 'suspendido@forjabrava.test',
      isActive: false,
    });

    await installSupabaseMocks(page, {
      onToken: () => ({ status: 200, body: disabledSession }),
      getProfile: () => disabledProfile,
    });

    await page.goto('/login');
    await page
      .getByLabel('Correo electrónico')
      .fill('suspendido@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert').first()).toContainText(
      'Tu cuenta se encuentra desactivada',
    );
  });

  test('12. Acceso libre a rutas públicas sin autenticación y neutralización de /admin.html', async ({
    page,
  }) => {
    await installSupabaseMocks(page);

    await page.goto('/');
    await expect(
      page.getByRole('link', { name: /iniciar sesión/i }).first(),
    ).toBeVisible();

    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: /tu cuenta/i }),
    ).toBeVisible();

    await page.goto('/registro');
    await expect(
      page.getByRole('heading', { name: /únete a/i }),
    ).toBeVisible();

    // Verificar que /admin.html heredado no expone formulario demo y exige login administrativo
    await page.goto('/admin.html');
    await expect(page).toHaveURL(/\/login(\?redirect=%2Fadmin)?$/);
  });
});
