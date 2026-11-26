import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  Pagination,
  SearchInput,
  Table,
  Tabs,
} from '../../src/components/ui';
import { buildBreadcrumbsFromPath } from '../../src/config/navigation';

describe('Sistema UI Base — Componentes reutilizables y navegación', () => {
  it('renderiza Button con estado loading deshabilitado y Badge semántico', () => {
    render(
      <div>
        <Button loading>Guardar</Button>
        <Badge variant="fire">En servicio</Badge>
      </div>,
    );

    const btn = screen.getByRole('button', { name: /guardar/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('En servicio')).toBeInTheDocument();
  });

  it('genera iniciales en Avatar y muestra error accesible en FormField + Input', () => {
    render(
      <div>
        <Avatar name="Valentina Gómez" />
        <FormField id="campo-demo" label="Teléfono" error="Teléfono inválido" required>
          <Input id="campo-demo" error />
        </FormField>
      </div>,
    );

    expect(screen.getByText('VG')).toBeInTheDocument();
    expect(screen.getByLabelText(/teléfono/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Teléfono inválido');
  });

  it('permite limpiar SearchInput, cambiar pestañas en Tabs y paginar', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onTab = vi.fn();
    const onPage = vi.fn();

    render(
      <div>
        <SearchInput value="Forjada" onChange={() => {}} onClear={onClear} />
        <Tabs
          activeId="tab1"
          onChange={onTab}
          tabs={[
            { id: 'tab1', label: 'Activos' },
            { id: 'tab2', label: 'Historial' },
          ]}
        />
        <Pagination currentPage={1} totalPages={3} onPageChange={onPage} />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /limpiar búsqueda/i }));
    expect(onClear).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('tab', { name: 'Historial' }));
    expect(onTab).toHaveBeenCalledWith('tab2');

    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it('renderiza Table con datos o estado vacío y estados globales (EmptyState, LoadingState, ErrorState)', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <div>
        <Table
          caption="Mesas"
          columns={[{ key: 'code', header: 'Mesa' }]}
          data={[]}
          emptyMessage="Sin mesas registradas"
        />
        <EmptyState title="Bandeja vacía" description="No hay registros." />
        <LoadingState title="Cargando carta" />
        <ErrorState title="Error de red" onRetry={onRetry} />
      </div>,
    );

    expect(screen.getByText('Sin mesas registradas')).toBeInTheDocument();
    expect(screen.getByText('Bandeja vacía')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando carta');

    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('cierra ConfirmDialog con Escape y ejecuta confirmación al hacer clic', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirmar cancelación"
        confirmLabel="Sí, cancelar"
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sí, cancelar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('construye breadcrumbs legibles desde la ruta activa', () => {
    const crumbs = buildBreadcrumbsFromPath('/admin/caja');
    expect(crumbs).toEqual([
      { label: 'Administración', to: '/admin', isCurrent: false },
      { label: 'Caja', to: undefined, isCurrent: true },
    ]);
  });
});
