import { expect, test } from '@playwright/test';

function toBase64Url(input) {
  return Buffer.from(JSON.stringify(input))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function buildUserSession(roleCode, fullName) {
  const id = `77777777-7777-4777-8777-${roleCode.padEnd(12, '0').slice(0, 12)}`;
  const email = `${roleCode}@forjabrava.test`;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const header = toBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = toBase64Url({ aud: 'authenticated', exp, iat: now, sub: id, email, role: 'authenticated' });

  return {
    session: {
      access_token: `${header}.${payload}.mocksignature`,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: exp,
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
      phone: '+57 300 111 2222',
      is_active: true,
      created_at: '2026-11-24T12:00:00Z',
      updated_at: '2026-11-24T12:00:00Z',
      roles: { id: `role-${roleCode}`, code: roleCode, name: roleCode },
    },
  };
}

test.describe('Etapas 6 y 7 — Cliente, Checkout, Pedidos, Reservas y Admin Mesas (E2E)', () => {
  test('Escenarios 1–18: Perfil, direcciones, checkout domicilio + pago simulado, confirmación, seguimiento, historial y bloqueo pedido ajeno', async ({
    page,
  }) => {
    const { session, profile } = buildUserSession('cliente', 'Valentina Gómez');
    const state = {
      profile: { ...profile },
      addresses: [],
      orders: [],
      orderItems: [],
      orderHistory: [],
      payments: [],
    };

    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/token')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
        return;
      }
      if (url.includes('/logout')) {
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
    });

    await page.route('**/rest/v1/profiles*', async (route) => {
      const method = route.request().method();
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      if (method === 'PATCH') {
        const body = route.request().postDataJSON();
        state.profile = { ...state.profile, ...body, updated_at: new Date().toISOString() };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isObj ? state.profile : [state.profile]),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isObj ? state.profile : [state.profile]),
      });
    });

    await page.route('**/rest/v1/customer_addresses*', async (route) => {
      const method = route.request().method();
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      if (method === 'POST') {
        const body = route.request().postDataJSON();
        const created = {
          id: `addr-${state.addresses.length + 1}`,
          ...body,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        state.addresses.push(created);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(isObj ? created : [created]),
        });
        return;
      }
      if (method === 'PATCH') {
        const body = route.request().postDataJSON();
        const url = new URL(route.request().url());
        const idEq = url.searchParams.get('id')?.replace('eq.', '');
        state.addresses = state.addresses.map((a) => {
          if (idEq && a.id === idEq) return { ...a, ...body };
          if (!idEq && body.is_default === false) return { ...a, is_default: false };
          return a;
        });
        const target = state.addresses.find((a) => a.id === idEq) || state.addresses[0];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isObj ? target : state.addresses),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.addresses) });
    });

    await page.route('**/rest/v1/restaurant_settings*', async (route) => {
      const cfg = {
        id: 1,
        restaurant_name: 'FORJA BRAVA',
        location: 'Bogotá',
        phone: '+57 300 000 0000',
        fixed_delivery_fee: 5000,
        reservation_duration_minutes: 90,
        reservation_cancel_cutoff_minutes: 60,
        allow_client_table_orders: false,
        is_provisional_config: false,
      };
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObj ? cfg : [cfg]) });
    });

    await page.route('**/rest/v1/products*', async (route) => {
      const prod = {
        id: 'prod-1',
        slug: 'forjada',
        name: 'La Forjada',
        price: 28900,
        image_url: 'assets/images/producto-forjada.png',
        is_available: true,
        is_addon: false,
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([prod]) });
    });

    await page.route('**/rest/v1/product_complements*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/rpc/save_customer_address', async (route) => {
      const body = route.request().postDataJSON();
      if (body.p_is_default) {
        state.addresses = state.addresses.map((a) => ({ ...a, is_default: false }));
      }
      if (body.p_address_id) {
        state.addresses = state.addresses.map((a) =>
          a.id === body.p_address_id
            ? {
                ...a,
                label: body.p_label,
                address: body.p_address,
                neighborhood: body.p_neighborhood,
                directions: body.p_directions,
                is_default: Boolean(body.p_is_default),
              }
            : a,
        );
        const updated = state.addresses.find((a) => a.id === body.p_address_id);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updated) });
        return;
      }
      const created = {
        id: `addr-${state.addresses.length + 1}`,
        user_id: profile.id,
        label: body.p_label,
        address: body.p_address,
        neighborhood: body.p_neighborhood,
        directions: body.p_directions,
        is_default: Boolean(body.p_is_default),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.addresses.push(created);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) });
    });

    await page.route('**/rest/v1/rpc/set_default_customer_address', async (route) => {
      const { p_address_id } = route.request().postDataJSON();
      state.addresses = state.addresses.map((a) => ({ ...a, is_default: a.id === p_address_id }));
      const target = state.addresses.find((a) => a.id === p_address_id);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(target) });
    });

    await page.route('**/rest/v1/rpc/create_order', async (route) => {
      const payload = route.request().postDataJSON();
      const order = {
        id: 'ord-e2e-1',
        order_number: 'FB-20261124-E2E001',
        customer_id: profile.id,
        modality: payload.p_modality,
        customer_name: state.profile.full_name,
        delivery_address: payload.p_delivery_address,
        delivery_neighborhood: payload.p_delivery_neighborhood,
        subtotal: 28900,
        delivery_fee: 5000,
        total: 33900,
        status: 'Pendiente',
        payment_status: payload.p_payment_method === 'Efectivo' ? 'Pendiente' : 'Confirmación simulada',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.orders = [order];
      state.orderItems = [
        {
          id: 'oi-1',
          order_id: order.id,
          product_id: 'prod-1',
          product_name_snapshot: 'La Forjada',
          unit_price_snapshot: 28900,
          quantity: 1,
          addons_snapshot: [],
          addons_total: 0,
          line_total: 28900,
        },
      ];
      state.orderHistory = [
        {
          id: 'oh-1',
          order_id: order.id,
          previous_status: null,
          new_status: 'Pendiente',
          reason: 'Creación de pedido',
          changed_at: order.created_at,
        },
      ];
      state.payments = [
        {
          id: 'pay-1',
          order_id: order.id,
          method: payload.p_payment_method,
          status: order.payment_status,
          amount: order.total,
          transaction_ref: 'DEMO-E2E123',
          is_simulated: true,
          disclaimer: 'Pago de simulación controlada.',
          created_at: order.created_at,
        },
      ];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(order) });
    });

    await page.route('**/rest/v1/orders*', async (route) => {
      const url = new URL(route.request().url());
      const idEq = url.searchParams.get('id')?.replace('eq.', '');
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      const rows = idEq ? state.orders.filter((o) => o.id === idEq) : state.orders;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isObj ? rows[0] || null : rows),
      });
    });

    await page.route('**/rest/v1/order_items*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.orderItems) });
    });
    await page.route('**/rest/v1/order_status_history*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.orderHistory) });
    });
    await page.route('**/rest/v1/payments*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.payments) });
    });

    // Sembrar 1 producto en carrito
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'forja-brava-cart-v1',
        JSON.stringify({
          version: 1,
          items: [
            {
              lineKey: 'prod-1::',
              productId: 'prod-1',
              slug: 'forjada',
              name: 'La Forjada',
              imageUrl: 'assets/images/producto-forjada.png',
              categoryName: 'Hamburguesas',
              unitPrice: 28900,
              addons: [],
              quantity: 1,
              unavailable: false,
              unavailableReason: '',
              priceChanged: false,
              previousUnitPrice: null,
            },
          ],
        }),
      );
    });

    // 1. Login cliente
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('cliente@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/cliente$/);

    // 2 y 3. Perfil
    await page.goto('/cliente/perfil');
    await page.getByLabel(/nombre completo/i).fill('Valentina Gómez Ruiz');
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await expect(page.getByRole('status')).toContainText('actualizado correctamente');

    // 4 y 5. Direcciones
    await page.goto('/cliente/direcciones');
    await page.getByRole('button', { name: /nueva dirección/i }).click();
    await page.getByLabel(/nombre o etiqueta/i).fill('Casa');
    await page.getByLabel(/^dirección/i).fill('Calle 85 # 15-40');
    await page.getByLabel(/barrio/i).fill('Chapinero');
    await page.getByRole('button', { name: /guardar dirección/i }).click();
    await expect(page.getByText('Calle 85 # 15-40')).toBeVisible();

    // 7–13. Checkout, domicilio, pago simulado y confirmación
    await page.goto('/checkout');
    await expect(page.getByText('Casa')).toBeVisible();
    await page.getByLabel(/nequi/i).check();
    await page.getByLabel(/confirmo que revisé/i).check();
    await page.getByRole('button', { name: /confirmar pedido/i }).click();
    await expect(page.getByText('FB-20261124-E2E001').first()).toBeVisible();

    // 14, 15 y 16. Pedidos, Seguimiento e Historial
    await page.goto('/cliente/pedidos');
    await expect(page.getByText('FB-20261124-E2E001')).toBeVisible();

    await page.goto('/cliente/seguimiento/ord-e2e-1');
    await expect(page.getByText('Creación de pedido')).toBeVisible();

    await page.goto('/cliente/historial');
    await expect(page.getByText('FB-20261124-E2E001')).toBeVisible();

    // 18. Intentar acceder a un pedido ajeno (RLS devuelve vacío -> vista denegada)
    await page.goto('/cliente/pedidos/pedido-ajeno-999');
    await expect(page.getByText(/no tienes acceso a este pedido/i)).toBeVisible();

    // 35. Cliente intenta entrar a /admin/mesas -> 403 Acceso denegado
    await page.goto('/admin/mesas');
    await expect(page).toHaveURL(/\/acceso-denegado$/);
  });

  test('Escenarios 19–34: Reservas del cliente, concurrencia y administración de mesas/horarios/reservas', async ({
    page,
  }) => {
    const clientAuth = buildUserSession('cliente', 'Valentina Gómez');
    const adminAuth = buildUserSession('administrador', 'Camila Herrera');
    let activeAuth = clientAuth;
    let createCallCount = 0;

    const state = {
      tables: [
        { id: 'tbl-1', code: 'M-01', zone: 'Salón', capacity: 4, status: 'disponible', is_active: true },
        { id: 'tbl-2', code: 'M-02', zone: 'Terraza', capacity: 2, status: 'disponible', is_active: true },
      ],
      reservations: [],
      settings: {
        id: 1,
        restaurant_name: 'FORJA BRAVA',
        location: 'Bogotá, Colombia',
        phone: '+57 300 000 0000',
        fixed_delivery_fee: 5000,
        reservation_duration_minutes: 90,
        reservation_cancel_cutoff_minutes: 60,
        allow_client_table_orders: false,
        is_provisional_config: false,
        business_hours: {
          monday: { open: '12:00', close: '22:00', closed: false },
          tuesday: { open: '12:00', close: '22:00', closed: false },
          wednesday: { open: '12:00', close: '22:00', closed: false },
          thursday: { open: '12:00', close: '22:00', closed: false },
          friday: { open: '12:00', close: '23:00', closed: false },
          saturday: { open: '12:00', close: '23:00', closed: false },
          sunday: { open: '12:00', close: '22:00', closed: false },
        },
      },
    };

    await page.route('**/auth/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/token')) {
        const body = route.request().postDataJSON();
        activeAuth = body.email.startsWith('admin') ? adminAuth : clientAuth;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activeAuth.session) });
        return;
      }
      if (url.includes('/logout')) {
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(activeAuth.session.user) });
    });

    await page.route('**/rest/v1/profiles*', async (route) => {
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isObj ? activeAuth.profile : [activeAuth.profile]),
      });
    });

    await page.route('**/rest/v1/restaurant_settings*', async (route) => {
      if (route.request().method() === 'PATCH') {
        state.settings = { ...state.settings, ...route.request().postDataJSON(), updated_at: new Date().toISOString() };
      }
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isObj ? state.settings : [state.settings]),
      });
    });

    await page.route('**/rest/v1/rpc/admin_save_restaurant_table', async (route) => {
      const body = route.request().postDataJSON();
      if (body.p_table_id) {
        state.tables = state.tables.map((t) =>
          t.id === body.p_table_id
            ? {
                ...t,
                code: body.p_code,
                zone: body.p_zone,
                capacity: body.p_capacity,
                is_active: Boolean(body.p_is_active),
                status: body.p_is_active ? 'disponible' : 'fuera_de_servicio',
              }
            : t,
        );
        const target = state.tables.find((t) => t.id === body.p_table_id);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(target) });
        return;
      }
      const created = {
        id: `tbl-${state.tables.length + 1}`,
        code: body.p_code,
        zone: body.p_zone,
        capacity: body.p_capacity,
        is_active: Boolean(body.p_is_active),
        status: body.p_is_active ? 'disponible' : 'fuera_de_servicio',
      };
      state.tables.push(created);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) });
    });

    await page.route('**/rest/v1/restaurant_tables*', async (route) => {
      const method = route.request().method();
      const isObj = (route.request().headers()['accept'] || '').includes('object+json');
      if (method === 'POST') {
        const created = { id: `tbl-${state.tables.length + 1}`, ...route.request().postDataJSON() };
        state.tables.push(created);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(isObj ? created : [created]) });
        return;
      }
      if (method === 'PATCH') {
        const idEq = new URL(route.request().url()).searchParams.get('id')?.replace('eq.', '');
        const body = route.request().postDataJSON();
        state.tables = state.tables.map((t) => (t.id === idEq ? { ...t, ...body } : t));
        const target = state.tables.find((t) => t.id === idEq);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(isObj ? target : [target]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.tables) });
    });

    await page.route('**/rest/v1/rpc/get_available_reservation_slots', async (route) => {
      const { p_party_size } = route.request().postDataJSON();
      const slots = p_party_size > 4 ? [] : [{ slot_time: '19:00:00', available_tables: 1 }];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(slots) });
    });

    await page.route('**/rest/v1/rpc/create_reservation', async (route) => {
      createCallCount += 1;
      if (createCallCount > 1) {
        // Simular conflicto de concurrencia en segunda reserva simultánea
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'excl_reservations_no_overlap' }),
        });
        return;
      }
      const res = {
        id: 'res-e2e-1',
        reservation_code: 'RS-20261201-E2E01',
        customer_id: clientAuth.profile.id,
        table_id: 'tbl-1',
        customer_name: clientAuth.profile.full_name,
        customer_phone: clientAuth.profile.phone,
        party_size: 4,
        reservation_date: '2026-12-01',
        start_at: '2026-12-02T00:00:00Z',
        end_at: '2026-12-02T01:30:00Z',
        duration_minutes: 90,
        status: 'Confirmada',
        restaurant_tables: state.tables[0],
      };
      state.reservations = [res];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
    });

    await page.route('**/rest/v1/rpc/cancel_reservation', async (route) => {
      state.reservations = state.reservations.map((r) => ({ ...r, status: 'Cancelada' }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.reservations[0]) });
    });

    await page.route('**/rest/v1/rpc/admin_manage_reservation', async (route) => {
      const { p_new_table_id } = route.request().postDataJSON();
      if (p_new_table_id === 'tbl-2') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'INSUFFICIENT_CAPACITY' }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.reservations[0]) });
    });

    await page.route('**/rest/v1/reservations*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.reservations) });
    });

    // Cliente crea reserva y verifica prevención de conflicto simultáneo
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('cliente@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();

    await page.goto('/cliente/reservas');
    await page.getByRole('button', { name: '19:00' }).click();
    await page.getByRole('button', { name: /confirmar reserva/i }).click();
    await expect(page.getByText('RS-20261201-E2E01').first()).toBeVisible();

    // Segunda reserva simultánea -> rechazada por exclusión de solapamiento
    await page.getByRole('button', { name: '19:00' }).click();
    await page.getByRole('button', { name: /confirmar reserva/i }).click();
    await expect(page.getByRole('alert')).toContainText('otra reserva en ese mismo horario');

    // Superar capacidad máxima -> sin horarios disponibles
    await page.getByLabel(/número de personas/i).fill('12');
    await expect(page.getByText(/no hay franjas disponibles/i)).toBeVisible();

    // Cerrar sesión cliente e iniciar como Administrador
    await page.getByRole('button', { name: /cerrar sesión/i }).click();
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@forjabrava.test');
    await page.locator('#login-password').fill('Brava2026');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Admin crea nueva mesa
    await page.goto('/admin/mesas');
    await page.getByRole('button', { name: /crear mesa/i }).click();
    await page.getByLabel(/código o número de mesa/i).fill('M-03');
    await page.getByLabel(/capacidad máxima/i).fill('6');
    await page.getByRole('dialog').getByRole('button', { name: /crear mesa/i }).click();
    await expect(page.getByRole('heading', { name: 'M-03' })).toBeVisible();

    // Admin configura horarios y duración
    await page.goto('/admin/configuracion');
    await page.getByLabel(/duración de reservas/i).fill('120');
    await page.getByRole('button', { name: /guardar configuración/i }).click();
    await expect(page.getByRole('status')).toContainText('Configuración operativa guardada');

    // Admin intenta reasignar reserva de 4 personas a mesa de 2 personas -> rechazado por capacidad
    await page.goto('/admin/reservas');
    await page.getByRole('button', { name: /^mesa$/i }).click();
    await page.getByLabel(/seleccionar mesa activa/i).selectOption('tbl-2');
    await page.getByRole('button', { name: /guardar asignación/i }).click();
    await expect(page.getByRole('alert').first()).toContainText('capacidad');
  });
});
