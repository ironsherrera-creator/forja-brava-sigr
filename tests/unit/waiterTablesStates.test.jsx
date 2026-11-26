import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const salonState = vi.hoisted(() => ({ value: null }));

vi.mock('../../src/hooks/useWaiterSalon', () => ({
  useWaiterSalon: () => salonState.value,
}));

import { WaiterTablesPage } from '../../src/pages/waiter/WaiterTablesPage';

function baseState(overrides = {}) {
  return {
    tables: [],
    accounts: [],
    orders: [],
    staffDirectory: [],
    staffById: new Map(),
    isLoading: false,
    error: null,
    reload: vi.fn(),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WaiterTablesPage />
    </MemoryRouter>,
  );
}

describe('Mapa de mesas del mesero — estados de datos', () => {
  beforeEach(() => {
    salonState.value = baseState();
  });

  it('sin mesas configuradas muestra mensaje claro dirigido al administrador (sin falsa disponibilidad)', () => {
    renderPage();
    expect(screen.getByText('Aún no hay mesas configuradas')).toBeInTheDocument();
    expect(screen.getByText(/\/admin\/mesas/)).toBeInTheDocument();
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument();
  });

  it('muestra mesas disponibles, ocupadas e inactivas con su estado real', () => {
    salonState.value = baseState({
      tables: [
        { id: 't1', code: 'M-01', zone: 'Salón', capacity: 4, status: 'disponible', is_active: true },
        { id: 't2', code: 'M-02', zone: 'Salón', capacity: 2, status: 'ocupada', is_active: true },
        { id: 't3', code: 'M-03', zone: 'Terraza', capacity: 6, status: 'disponible', is_active: false },
      ],
      accounts: [
        { id: 'a1', table_id: 't2', status: 'open', total_amount: 28900, opened_at: new Date().toISOString() },
      ],
    });
    renderPage();
    expect(screen.getByText('M-01')).toBeInTheDocument();
    expect(screen.getByText('M-02')).toBeInTheDocument();
    expect(screen.getByText('Ocupada')).toBeInTheDocument();
    expect(screen.getAllByText('Fuera de servicio').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Aún no hay mesas configuradas')).not.toBeInTheDocument();
  });

  it('muestra el error de permisos/consulta en lugar de una lista vacía', () => {
    salonState.value = baseState({
      error: { code: 'WAITER_SNAPSHOT_ERROR', message: 'No fue posible cargar la información operativa del salón.' },
    });
    renderPage();
    expect(screen.getByText('No fue posible cargar el mapa de mesas')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay mesas configuradas')).not.toBeInTheDocument();
  });
});
