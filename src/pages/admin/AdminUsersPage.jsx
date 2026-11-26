import { useCallback, useEffect, useMemo, useState } from 'react';
import { Power, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  SearchInput,
  Select,
  Table,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import {
  adminUpdateUserAccount,
  fetchAdminUsersAndRoles,
} from '../../services/adminUsersService';

export function AdminUsersPage({ clientsOnly = false }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(clientsOnly ? 'cliente' : 'all');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchAdminUsersAndRoles();
    if (res.error) setError(res.error);
    else {
      setUsers(res.data.users);
      setRoles(res.data.roles);
      setError(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchAdminUsersAndRoles().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else {
        setUsers(res.data.users);
        setRoles(res.data.roles);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const rCode = u.role?.code || '';
      if (clientsOnly && rCode !== 'cliente') return false;
      if (!clientsOnly && roleFilter !== 'all' && rCode !== roleFilter) return false;
      if (
        q &&
        !String(u.full_name || '').toLowerCase().includes(q) &&
        !String(u.email || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [users, clientsOnly, roleFilter, search]);

  const handleRoleChange = async (targetUser, newRoleCode) => {
    setBusyId(targetUser.id);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await adminUpdateUserAccount({
        userId: targetUser.id,
        roleCode: newRoleCode,
      });
      if (res.error) setActionError(res.error.message);
      else {
        setActionSuccess(`Rol de ${targetUser.full_name} actualizado a "${newRoleCode}".`);
        load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (targetUser) => {
    setBusyId(targetUser.id);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await adminUpdateUserAccount({
        userId: targetUser.id,
        isActive: !targetUser.is_active,
      });
      if (res.error) setActionError(res.error.message);
      else {
        setActionSuccess(
          res.data.is_active
            ? `Cuenta de ${targetUser.full_name} activada.`
            : `Cuenta de ${targetUser.full_name} desactivada.`,
        );
        load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      key: 'full_name',
      header: 'Usuario',
      render: (row) => (
        <div>
          <strong className="text-text-primary">{row.full_name}</strong>
          <p className="m-0 text-xs text-text-secondary">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Rol asignado',
      render: (row) => {
        const isSelf = row.id === currentUser?.id;
        if (clientsOnly || isSelf) {
          return (
            <Badge variant="info">
              {row.role?.name || row.role?.code || 'Sin rol'}
              {isSelf ? ' (Tú)' : ''}
            </Badge>
          );
        }
        return (
          <Select
            aria-label={`Cambiar rol de ${row.full_name}`}
            value={row.role?.code || 'cliente'}
            disabled={busyId === row.id}
            onChange={(e) => handleRoleChange(row, e.target.value)}
            options={roles.map((r) => ({ value: r.code, label: r.name }))}
          />
        );
      },
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'error'}>
          {row.is_active ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Control',
      render: (row) => {
        const isSelf = row.id === currentUser?.id;
        return (
          <IconButton
            icon={<Power className="h-4 w-4" aria-hidden="true" />}
            label={row.is_active ? `Desactivar ${row.full_name}` : `Activar ${row.full_name}`}
            variant="outline"
            size="sm"
            disabled={isSelf || busyId === row.id}
            onClick={() => handleToggleActive(row)}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={clientsOnly ? 'ETAPA 9 · CLIENTES' : 'ETAPA 9 · SEGURIDAD Y ACCESO'}
        title={clientsOnly ? 'Directorio de' : 'Usuarios y'}
        accent={clientsOnly ? 'clientes.' : 'roles.'}
        description="Activación, desactivación y asignación de roles oficiales mediante RPC auditable admin_update_user_account (protección del último administrador activo)."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Actualizar
          </Button>
        }
      />

      {!clientsOnly && (
        <div className="p-3 rounded-[var(--radius-sm)] bg-cream border border-border-subtle text-xs text-text-secondary flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-wood shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Por seguridad, el alta de nuevas cuentas en Supabase Auth se realiza mediante el registro oficial (`/registro`) sin exponer claves `service_role` en el navegador. Una vez creada la cuenta, puedes asignar aquí el rol `mesero` o `administrador`.
          </span>
        </div>
      )}

      {actionError && (
        <div className="auth-alert auth-alert-error" role="alert">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="auth-alert auth-alert-success" role="status">
          {actionSuccess}
        </div>
      )}

      <Card>
        <div className="grid gap-3 md:grid-cols-2 mb-5">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Buscar por nombre o correo…"
            ariaLabel="Buscar usuarios"
          />
          {!clientsOnly && (
            <Select
              aria-label="Filtrar por rol"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Todos los roles' },
                ...roles.map((r) => ({ value: r.code, label: r.name })),
              ]}
            />
          )}
        </div>

        {error ? (
          <ErrorState
            title="No fue posible cargar los usuarios"
            description={error.message}
            onRetry={load}
          />
        ) : isLoading ? (
          <LoadingState title="Cargando perfiles y roles…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Sin usuarios con los filtros actuales"
            description="Ajusta la búsqueda o el filtro de rol."
          />
        ) : (
          <Table caption="Listado de usuarios del sistema" columns={columns} data={visible} />
        )}
      </Card>
    </div>
  );
}
