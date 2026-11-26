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
  supabase: {
    auth: mockAuthApi,
  },
  getSupabaseClient: () => ({
    auth: mockAuthApi,
  }),
  getAuthRedirectUrl: (path = '/') => `http://localhost:5173${path}`,
}));

vi.mock('../../src/services/authService', () => mockAuthService);

import { AuthProvider } from '../../src/context/AuthContext';
import { CartProvider } from '../../src/context/CartContext';
import { AppRouter } from '../../src/routes/AppRouter';

function renderWithRouter(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <CartProvider>
          <AppRouter />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Integración — AuthContext, ProtectedRoute, GuestOnlyRoute y flujos de sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthApi.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockAuthApi.signOut.mockResolvedValue({ error: null });
    mockAuthService.signOutCurrentUser.mockResolvedValue({ error: null });
  });

  it('muestra estado de carga mientras resuelve la sesión y redirige a /login con redirect si no hay sesión', async () => {
    let resolveSession;
    mockAuthApi.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );

    renderWithRouter(['/admin']);

    // Mientras hidrata la sesión debe mostrar AuthLoading y nunca contenido administrativo
    expect(
      screen.getByRole('status', { name: /verificando sesión/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Panel Administrativo/i),
    ).not.toBeInTheDocument();

    resolveSession({ data: { session: null }, error: null });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /tu cuenta/i }),
      ).toBeInTheDocument();
    });
  });

  it('permite acceso al panel correspondiente cuando el usuario tiene sesión y rol autorizado en PostgreSQL', async () => {
    const adminSession = {
      access_token: 'mock-token',
      user: { id: 'admin-uuid-1', email: 'admin@forjabrava.test' },
    };

    mockAuthApi.getSession.mockResolvedValue({
      data: { session: adminSession },
      error: null,
    });
    mockAuthService.fetchAuthenticatedProfile.mockResolvedValue({
      profile: {
        id: 'admin-uuid-1',
        full_name: ' Directora Operativa ',
        email: 'admin@forjabrava.test',
        is_active: true,
      },
      role: 'administrador',
      error: null,
    });

    renderWithRouter(['/admin']);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /cerrar sesión/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Directora Operativa/i).length).toBeGreaterThan(0);
  });

  it('bloquea con vista 403 (/acceso-denegado) cuando un cliente autenticado intenta entrar a /admin o /mesero', async () => {
    const clientSession = {
      access_token: 'mock-client-token',
      user: { id: 'client-uuid-1', email: 'cliente@forjabrava.test' },
    };

    mockAuthApi.getSession.mockResolvedValue({
      data: { session: clientSession },
      error: null,
    });
    mockAuthService.fetchAuthenticatedProfile.mockResolvedValue({
      profile: {
        id: 'client-uuid-1',
        full_name: 'Valentina Gómez',
        email: 'cliente@forjabrava.test',
        is_active: true,
      },
      role: 'cliente',
      error: null,
    });

    renderWithRouter(['/admin']);

    await waitFor(() => {
      expect(screen.getByText(/Acceso restringido · 403/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole('link', { name: /ir a mi panel autorizado/i }),
    ).toHaveAttribute('href', '/cliente');
  });

  it('fuerza el cierre de sesión inmediato y muestra aviso cuando profiles.is_active es false', async () => {
    const disabledSession = {
      access_token: 'mock-disabled-token',
      user: { id: 'disabled-uuid-1', email: 'inactivo@forjabrava.test' },
    };

    mockAuthApi.getSession.mockResolvedValue({
      data: { session: disabledSession },
      error: null,
    });
    mockAuthService.fetchAuthenticatedProfile.mockResolvedValue({
      profile: {
        id: 'disabled-uuid-1',
        full_name: 'Usuario Suspendido',
        email: 'inactivo@forjabrava.test',
        is_active: false,
      },
      role: null,
      error: {
        code: 'ACCOUNT_DISABLED',
        message: 'Tu cuenta se encuentra desactivada.',
      },
    });

    renderWithRouter(['/cliente']);

    await waitFor(() => {
      expect(mockAuthApi.signOut).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/cuenta se encuentra desactivada/i),
      ).toBeInTheDocument();
    });
  });

  it('aplica denegación por defecto si falla la consulta de perfil en PostgreSQL', async () => {
    const brokenSession = {
      access_token: 'mock-broken-token',
      user: { id: 'broken-uuid-1', email: 'error@forjabrava.test' },
    };

    mockAuthApi.getSession.mockResolvedValue({
      data: { session: brokenSession },
      error: null,
    });
    mockAuthService.fetchAuthenticatedProfile.mockResolvedValue({
      profile: null,
      role: null,
      error: {
        code: 'PROFILE_QUERY_ERROR',
        message: 'No fue posible verificar tu perfil de acceso.',
      },
    });

    renderWithRouter(['/mesero']);

    await waitFor(() => {
      expect(mockAuthApi.signOut).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /tu cuenta/i }),
      ).toBeInTheDocument();
    });
  });

  it('redirige automáticamente en GuestOnlyRoute (/login) al panel del rol si ya existe sesión activa', async () => {
    const waiterSession = {
      access_token: 'mock-waiter-token',
      user: { id: 'waiter-uuid-1', email: 'mesero@forjabrava.test' },
    };

    mockAuthApi.getSession.mockResolvedValue({
      data: { session: waiterSession },
      error: null,
    });
    mockAuthService.fetchAuthenticatedProfile.mockResolvedValue({
      profile: {
        id: 'waiter-uuid-1',
        full_name: 'Mateo Rojas',
        email: 'mesero@forjabrava.test',
        is_active: true,
      },
      role: 'mesero',
      error: null,
    });

    renderWithRouter(['/login']);

    await waitFor(() => {
      expect(screen.getAllByText(/Mateo Rojas/i).length).toBeGreaterThan(0);
    });
  });

  it('ejecuta inicio de sesión y posterior cierre de sesión limpiando el estado privado', async () => {
    const user = userEvent.setup();
    mockAuthApi.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockAuthService.signInWithEmailPassword.mockResolvedValue({
      data: {
        user: { id: 'client-uuid-2', email: 'valentina@forjabrava.test' },
        session: {
          access_token: 'mock-session-2',
          user: { id: 'client-uuid-2', email: 'valentina@forjabrava.test' },
        },
        profile: {
          id: 'client-uuid-2',
          full_name: 'Valentina Gómez',
          email: 'valentina@forjabrava.test',
          phone: '+57 300 111 2233',
          is_active: true,
        },
        role: 'cliente',
      },
      error: null,
    });

    renderWithRouter(['/login']);

    await waitFor(() => {
      expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    });

    await user.type(
      screen.getByLabelText(/correo electrónico/i),
      'valentina@forjabrava.test',
    );
    await user.type(screen.getByLabelText(/^contraseña$/i), 'Brava2026');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /hola, valentina gómez/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    await waitFor(() => {
      expect(mockAuthService.signOutCurrentUser).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole('heading', { name: /tu cuenta/i }),
      ).toBeInTheDocument();
    });
  });
});
