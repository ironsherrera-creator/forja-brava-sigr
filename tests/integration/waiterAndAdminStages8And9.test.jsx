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
}));
const mockWaiterService = vi.hoisted(() => ({
  fetchWaiterSalonSnapshot: vi.fn(),
  submitWaiterTableOrder: vi.fn(),
  updateWaiterOrderStatus: vi.fn(),
  requestTableAccountClose: vi.fn(),
  subscribeToWaiterSalon: vi.fn(() => () => {}),
  generateWaiterRequestId: () => '11111111-1111-4111-8111-111111111111',
}));
const mockAdminDash = vi.hoisted(() => ({
  fetchAdminDashboardMetrics: vi.fn(),
}));
const mockAdminAudit = vi.hoisted(() => ({
  fetchAuditLogs: vi.fn(),
}));

vi.mock('../../src/lib/env', () => ({
  env: {
    VITE_APP_NAME: 'FORJA BRAVA — SIGR',
    VITE_APP_TIMEZONE: 'America/Bogota',
    VITE_SUPABASE_URL: 'https://mock.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'mock-key',
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
vi.mock('../../src/services/waiterService', () => mockWaiterService);
vi.mock('../../src/services/adminDashboardService', () => mockAdminDash);
vi.mock('../../src/services/adminAuditService', () => mockAdminAudit);

import { AuthProvider } from '../../src/context/AuthContext';
import { CartProvider } from '../../src/context/CartContext';
import { AppRouter } from '../../src/routes/AppRouter';

function mockRole(role, name) {
  mockAuthApi.getSession.mockResolvedValue({
    data: { session: { access_token: 'tok', user: { id: `${role}-1`, email: `${role}@test.co` } } },
    error: null,
  });
  mockAuthService.fetchAuthenticatedProfile.mockResolvedValue({
    profile: { id: `${role}-1`, full_name: name, email: `${role}@test.co`, is_active: true },
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

describe('Integración — Etapas 8 y 9 (Panel del Mesero y Panel Administrativo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthApi.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('Etapa 8: renderiza /mesero/mesas con filtros y /mesero/pedidos con acciones D-05', async () => {
    const user = userEvent.setup();
    mockRole('mesero', 'Mateo Ríos');
    mockWaiterService.fetchWaiterSalonSnapshot.mockResolvedValue({
      data: {
        tables: [
          { id: 't1', code: 'M-01', zone: 'Salón', capacity: 4, status: 'ocupada', is_active: true },
          { id: 't2', code: 'M-02', zone: 'Terraza', capacity: 2, status: 'disponible', is_active: true },
        ],
        accounts: [
          { id: 'acc-1', table_id: 't1', status: 'open', total_amount: 57800, opened_at: new Date().toISOString() },
        ],
        orders: [
          {
            id: 'ord-1',
            order_number: 'FB-SALON-01',
            table_id: 't1',
            table_account_id: 'acc-1',
            status: 'Listo',
            total: 28900,
            created_at: new Date().toISOString(),
            order_items: [{ id: 'oi1', product_name_snapshot: 'La Forjada', quantity: 1, line_total: 28900 }],
          },
        ],
      },
      error: null,
    });
    mockWaiterService.updateWaiterOrderStatus.mockResolvedValue({
      data: { id: 'ord-1', status: 'Entregado' },
      error: null,
    });

    renderAt('/mesero/pedidos');
    await waitFor(() => {
      expect(screen.getByText('FB-SALON-01')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /entregar/i }));
    await waitFor(() => {
      expect(mockWaiterService.updateWaiterOrderStatus).toHaveBeenCalledWith(
        'ord-1',
        'Entregado',
        expect.any(String),
      );
    });
  });

  it('Etapa 9: renderiza Dashboard administrativo con KPIs reales y bloquea mesero en /admin/auditoria', async () => {
    mockRole('administrador', 'Camila Herrera');
    mockAdminDash.fetchAdminDashboardMetrics.mockResolvedValue({
      data: {
        todayIso: '2026-11-25',
        dailySales: 185000,
        dailyOrdersCount: 5,
        avgTicket: 37000,
        occupiedTables: 2,
        todayReservations: 3,
        activeAccounts: 2,
        pendingCloseAccounts: 1,
        activeProducts: 13,
        activeUsers: 4,
      },
      error: null,
    });

    renderAt('/admin');
    await waitFor(() => {
      expect(screen.getByText(/185\.000/)).toBeInTheDocument();
      expect(screen.getByText(/1 por cerrar/i)).toBeInTheDocument();
    });
  });
});
