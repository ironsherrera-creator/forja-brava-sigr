import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCategoryService = vi.hoisted(() => ({
  fetchActiveCategories: vi.fn(),
}));

const mockProductService = vi.hoisted(() => ({
  fetchPublicProducts: vi.fn(),
  fetchProductBySlug: vi.fn(),
  fetchProductsByIds: vi.fn(),
}));

const mockComplementService = vi.hoisted(() => ({
  fetchComplementsForProduct: vi.fn(),
  fetchComplementsMapForProducts: vi.fn(),
}));

const mockCatalogService = vi.hoisted(() => ({
  fetchRestaurantSettings: vi.fn(),
  fetchLandingData: vi.fn(),
  formatBusinessHoursList: () => [],
}));

vi.mock('../../src/lib/env', () => ({
  env: {
    VITE_APP_NAME: 'FORJA BRAVA — SIGR',
    VITE_APP_TIMEZONE: 'America/Bogota',
    VITE_SUPABASE_URL: 'https://mock-project.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'mock-public-anon-key',
  },
  isSupabaseConfigured: true,
  supabaseConfigErrors: [],
  assertSupabaseConfigured: vi.fn(),
  validateRuntimeEnv: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  getSupabaseClient: vi.fn(),
  getAuthRedirectUrl: (path = '/') => `http://localhost:5173${path}`,
}));

vi.mock('../../src/services/categoryService', () => mockCategoryService);
vi.mock('../../src/services/productService', () => mockProductService);
vi.mock('../../src/services/complementService', () => mockComplementService);
vi.mock('../../src/services/catalogService', () => mockCatalogService);

import { AuthProvider } from '../../src/context/AuthContext';
import { CartProvider } from '../../src/context/CartContext';
import { AppRouter } from '../../src/routes/AppRouter';

const SAMPLE_CATEGORIES = [
  { id: 'c1', slug: 'hamburguesas', name: 'Hamburguesas', description: 'Al fuego', display_order: 1, is_active: true },
  { id: 'c2', slug: 'perros', name: 'Perros', description: 'Clásicos', display_order: 2, is_active: true },
];

const SAMPLE_PRODUCTS = [
  {
    id: 'p1',
    category_id: 'c1',
    slug: 'forjada',
    name: 'La Forjada',
    description: 'Carne a la parrilla y queso fundido.',
    ingredients: 'Carne, queso, tocineta',
    price: 28900,
    image_url: 'assets/images/producto-forjada.png',
    tag: 'FAVORITA',
    is_addon: false,
    is_available: true,
    category: SAMPLE_CATEGORIES[0],
  },
  {
    id: 'p2',
    category_id: 'c2',
    slug: 'perro-tradicional',
    name: 'Perro Tradicional',
    description: 'Salchicha, ripio y queso.',
    price: 16900,
    image_url: 'assets/images/producto-perro-tradicional.png',
    tag: null,
    is_addon: false,
    is_available: true,
    category: SAMPLE_CATEGORIES[1],
  },
];

function renderApp(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <CartProvider>
          <AppRouter />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Integración — Catálogo público, filtros, detalle de producto y complementos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockCatalogService.fetchRestaurantSettings.mockResolvedValue({
      data: {
        restaurant_name: 'FORJA BRAVA',
        location: 'Bogotá',
        phone: '+57 300 000 0000',
        allow_client_table_orders: false,
      },
      error: null,
    });
    mockCategoryService.fetchActiveCategories.mockResolvedValue({
      data: SAMPLE_CATEGORIES,
      error: null,
    });
    mockProductService.fetchPublicProducts.mockResolvedValue({
      data: SAMPLE_PRODUCTS,
      error: null,
    });
    mockProductService.fetchProductsByIds.mockResolvedValue({
      data: SAMPLE_PRODUCTS,
      error: null,
    });
    mockComplementService.fetchComplementsMapForProducts.mockResolvedValue({
      data: new Map([
        ['p1', new Map([['ad1', { id: 'ad1', name: 'Adiciones', price: 8900, is_available: true }]])],
      ]),
      error: null,
    });
  });

  it('carga categorías y productos en /menu, permite buscar y ordenar', async () => {
    const user = userEvent.setup();
    renderApp('/menu');

    await waitFor(() => {
      expect(screen.getByText('La Forjada')).toBeInTheDocument();
      expect(screen.getByText('Perro Tradicional')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/buscar productos por nombre/i);
    await user.type(searchInput, 'Forjada');

    await waitFor(() => {
      expect(mockProductService.fetchPublicProducts).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Forjada' }),
      );
    });

    const sortSelect = screen.getByLabelText(/ordenar productos/i);
    await user.selectOptions(sortSelect, 'price_asc');

    await waitFor(() => {
      expect(mockProductService.fetchPublicProducts).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'price_asc' }),
      );
    });
  });

  it('carga detalle de producto, selecciona complemento, calcula total y agrega al carrito', async () => {
    const user = userEvent.setup();
    mockProductService.fetchProductBySlug.mockResolvedValue({
      data: SAMPLE_PRODUCTS[0],
      error: null,
    });
    mockComplementService.fetchComplementsForProduct.mockResolvedValue({
      data: [
        {
          id: 'ad1',
          slug: 'adiciones',
          name: 'Adiciones & Acompañamientos',
          description: 'Papas y salsas',
          price: 8900,
          is_addon: true,
          is_available: true,
        },
      ],
      error: null,
    });

    renderApp('/producto/forjada');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'La Forjada' })).toBeInTheDocument();
    });

    // Seleccionar complemento y subir cantidad a 2
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /aumentar cantidad/i }));

    expect(screen.getByTestId('product-quantity')).toHaveTextContent('2');

    // Agregar al carrito -> debe abrir CartDrawer y actualizar contador a 2
    await user.click(screen.getByRole('button', { name: /agregar al carrito/i }));

    await waitFor(() => {
      expect(screen.getByTestId('header-cart-count')).toHaveTextContent('2');
    });
  });

  it('muestra estado de error con botón Reintentar cuando falla Supabase', async () => {
    mockProductService.fetchPublicProducts.mockResolvedValue({
      data: [],
      error: { code: 'NETWORK', message: 'No fue posible cargar los productos del menú.' },
    });

    renderApp('/menu');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no fue posible cargar/i);
    });
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
