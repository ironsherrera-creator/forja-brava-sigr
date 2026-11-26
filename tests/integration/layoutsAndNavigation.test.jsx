import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthApi = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}));

const mockAuthService = vi.hoisted(() => ({
  fetchAuthenticatedProfile: vi.fn(),
  registerClientAccount: vi.fn(),
  requestPasswordResetEmail: vi.fn(),
  signInWithEmailPassword: vi.fn(),
  signOutCurrentUser: vi.fn(),
  updateAuthenticatedPassword: vi.fn(),
  updateOwnBasicProfile: vi.fn(),
  verifyRecoverySessionFromUrl: vi.fn(),
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
  supabase: { auth: mockAuthApi },
  getSupabaseClient: () => ({ auth: mockAuthApi }),
  getAuthRedirectUrl: (path = '/') => `http://localhost:5173${path}`,
}));

vi.mock('../../src/services/authService', () => mockAuthService);
vi.mock('../../src/services/catalogService', () => ({
  fetchRestaurantSettings: vi.fn().mockResolvedValue({ data: null, error: null }),
  fetchLandingData: vi.fn().mockResolvedValue({
    settings: null,
    categories: [],
    products: [],
    featuredProduct: null,
    highlightedProducts: [],
    error: null,
  }),
  formatBusinessHoursList: () => [],
}));
vi.mock('../../src/services/reservationService', () => ({
  fetchAvailableReservationSlots: vi.fn().mockResolvedValue({ data: [], error: null }),
  fetchCustomerReservations: vi.fn().mockResolvedValue({ data: [], error: null }),
  createCustomerReservation: vi.fn(),
  cancelCustomerReservation: vi.fn(),
}));

import { AuthProvider } from '../../src/context/AuthContext';
import { CartProvider } from '../../src/context/CartContext';
import { AppRouter } from '../../src/routes/AppRouter';

function renderAppAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CartProvider>
          <AppRouter />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function mockRoleSession(role, fullName) {
  const session = {
    access_token: `token-${role}`,
    user: { id: `${role}-id-1`, email: `${role}@forjabrava.test` },
  };
  mockAuthApi.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuthService.fetchAuthenticatedProfile.mockResolvedValue({
    profile: {
      id: `${role}-id-1`,
      full_name: fullName,
      email: `${role}@forjabrava.test`,
      phone: '+57 300 000 0000',
      is_active: true,
    },
    role,
    error: null,
  });
}

describe('Integración — Layouts, navegación por rol, breadcrumbs y menú de usuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthApi.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockAuthApi.signOut.mockResolvedValue({ error: null });
    mockAuthService.signOutCurrentUser.mockResolvedValue({ error: null });
  });

  it('renderiza PublicLayout con navegación principal, eslogan y botón móvil', async () => {
    mockAuthApi.getSession.mockResolvedValue({ data: { session: null }, error: null });
    renderAppAt('/');

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /abrir menú de navegación/i })).toBeInTheDocument();
    expect(screen.getAllByText(/el sabor que se hace/i).length).toBeGreaterThan(0);
  });

  it('renderiza ClientLayout con las 7 secciones del cliente, breadcrumbs y menú de usuario', async () => {
    const user = userEvent.setup();
    mockRoleSession('cliente', 'Valentina Gómez');
    renderAppAt('/cliente');

    await waitFor(() => {
      expect(screen.getByRole('complementary', { name: /navegación del cliente/i })).toBeInTheDocument();
    });

    for (const label of [
      'Inicio',
      'Realizar pedido',
      'Mis pedidos',
      'Seguimiento',
      'Mis reservas',
      'Mis direcciones',
      'Mi perfil',
    ]) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }

    // Navegar a Mis reservas y verificar actualización de breadcrumbs
    await user.click(screen.getAllByRole('link', { name: 'Mis reservas' })[0]);
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /ruta de navegación/i })).toHaveTextContent(
        'Reservas',
      );
    });

    // Abrir menú de usuario y confirmar opciones
    await user.click(screen.getByRole('button', { name: /valentina gómez/i }));
    expect(screen.getByRole('menu', { name: /menú de usuario/i })).toBeInTheDocument();
  });

  it('renderiza WaiterLayout enfocado en salón y sin accesos administrativos financieros', async () => {
    mockRoleSession('mesero', 'Mateo Rojas');
    renderAppAt('/mesero');

    await waitFor(() => {
      expect(
        screen.getByRole('complementary', { name: /navegación operativa del mesero/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getAllByRole('link', { name: 'Mesas' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /tomar pedido/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Caja' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Auditoría' })).not.toBeInTheDocument();
  });

  it('renderiza AdminLayout con navegación agrupada, colapso de sidebar y notificaciones', async () => {
    const user = userEvent.setup();
    mockRoleSession('administrador', 'Camila Herrera');
    renderAppAt('/admin');

    await waitFor(() => {
      expect(
        screen.getByRole('complementary', { name: /navegación administrativa/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Operación')).toBeInTheDocument();
    expect(screen.getByText('Catálogo')).toBeInTheDocument();
    expect(screen.getByText('Finanzas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notificaciones/i })).toBeInTheDocument();

    // Contraer y expandir sidebar en desktop
    await user.click(screen.getByRole('button', { name: /contraer menú lateral/i }));
    expect(screen.getByRole('button', { name: /expandir menú lateral/i })).toBeInTheDocument();
  });
});
