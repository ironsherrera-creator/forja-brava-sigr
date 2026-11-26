import { getSupabaseClient } from '../lib/supabase';
import { getDateIsoBogota, getTodayBogotaIso } from '../utils/formatDate';

/**
 * Calcula los indicadores reales del Dashboard Administrativo en zona horaria America/Bogota.
 */
export async function fetchAdminDashboardMetrics() {
  try {
    const client = getSupabaseClient();
    const todayIso = getTodayBogotaIso();

    const [ordersRes, tablesRes, accountsRes, reservationsRes, productsRes, profilesRes] =
      await Promise.all([
        client
          .from('orders')
          .select('id, total, status, payment_status, created_at')
          .order('created_at', { ascending: false })
          .limit(500),
        client.from('restaurant_tables').select('id, status, is_active'),
        client
          .from('table_accounts')
          .select('id, status, total_amount')
          .in('status', ['open', 'closing_requested']),
        client
          .from('reservations')
          .select('id, reservation_date, status')
          .eq('reservation_date', todayIso),
        client.from('products').select('id, is_available'),
        client.from('profiles').select('id, is_active'),
      ]);

    if (
      ordersRes.error ||
      tablesRes.error ||
      accountsRes.error ||
      reservationsRes.error ||
      productsRes.error ||
      profilesRes.error
    ) {
      return {
        data: null,
        error: {
          code: 'ADMIN_DASHBOARD_ERROR',
          message: 'No fue posible cargar los indicadores del panel administrativo.',
        },
      };
    }

    const todayOrders = (ordersRes.data ?? []).filter(
      (o) => getDateIsoBogota(o.created_at) === todayIso,
    );
    const validTodayOrders = todayOrders.filter((o) => o.status !== 'Cancelado');
    const dailySales = validTodayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const avgTicket =
      validTodayOrders.length > 0 ? Math.round(dailySales / validTodayOrders.length) : 0;

    const occupiedTables = (tablesRes.data ?? []).filter(
      (t) => t.is_active && t.status === 'ocupada',
    ).length;
    const activeAccounts = (accountsRes.data ?? []).length;
    const pendingCloseAccounts = (accountsRes.data ?? []).filter(
      (a) => a.status === 'closing_requested',
    ).length;
    const todayReservations = (reservationsRes.data ?? []).filter(
      (r) => r.status !== 'Cancelada',
    ).length;
    const activeProducts = (productsRes.data ?? []).filter((p) => p.is_available).length;
    const activeUsers = (profilesRes.data ?? []).filter((p) => p.is_active).length;

    return {
      data: {
        todayIso,
        dailySales,
        dailyOrdersCount: todayOrders.length,
        avgTicket,
        occupiedTables,
        todayReservations,
        activeAccounts,
        pendingCloseAccounts,
        activeProducts,
        activeUsers,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: err.code || 'ADMIN_DASHBOARD_EXCEPTION',
        message: 'Error de conexión al calcular métricas administrativas.',
      },
    };
  }
}
