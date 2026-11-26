import { render, screen, waitFor, within } from '@testing-library/react';
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

const mockAddressService = vi.hoisted(() => ({
  fetchUserAddresses: vi.fn(),
  createUserAddress: vi.fn(),
  updateUserAddress: vi.fn(),
  setDefaultUserAddress: vi.fn(),
  deleteUserAddress: vi.fn(),
}));

const mockOrderService = vi.hoisted(() => ({
  createTransactionalOrder: vi.fn(),
  fetchCustomerOrders: vi.fn(),
  fetchCustomerOrderDetail: vi.fn(),
}));

const mockReservationService = vi.hoisted(() => ({
  fetchAvailableReservationSlots: vi.fn(),
  createCustomerReservation: vi.fn(),
  cancelCustomerReservation: vi.fn(),
  fetchCustomerReservations: vi.fn(),
  fetchAdminReservations: vi.fn(),
  adminUpdateReservation: vi.fn(),
}));

const mockTableService = vi.hoisted(() => ({
  fetchRestaurantTables: vi.fn(),
  createRestaurantTable: vi.fn(),
  updateRestaurantTable: vi.fn(),
  toggleRestaurantTableActive: vi.fn(),
}));

const mockCatalogService = vi.hoisted(() => ({
  fetchRestaurantSettings: vi.fn(),
  fetchLandingData: vi.fn(),
  formatBusinessHoursList: () => [],
}));

const mockCartService = vi.hoisted(() => ({
  loadPersistedCart: vi.fn(),
  savePersistedCart: vi.fn(),
  clearPersistedCart: vi.fn(),
  syncCartWithSupabase: vi.fn(),
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
  getAuthRedirectUrl: (p = '/') => `http://localhost:5173${p}`,
}));

vi.mock('../../src/services/authService', () => mockAuthService);
vi.mock('../../src/services/addressService', () => mockAddressService);
vi.mock('../../src/services/orderService', () => mockOrderService);
vi.mock('../../src/services/reservationService', () => mockReservationService);
vi.mock('../../src/services/tableService', () => mockTableService);
vi.mock('../../src/services/catalogService', () => mockCatalogService);
vi.mock('../../src/services/cartService', () => mockCartService);

import { AuthProvider } from '../../src/context/AuthContext';
import { CartProvider } from '../../src/context/CartContext';
import { AppRouter } from '../../src/routes/AppRouter';

function mockRole(role, fullName) {
  const session = {
    access_token: `tok-${role}`,
    user: { id: `${role}-1`, email: `${role}@forjabrava.test` },
  };
  mockAuthApi.getSession.mockResolvedValue({ data: { session }, error: null });
  mockAuthService.fetchAuthenticatedProfile.mockResolvedValue({
    profile: {
      id: `${role}-1`,
      full_name: fullName,
      email: `${role}@forjabrava.test`,
      phone: '+57 300 000 0000',
      is_active: true,
    },
    role,
    error: null,
  });
}

function renderAt(path) {
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

describe('Integración — Etapas 6 y 7 (Direcciones, Checkout, Reservas, Mesas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthApi.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockCatalogService.fetchRestaurantSettings.mockResolvedValue({
      data: {
        id: 1,
        restaurant_name: 'FORJA BRAVA',
        location: 'Bogotá',
        phone: '+57 300 000 0000',
        fixed_delivery_fee: 5000,
        reservation_duration_minutes: 90,
        reservation_cancel_cutoff_minutes: 60,
        allow_client_table_orders: false,
        is_provisional_config: false,
      },
      error: null,
    });
    mockCartService.loadPersistedCart.mockReturnValue([]);
    mockCartService.syncCartWithSupabase.mockResolvedValue({
      items: [],
      priceChangesCount: 0,
      unavailableDetected: 0,
      error: null,
    });
  });

  it('permite completar Checkout a domicilio con dirección guardada y muestra confirmación transaccional', async () => {
    const user = userEvent.setup();
    mockRole('cliente', 'Valentina Gómez');

    const cartItems = [
      {
        lineKey: 'p1::',
        productId: 'p1',
        slug: 'forjada',
        name: 'La Forjada',
        imageUrl: '',
        categoryName: 'Hamburguesas',
        unitPrice: 28900,
        addons: [],
        quantity: 2,
        unavailable: false,
        unavailableReason: '',
        priceChanged: false,
        previousUnitPrice: null,
      },
    ];
    mockCartService.loadPersistedCart.mockReturnValue(cartItems);
    mockCartService.syncCartWithSupabase.mockResolvedValue({
      items: cartItems,
      priceChangesCount: 0,
      unavailableDetected: 0,
      error: null,
    });
    mockAddressService.fetchUserAddresses.mockResolvedValue({
      data: [
        {
          id: 'addr-1',
          label: 'Casa',
          address: 'Calle 85 # 15-40',
          neighborhood: 'Chapinero',
          directions: 'Apto 302',
          is_default: true,
        },
      ],
      error: null,
    });
    mockOrderService.createTransactionalOrder.mockResolvedValue({
      data: {
        id: 'ord-1',
        order_number: 'FB-20261124-ABC123',
        modality: 'domicilio',
        status: 'Pendiente',
        payment_status: 'Pendiente',
        total: 62800,
      },
      error: null,
    });

    renderAt('/checkout');

    await waitFor(() => {
      expect(screen.getByText('Casa')).toBeInTheDocument();
    });

    // Verificar D-07: En mesa está deshabilitado
    expect(screen.getByLabelText(/en mesa/i)).toBeDisabled();

    await user.click(screen.getByLabelText(/confirmo que revisé/i));
    await user.click(screen.getByRole('button', { name: /confirmar pedido/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/FB-20261124-ABC123/).length).toBeGreaterThan(0);
    });
    expect(mockOrderService.createTransactionalOrder).toHaveBeenCalledTimes(1);
  });

  it('permite consultar disponibilidad y crear reserva en /cliente/reservas', async () => {
    const user = userEvent.setup();
    mockRole('cliente', 'Valentina Gómez');
    mockReservationService.fetchCustomerReservations.mockResolvedValue({
      data: [],
      error: null,
    });
    mockReservationService.fetchAvailableReservationSlots.mockResolvedValue({
      data: [{ slot_time: '19:00:00', available_tables: 2 }],
      error: null,
    });
    mockReservationService.createCustomerReservation.mockResolvedValue({
      data: { id: 'res-1', reservation_code: 'RS-20261201-XYZ999' },
      error: null,
    });

    renderAt('/cliente/reservas');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '19:00' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '19:00' }));
    await user.click(screen.getByRole('button', { name: /confirmar reserva/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('RS-20261201-XYZ999');
    });
  });

  it('permite al administrador crear una mesa en /admin/mesas', async () => {
    const user = userEvent.setup();
    mockRole('administrador', 'Camila Herrera');
    mockTableService.fetchRestaurantTables.mockResolvedValue({
      data: [],
      error: null,
    });
    mockTableService.createRestaurantTable.mockResolvedValue({
      data: {
        id: 't-1',
        code: 'M-01',
        zone: 'Terraza',
        capacity: 6,
        status: 'disponible',
        is_active: true,
      },
      error: null,
    });

    renderAt('/admin/mesas');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /crear mesa/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /crear mesa/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/código o número de mesa/i), 'M-01');
    const zoneInput = within(dialog).getByLabelText(/zona o ubicación/i);
    await user.clear(zoneInput);
    await user.type(zoneInput, 'Terraza');
    const capInput = within(dialog).getByLabelText(/capacidad máxima/i);
    await user.clear(capInput);
    await user.type(capInput, '6');

    await user.click(within(dialog).getByRole('button', { name: /crear mesa/i }));

    await waitFor(() => {
      expect(mockTableService.createRestaurantTable).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'M-01', zone: 'Terraza', capacity: 6 }),
      );
    });
  });
});
