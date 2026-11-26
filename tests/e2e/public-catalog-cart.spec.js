import { expect, test } from '@playwright/test';

const MOCK_CATEGORIES = [
  {
    id: 'cat-1',
    slug: 'hamburguesas',
    name: 'Hamburguesas',
    description: 'Hamburguesas artesanales a la parrilla.',
    image_url: null,
    display_order: 1,
    is_active: true,
  },
  {
    id: 'cat-2',
    slug: 'perros',
    name: 'Perros',
    description: 'Perros calientes con salsas de la casa.',
    image_url: null,
    display_order: 2,
    is_active: true,
  },
];

const MOCK_PRODUCTS = [
  {
    id: 'prod-1',
    category_id: 'cat-1',
    slug: 'forjada',
    name: 'La Forjada',
    description: 'Carne a la parrilla, queso, tocineta y salsa de la casa.',
    ingredients: 'Carne 100% res, queso cheddar, tocineta ahumada',
    price: 28900,
    image_url: 'assets/images/producto-forjada.png',
    tag: 'FAVORITA',
    is_addon: false,
    is_available: true,
    created_at: '2026-11-24T00:00:00Z',
    categories: MOCK_CATEGORIES[0],
  },
  {
    id: 'prod-2',
    category_id: 'cat-2',
    slug: 'perro-tradicional',
    name: 'Perro Tradicional',
    description: 'Salchicha, ripio, salsas de la casa y queso.',
    ingredients: 'Salchicha artesanal, ripio, queso',
    price: 16900,
    image_url: 'assets/images/producto-perro-tradicional.png',
    tag: null,
    is_addon: false,
    is_available: true,
    created_at: '2026-11-24T00:01:00Z',
    categories: MOCK_CATEGORIES[1],
  },
  {
    id: 'prod-addon-1',
    category_id: 'cat-1',
    slug: 'adiciones',
    name: 'Adiciones & Acompañamientos',
    description: 'Papas, queso extra, tocineta y salsas de la casa.',
    ingredients: null,
    price: 8900,
    image_url: 'assets/images/producto-adiciones.png',
    tag: 'PARA ACOMPAÑAR',
    is_addon: true,
    is_available: true,
    created_at: '2026-11-24T00:02:00Z',
    categories: MOCK_CATEGORIES[0],
  },
];

const MOCK_COMPLEMENTS = [
  { product_id: 'prod-1', complement_id: 'prod-addon-1' },
];

const MOCK_SETTINGS = {
  id: 1,
  restaurant_name: 'FORJA BRAVA',
  location: 'Bogotá, Colombia',
  phone: '+57 300 000 0000',
  whatsapp_number: '',
  instagram_url: '',
  facebook_url: '',
  business_hours: {
    monday: { open: '12:00', close: '22:00', closed: false },
    sunday: { open: '12:00', close: '22:00', closed: false },
  },
  fixed_delivery_fee: 0,
  reservation_duration_minutes: 90,
  allow_client_table_orders: false,
  is_provisional_config: true,
  featured_product_id: 'prod-1',
};

async function installCatalogMocks(page, { unavailableIds = [] } = {}) {
  await page.route('**/rest/v1/restaurant_settings*', async (route) => {
    const accept = route.request().headers()['accept'] || '';
    const isObj = accept.includes('application/vnd.pgrst.object+json');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isObj ? MOCK_SETTINGS : [MOCK_SETTINGS]),
    });
  });

  await page.route('**/rest/v1/categories*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CATEGORIES),
    });
  });

  await page.route('**/rest/v1/product_complements*', async (route) => {
    const url = new URL(route.request().url());
    const eqProd = url.searchParams.get('product_id');
    let rows = MOCK_COMPLEMENTS;
    if (eqProd && eqProd.startsWith('eq.')) {
      const targetId = eqProd.slice(3);
      rows = rows.filter((r) => r.product_id === targetId);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    });
  });

  await page.route('**/rest/v1/products*', async (route) => {
    const url = new URL(route.request().url());
    const accept = route.request().headers()['accept'] || '';
    const isObj = accept.includes('application/vnd.pgrst.object+json');

    let rows = MOCK_PRODUCTS.filter((p) => !unavailableIds.includes(p.id));

    const slugParam = url.searchParams.get('slug');
    if (slugParam && slugParam.startsWith('eq.')) {
      const targetSlug = slugParam.slice(3);
      rows = rows.filter((p) => p.slug === targetSlug);
    }

    const isAddonParam = url.searchParams.get('is_addon');
    if (isAddonParam === 'eq.false') {
      rows = rows.filter((p) => !p.is_addon);
    } else if (isAddonParam === 'eq.true') {
      rows = rows.filter((p) => p.is_addon);
    }

    const nameParam = url.searchParams.get('name');
    if (nameParam && nameParam.startsWith('ilike.')) {
      const term = nameParam.replace(/^ilike\./, '').replace(/%/g, '').toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(term));
    }

    const idParam = url.searchParams.get('id');
    if (idParam && idParam.startsWith('in.(')) {
      const ids = idParam
        .slice(4, -1)
        .split(',')
        .map((s) => s.replace(/^"|"$/g, ''));
      rows = rows.filter((p) => ids.includes(p.id));
    }

    if (isObj) {
      await route.fulfill({
        status: rows[0] ? 200 : 406,
        contentType: 'application/json',
        body: JSON.stringify(rows[0] || { message: 'Not found' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    });
  });
}

test.describe('Etapa 5 — Sitio Público, Catálogo Dinámico, Complementos y Carrito (E2E)', () => {
  test('1–15 y 18. Flujo completo sin autenticación: landing, menú, categorías, búsqueda, detalle, complementos, drawer, carrito, persistencia y eliminación', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await installCatalogMocks(page);

    // 1. Landing con datos reales de Supabase
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /el sabor que/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /explorar hamburguesas/i })).toBeVisible();

    // 2 y 3. Abrir /menu y consultar categorías
    await page.getByRole('link', { name: /explorar menú/i }).click();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole('link', { name: 'Hamburguesas' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Perros' }).first()).toBeVisible();

    // 4. Buscar producto
    const search = page.getByLabel(/buscar productos por nombre/i);
    await search.fill('Perro');
    await expect(page.getByText('Perro Tradicional')).toBeVisible();
    await page.getByRole('button', { name: /limpiar búsqueda/i }).click();

    // 5. Filtrar por categoría
    await page
      .getByRole('navigation', { name: /categorías del menú/i })
      .getByRole('link', { name: 'Hamburguesas' })
      .click();
    await expect(page).toHaveURL(/\/menu\/hamburguesas$/);
    await expect(page.getByRole('heading', { name: 'Hamburguesas' })).toBeVisible();

    // 6. Abrir detalle de producto
    await page.getByRole('link', { name: 'La Forjada' }).first().click();
    await expect(page).toHaveURL(/\/producto\/forjada$/);
    await expect(page.getByRole('heading', { name: 'La Forjada' })).toBeVisible();

    // 7, 8 y 9. Seleccionar complemento, cambiar cantidad a 2 y agregar al carrito
    await page.getByLabel(/adiciones & acompañamientos/i).check();
    await page.getByRole('button', { name: /aumentar cantidad/i }).click();
    await expect(page.getByTestId('product-quantity')).toHaveText('2');
    await page.getByRole('button', { name: /agregar al carrito/i }).click();

    // 10 y 11. Contador actualizado a 2 y Drawer abierto
    await expect(page.getByTestId('header-cart-count')).toHaveText('2');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    // 15. Agregar el mismo producto SIN complementos -> debe crear una segunda línea distinta
    await page.getByLabel(/adiciones & acompañamientos/i).uncheck();
    await page.getByRole('button', { name: /disminuir cantidad/i }).click();
    await page.getByRole('button', { name: /agregar al carrito/i }).click();
    await expect(page.getByTestId('header-cart-count')).toHaveText('3');

    // 12. Ir a la vista completa /carrito desde el drawer
    await page.getByRole('link', { name: /ver carrito completo/i }).click();
    await expect(page).toHaveURL(/\/carrito$/);
    await expect(page.getByText(/3 unidades/i)).toBeVisible();
    await expect(page.getByText(/\+ Adiciones & Acompañamientos/i)).toBeVisible();

    // 14. Persistencia tras recarga de página
    await page.reload();
    await expect(page.getByTestId('header-cart-count')).toHaveText('3');
    await expect(page.getByText(/3 unidades/i)).toBeVisible();

    // 13. Eliminar una línea del carrito
    await page.getByRole('button', { name: /eliminar la forjada/i }).first().click();
    await expect(page.getByTestId('header-cart-count')).toHaveText('1');

    expect(errors).toEqual([]);
  });

  test('16 y 17. Producto no disponible en carrito persistido + validación responsive móvil (360px/390px)', async ({
    page,
  }) => {
    // Sembrar carrito persistido con prod-2 y simular que prod-2 dejó de estar disponible en Supabase
    await installCatalogMocks(page, { unavailableIds: ['prod-2'] });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'forja-brava-cart-v1',
        JSON.stringify({
          version: 1,
          items: [
            {
              lineKey: 'prod-2::',
              productId: 'prod-2',
              slug: 'perro-tradicional',
              name: 'Perro Tradicional',
              imageUrl: 'assets/images/producto-perro-tradicional.png',
              categoryName: 'Perros',
              unitPrice: 16900,
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

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/carrito');

    // Debe informar que el producto dejó de estar disponible y bloquear continuación
    await expect(page.getByText(/no disponible/i).first()).toBeVisible();
    await expect(
      page.getByText(/retira los productos marcados como no disponibles/i),
    ).toBeVisible();

    // Comprobar cero desbordamiento horizontal en 360px
    await page.setViewportSize({ width: 360, height: 780 });
    const overflowCart = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    expect(overflowCart).toBe(false);

    await page.goto('/menu');
    const overflowMenu = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    expect(overflowMenu).toBe(false);
  });
});
