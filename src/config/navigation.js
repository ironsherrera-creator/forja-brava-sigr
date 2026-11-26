import {
  Activity,
  Armchair,
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  ClipboardList,
  FolderTree,
  History,
  Home,
  LayoutDashboard,
  MapPin,
  PlusCircle,
  Radar,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingBag,
  User,
  UserCheck,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';

export const PUBLIC_NAV_LINKS = [
  { label: 'Inicio', to: '/' },
  { label: 'Menú', to: '/menu' },
  { label: 'Nosotros', href: '/#esencia' },
  { label: 'Contacto', href: '/#contacto' },
];

export const CLIENT_NAV_GROUPS = [
  {
    id: 'client-main',
    label: 'Mi experiencia',
    items: [
      { to: '/cliente', label: 'Inicio', icon: Home, end: true },
      { to: '/cliente/nuevo-pedido', label: 'Realizar pedido', icon: ShoppingBag },
      { to: '/cliente/pedidos', label: 'Mis pedidos', icon: ClipboardList },
      { to: '/cliente/seguimiento', label: 'Seguimiento', icon: Radar },
      { to: '/cliente/historial', label: 'Historial', icon: History },
      { to: '/cliente/reservas', label: 'Mis reservas', icon: CalendarClock },
    ],
  },
  {
    id: 'client-account',
    label: 'Mi cuenta',
    items: [
      { to: '/cliente/direcciones', label: 'Mis direcciones', icon: MapPin },
      { to: '/cliente/perfil', label: 'Mi perfil', icon: User },
    ],
  },
];

export const WAITER_NAV_GROUPS = [
  {
    id: 'waiter-service',
    label: 'Servicio en salón',
    items: [
      { to: '/mesero', label: 'Inicio', icon: LayoutDashboard, end: true },
      { to: '/mesero/mesas', label: 'Mesas', icon: Armchair },
      { to: '/mesero/comandas/nueva', label: 'Tomar pedido', icon: PlusCircle },
      { to: '/mesero/pedidos', label: 'Pedidos', icon: ClipboardList },
      { to: '/mesero/cuentas', label: 'Cuentas', icon: Receipt },
      { to: '/mesero/historial', label: 'Historial', icon: History },
    ],
  },
];

export const ADMIN_NAV_GROUPS = [
  {
    id: 'admin-general',
    label: 'General',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    id: 'admin-operation',
    label: 'Operación',
    items: [
      { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
      { to: '/admin/reservas', label: 'Reservas', icon: CalendarClock },
      { to: '/admin/mesas', label: 'Mesas', icon: Armchair },
    ],
  },
  {
    id: 'admin-catalog',
    label: 'Catálogo',
    items: [
      { to: '/admin/productos', label: 'Productos', icon: UtensilsCrossed },
      { to: '/admin/categorias', label: 'Categorías', icon: FolderTree },
    ],
  },
  {
    id: 'admin-people',
    label: 'Clientes y personal',
    items: [
      { to: '/admin/clientes', label: 'Clientes', icon: UserCheck },
      { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
      { to: '/admin/roles', label: 'Roles y permisos', icon: ShieldCheck },
    ],
  },
  {
    id: 'admin-finance',
    label: 'Finanzas',
    items: [
      { to: '/admin/caja', label: 'Caja', icon: Wallet },
      { to: '/admin/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
    ],
  },
  {
    id: 'admin-control',
    label: 'Control',
    items: [
      { to: '/admin/reportes', label: 'Reportes', icon: BarChart3 },
      { to: '/admin/auditoria', label: 'Auditoría', icon: Activity },
    ],
  },
  {
    id: 'admin-config',
    label: 'Configuración',
    items: [
      { to: '/admin/configuracion', label: 'Restaurante', icon: Settings },
    ],
  },
];

export const ROUTE_BREADCRUMB_LABELS = {
  cliente: 'Área Cliente',
  mesero: 'Servicio en Salón',
  admin: 'Administración',
  'nuevo-pedido': 'Nuevo pedido',
  pedidos: 'Pedidos',
  seguimiento: 'Seguimiento',
  reservas: 'Reservas',
  direcciones: 'Mis direcciones',
  perfil: 'Mi perfil',
  mesas: 'Mesas',
  comandas: 'Comandas',
  nueva: 'Nueva comanda',
  cuentas: 'Cuentas',
  historial: 'Historial',
  productos: 'Productos',
  categorias: 'Categorías',
  clientes: 'Clientes',
  usuarios: 'Usuarios',
  roles: 'Roles y permisos',
  caja: 'Caja',
  movimientos: 'Movimientos',
  reportes: 'Reportes',
  auditoria: 'Auditoría',
  configuracion: 'Configuración del restaurante',
};

export function buildBreadcrumbsFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [];

  return segments.map((segment, index) => {
    const to = `/${segments.slice(0, index + 1).join('/')}`;
    const label =
      ROUTE_BREADCRUMB_LABELS[segment] ||
      segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

    return {
      label,
      to: index < segments.length - 1 ? to : undefined,
      isCurrent: index === segments.length - 1,
    };
  });
}
