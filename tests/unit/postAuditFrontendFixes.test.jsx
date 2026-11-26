import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDateIsoBogota } from '../../src/utils/formatDate';
import { mapOrderRpcError } from '../../src/services/orderService';
import { mapTableRpcError } from '../../src/services/tableService';

const mockRpc = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
  getSupabaseClient: () => ({ rpc: mockRpc, from: mockFrom }),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'cli-1' } }),
}));

const mockUseOrders = vi.hoisted(() => vi.fn());
vi.mock('../../src/hooks/useOrders', () => ({
  useOrders: (...args) => mockUseOrders(...args),
}));

import { ClientHistoryPage } from '../../src/pages/client/ClientHistoryPage';
import {
  createUserAddress,
  setDefaultUserAddress,
} from '../../src/services/addressService';
import { adminUpdateReservation } from '../../src/services/reservationService';
import {
  toggleRestaurantTableActive,
  updateRestaurantTable,
} from '../../src/services/tableService';

describe('Correcciones postauditoría frontend (AUD-07, AUD-08, AUD-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AUD-07: convierte fechas UTC a calendario America/Bogota correctamente entre 19:00 y 23:59 COT', () => {
    // 2026-11-24 19:05 COT = 2026-11-25 00:05 UTC
    expect(getDateIsoBogota('2026-11-25T00:05:00.000Z')).toBe('2026-11-24');
    // 2026-11-24 23:59 COT = 2026-11-25 04:59 UTC
    expect(getDateIsoBogota('2026-11-25T04:59:00.000Z')).toBe('2026-11-24');
    // 2026-11-25 00:00 COT = 2026-11-25 05:00 UTC
    expect(getDateIsoBogota('2026-11-25T05:00:00.000Z')).toBe('2026-11-25');
  });

  it('AUD-07: ClientHistoryPage filtra por fecha local America/Bogota sin desplazar pedidos nocturnos', async () => {
    const user = userEvent.setup();
    mockUseOrders.mockReturnValue({
      orders: [
        {
          id: 'o-night',
          order_number: 'FB-NOCHE-24',
          created_at: '2026-11-25T02:30:00.000Z', // 21:30 del 24 nov en Colombia
          modality: 'domicilio',
          status: 'Entregado',
          total: 35000,
        },
        {
          id: 'o-next',
          order_number: 'FB-MANANA-25',
          created_at: '2026-11-25T15:00:00.000Z', // 10:00 del 25 nov en Colombia
          modality: 'recoger',
          status: 'Entregado',
          total: 22000,
        },
      ],
      isLoading: false,
      error: null,
      reload: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ClientHistoryPage />
      </MemoryRouter>,
    );

    const dateInput = screen.getByLabelText(/filtrar por fecha/i);
    await user.type(dateInput, '2026-11-24');

    expect(screen.getByText('FB-NOCHE-24')).toBeInTheDocument();
    expect(screen.queryByText('FB-MANANA-25')).not.toBeInTheDocument();
  });

  it('AUD-08: elimina fallbacks inseguros — si falta la RPC devuelve error claro sin llamar a .from()', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' },
    });

    const addrRes = await setDefaultUserAddress('u1', 'a1');
    expect(addrRes.error?.message).toContain('no está disponible');
    expect(mockFrom).not.toHaveBeenCalled();

    const createAddrRes = await createUserAddress('u1', {
      label: 'Casa',
      address: 'Calle 85 # 15-40',
      neighborhood: 'Chapinero',
      isDefault: true,
    });
    expect(createAddrRes.error?.message).toContain('no está disponible');
    expect(mockFrom).not.toHaveBeenCalled();

    const resAdmin = await adminUpdateReservation({
      reservationId: 'r1',
      newStatus: 'Confirmada',
    });
    expect(resAdmin.error?.code).toBe('RPC_UNAVAILABLE');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('AUD-09 y AUD-06: tableService usa admin_save_restaurant_table para editar/reactivar y traduce conflictos', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { id: 't1', code: 'M-01', zone: 'Salón', capacity: 4, is_active: true, status: 'disponible' },
      error: null,
    });
    const reactivated = await updateRestaurantTable('t1', {
      code: 'M-01',
      zone: 'Salón',
      capacity: 4,
      isActive: true,
    });
    expect(reactivated.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('admin_save_restaurant_table', {
      p_table_id: 't1',
      p_code: 'M-01',
      p_zone: 'Salón',
      p_capacity: 4,
      p_is_active: true,
    });

    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'TABLE_HAS_ACTIVE_RESERVATIONS: Mesa con reservas' },
    });
    const toggleErr = await toggleRestaurantTableActive({
      id: 't1',
      code: 'M-01',
      zone: 'Salón',
      capacity: 4,
      is_active: true,
    });
    expect(toggleErr.error?.message).toContain('reservas futuras vigentes');

    expect(mapTableRpcError({ message: 'TABLE_CAPACITY_CONFLICT' })).toContain('reducir la capacidad');
    expect(mapTableRpcError({ message: 'TABLE_HAS_OPEN_ACCOUNT' })).toContain('cuenta de mesa abierta');
    expect(mapOrderRpcError({ message: 'IDEMPOTENCY_CONFLICT' })).toContain('datos distintos');
  });
});
