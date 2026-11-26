import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge, Card, ErrorState, LoadingState } from '../../components/ui';
import { fetchAdminUsersAndRoles } from '../../services/adminUsersService';

export function AdminRolesPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchAdminUsersAndRoles().then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else setData(res.data);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 9 · RBAC OFICIAL"
        title="Roles y"
        accent="permisos."
        description="Matriz oficial de roles (cliente, mesero, administrador) y permisos declarativos gobernados por RLS en PostgreSQL."
      />

      {error ? (
        <ErrorState
          title="No fue posible cargar la matriz RBAC"
          description={error.message}
        />
      ) : isLoading || !data ? (
        <LoadingState title="Cargando roles y permisos…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {data.roles.map((role) => {
            const permIds = new Set(
              data.rolePermissions
                .filter((rp) => rp.role_id === role.id)
                .map((rp) => rp.permission_id),
            );
            const rolePerms = data.permissions.filter((p) => permIds.has(p.id));

            return (
              <Card key={role.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="fire">{role.code}</Badge>
                    <h2 className="m-0 mt-1 text-xl font-medium text-text-primary sigr-heading-display">
                      {role.name}
                    </h2>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-wood shrink-0" aria-hidden="true" />
                </div>

                {role.description && (
                  <p className="m-0 text-xs text-text-secondary">{role.description}</p>
                )}

                <div className="pt-2 border-t border-border-subtle">
                  <p className="m-0 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                    Permisos ({rolePerms.length})
                  </p>
                  <ul className="m-0 p-0 list-none space-y-1.5 text-xs">
                    {rolePerms.map((perm) => (
                      <li key={perm.id} className="text-text-secondary">
                        <code className="text-[11px] font-semibold text-text-primary">
                          {perm.code}
                        </code>
                        {perm.description ? ` — ${perm.description}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
