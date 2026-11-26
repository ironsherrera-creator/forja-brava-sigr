export const ROLES = Object.freeze({
  CLIENTE: 'cliente',
  MESERO: 'mesero',
  ADMINISTRADOR: 'administrador',
});

export const VALID_ROLES = Object.freeze(Object.values(ROLES));

/**
 * Matriz funcional de capacidades para adaptar la navegación/UI.
 * IMPORTANTE: La autorización efectiva reside en PostgreSQL (RLS y RPCs).
 */
export const ROLE_CAPABILITIES = Object.freeze({
  [ROLES.CLIENTE]: Object.freeze([
    'menu.read',
    'profile.manage_own',
    'orders.read_own',
    'orders.create_client',
    'reservations.manage_own',
  ]),
  [ROLES.MESERO]: Object.freeze([
    'menu.read',
    'profile.manage_own',
    'tables.read',
    'orders.create_table',
    'orders.read_table',
    'orders.deliver_table',
    'orders.cancel_pending_table',
    'table_accounts.request_close',
    'reservations.read',
  ]),
  [ROLES.ADMINISTRADOR]: Object.freeze([
    'menu.read',
    'profile.manage_own',
    'orders.read_all',
    'orders.create_all',
    'orders.manage_preparation',
    'tables.manage',
    'reservations.manage',
    'products.manage',
    'categories.manage',
    'users.manage',
    'cash.manage',
    'reports.read',
    'settings.manage',
    'audit.read',
  ]),
});

export function isValidRole(role) {
  return typeof role === 'string' && VALID_ROLES.includes(role);
}

export function hasAllowedRole(userRole, allowedRoles = []) {
  if (!isValidRole(userRole)) return false;
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
  return allowedRoles.includes(userRole);
}

export function canRolePerform(role, capability) {
  if (!isValidRole(role) || !capability) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function getDefaultRouteForRole(role) {
  switch (role) {
    case ROLES.ADMINISTRADOR:
      return '/admin';
    case ROLES.MESERO:
      return '/mesero';
    case ROLES.CLIENTE:
      return '/cliente';
    default:
      return '/';
  }
}

export function canRoleAccessPath(role, pathname = '/') {
  if (!pathname || typeof pathname !== 'string') return false;
  if (pathname.startsWith('/admin')) return role === ROLES.ADMINISTRADOR;
  if (pathname.startsWith('/mesero')) return role === ROLES.MESERO;
  if (pathname.startsWith('/cliente')) return role === ROLES.CLIENTE;
  return true;
}

const DISALLOWED_REDIRECT_PREFIXES = [
  '/login',
  '/registro',
  '/recuperar-contrasena',
  '/actualizar-contrasena',
  '/acceso-denegado',
];

/**
 * Sanitiza el parámetro `redirect` evitando Open Redirects, rutas de auth
 * en bucle y destinos incompatibles con el rol autenticado.
 */
export function resolvePostAuthRedirect(rawRedirect, role) {
  const fallback = getDefaultRouteForRole(role);
  if (!rawRedirect || typeof rawRedirect !== 'string') {
    return fallback;
  }

  const trimmed = rawRedirect.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    trimmed.includes('://')
  ) {
    return fallback;
  }

  const pathnameOnly = trimmed.split('?')[0].split('#')[0];
  if (
    DISALLOWED_REDIRECT_PREFIXES.some(
      (prefix) =>
        pathnameOnly === prefix || pathnameOnly.startsWith(`${prefix}/`),
    )
  ) {
    return fallback;
  }

  if (!canRoleAccessPath(role, pathnameOnly)) {
    return fallback;
  }

  return trimmed;
}
