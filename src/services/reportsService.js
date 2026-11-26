import { getSupabaseClient } from '../lib/supabase';
import { getDateIsoBogota } from '../utils/formatDate';

/**
 * Calcula reportes operativos y financieros sin duplicación por joins
 * (consultas independientes sobre orders, order_items, payments, reservations, table_accounts y cash_sessions).
 */
export function aggregateReportsData(
  { orders = [], orderItems = [], payments = [], reservations = [], accounts = [], cashSessions = [], products = [], categories = [] },
  { dateFrom = '', dateTo = '', paymentMethod = 'all', status = 'all', modality = 'all', categoryId = 'all' } = {},
) {
  const inRange = (iso) => {
    const d = getDateIsoBogota(iso);
    if (!d) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  const filteredOrders = orders.filter((o) => {
    if (!inRange(o.created_at)) return false;
    if (status !== 'all' && o.status !== status) return false;
    if (modality !== 'all' && o.modality !== modality) return false;
    return true;
  });

  const validOrders = filteredOrders.filter((o) => o.status !== 'Cancelado');
  const validOrderIds = new Set(validOrders.map((o) => o.id));
  const totalSales = validOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const avgTicket = validOrders.length > 0 ? Math.round(totalSales / validOrders.length) : 0;

  // Ventas por día (America/Bogota)
  const salesByDayMap = new Map();
  for (const o of validOrders) {
    const day = getDateIsoBogota(o.created_at);
    const prev = salesByDayMap.get(day) || { date: day, ordersCount: 0, total: 0 };
    prev.ordersCount += 1;
    prev.total += Number(o.total) || 0;
    salesByDayMap.set(day, prev);
  }
  const salesByDay = Array.from(salesByDayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Pagos confirmados (sin joins con order_items para evitar duplicar montos)
  const filteredPayments = payments.filter((p) => {
    if (p.status !== 'Confirmación simulada') return false;
    if (!inRange(p.paid_at || p.created_at)) return false;
    if (paymentMethod !== 'all' && p.method !== paymentMethod) return false;
    return true;
  });
  const totalPaid = filteredPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paymentsByMethod = { Efectivo: 0, Tarjeta: 0, Nequi: 0, PSE: 0 };
  for (const p of filteredPayments) {
    if (Object.hasOwn(paymentsByMethod, p.method)) {
      paymentsByMethod[p.method] += Number(p.amount) || 0;
    }
  }

  // Productos y categorías más vendidos
  const productById = new Map(products.map((p) => [p.id, p]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const prodAgg = new Map();
  const catAgg = new Map();

  for (const item of orderItems) {
    if (!validOrderIds.has(item.order_id)) continue;
    const prod = productById.get(item.product_id);
    if (categoryId !== 'all' && prod?.category_id !== categoryId) continue;

    const pKey = item.product_id || item.product_name_snapshot;
    const prevP = prodAgg.get(pKey) || {
      name: item.product_name_snapshot,
      quantity: 0,
      revenue: 0,
    };
    prevP.quantity += Number(item.quantity) || 0;
    prevP.revenue += Number(item.line_total) || 0;
    prodAgg.set(pKey, prevP);

    const cName = categoryById.get(prod?.category_id)?.name || 'Sin categoría';
    const prevC = catAgg.get(cName) || { category: cName, quantity: 0, revenue: 0 };
    prevC.quantity += Number(item.quantity) || 0;
    prevC.revenue += Number(item.line_total) || 0;
    catAgg.set(cName, prevC);
  }

  const topProducts = Array.from(prodAgg.values()).sort((a, b) => b.revenue - a.revenue);
  const byCategory = Array.from(catAgg.values()).sort((a, b) => b.revenue - a.revenue);

  // Operación: estados, modalidades, reservas y cuentas
  const ordersByStatus = {};
  const ordersByModality = { domicilio: 0, recoger: 0, mesa: 0 };
  for (const o of filteredOrders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    if (Object.hasOwn(ordersByModality, o.modality)) {
      ordersByModality[o.modality] += 1;
    }
  }

  const filteredReservations = reservations.filter((r) => {
    if (dateFrom && r.reservation_date < dateFrom) return false;
    if (dateTo && r.reservation_date > dateTo) return false;
    return true;
  });

  const openAccountsCount = accounts.filter((a) => ['open', 'closing_requested'].includes(a.status)).length;
  const closedAccountsCount = accounts.filter((a) => a.status === 'closed').length;

  const filteredSessions = cashSessions.filter((s) => inRange(s.opened_at));

  return {
    sales: {
      totalOrders: filteredOrders.length,
      validOrdersCount: validOrders.length,
      totalSales,
      avgTicket,
      salesByDay,
    },
    payments: {
      totalPaid,
      count: filteredPayments.length,
      byMethod: paymentsByMethod,
    },
    products: {
      topProducts,
      byCategory,
    },
    operation: {
      ordersByStatus,
      ordersByModality,
      reservationsCount: filteredReservations.length,
      openAccountsCount,
      closedAccountsCount,
    },
    cash: {
      sessions: filteredSessions,
      totalDifference: filteredSessions.reduce((s, x) => s + (Number(x.difference) || 0), 0),
    },
  };
}

/**
 * Carga catálogo ligero de categorías y productos para los 7 controles de filtro de reportes.
 */
export async function fetchReportFilterCatalog() {
  try {
    const client = getSupabaseClient();
    const [catRes, prodRes] = await Promise.all([
      client.from('categories').select('id, name').order('name', { ascending: true }),
      client
        .from('products')
        .select('id, category_id, name, is_addon')
        .order('name', { ascending: true }),
    ]);

    return {
      data: {
        categories: catRes.data ?? [],
        products: prodRes.data ?? [],
      },
      error: null,
    };
  } catch (err) {
    return {
      data: { categories: [], products: [] },
      error: { code: err.code || 'CATALOG_FILTER_ERROR', message: 'No fue posible cargar filtros de catálogo.' },
    };
  }
}

/**
 * Consulta reportes financieros y operativos agregados directamente en PostgreSQL
 * mediante `public.get_admin_reports_summary` (AUD811-04):
 * - Sin truncamiento `.limit(1000)` / `.limit(3000)` en cliente.
 * - Zona horaria `America/Bogota` exacta en el motor SQL.
 * - Soporta los 7 filtros operativos (fecha inicial, fecha final, estado, modalidad, método de pago, categoría y producto).
 * - Diferencia pedidos registrados, ventas confirmadas, pagos recibidos, reembolsos, ingresos y egresos manuales.
 */
export async function fetchServerAdminReports({
  dateFrom = '',
  dateTo = '',
  status = 'all',
  modality = 'all',
  paymentMethod = 'all',
  categoryId = 'all',
  productId = 'all',
} = {}) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('get_admin_reports_summary', {
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
      p_status: status && status !== 'all' ? status : null,
      p_modality: modality && modality !== 'all' ? modality : null,
      p_payment_method: paymentMethod && paymentMethod !== 'all' ? paymentMethod : null,
      p_category_id: categoryId && categoryId !== 'all' ? categoryId : null,
      p_product_id: productId && productId !== 'all' ? productId : null,
    });

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'REPORTS_RPC_ERROR',
          message: 'No fue posible generar los reportes en el servidor.',
        },
      };
    }

    const normalized = {
      sales: {
        totalOrders: Number(data?.sales?.totalOrders) || 0,
        validOrdersCount: Number(data?.sales?.validOrdersCount) || 0,
        cancelledOrdersCount: Number(data?.sales?.cancelledOrdersCount) || 0,
        totalSales: Number(data?.sales?.totalSales) || 0,
        avgTicket: Number(data?.sales?.avgTicket) || 0,
        salesByDay: Array.isArray(data?.sales?.salesByDay) ? data.sales.salesByDay : [],
      },
      payments: {
        totalPaid: Number(data?.payments?.totalPaid) || 0,
        count: Number(data?.payments?.count) || 0,
        refundedTotal: Number(data?.payments?.refundedTotal) || 0,
        refundedCount: Number(data?.payments?.refundedCount) || 0,
        byMethod: {
          Efectivo: Number(data?.payments?.byMethod?.Efectivo) || 0,
          Tarjeta: Number(data?.payments?.byMethod?.Tarjeta) || 0,
          Nequi: Number(data?.payments?.byMethod?.Nequi) || 0,
          PSE: Number(data?.payments?.byMethod?.PSE) || 0,
        },
      },
      cashMovements: {
        manualIncomeTotal: Number(data?.cashMovements?.manualIncomeTotal) || 0,
        manualExpenseTotal: Number(data?.cashMovements?.manualExpenseTotal) || 0,
        refundMovementsTotal: Number(data?.cashMovements?.refundMovementsTotal) || 0,
      },
      products: {
        topProducts: Array.isArray(data?.products?.topProducts) ? data.products.topProducts : [],
        byCategory: Array.isArray(data?.products?.byCategory) ? data.products.byCategory : [],
      },
      operation: {
        ordersByStatus: data?.operation?.ordersByStatus ?? {},
        ordersByModality: {
          domicilio: Number(data?.operation?.ordersByModality?.domicilio) || 0,
          recoger: Number(data?.operation?.ordersByModality?.recoger) || 0,
          mesa: Number(data?.operation?.ordersByModality?.mesa) || 0,
        },
        reservationsCount: Number(data?.operation?.reservationsCount) || 0,
        tablesUsedCount: Number(data?.operation?.tablesUsedCount) || 0,
        openAccountsCount: Number(data?.operation?.openAccountsCount) || 0,
        closedAccountsCount: Number(data?.operation?.closedAccountsCount) || 0,
      },
      cash: {
        sessions: Array.isArray(data?.cash?.sessions) ? data.cash.sessions : [],
        totalDifference: Number(data?.cash?.totalDifference) || 0,
      },
    };

    return { data: normalized, error: null };
  } catch (err) {
    return {
      data: null,
      error: { code: err.code || 'REPORTS_EXCEPTION', message: 'Error de conexión al consultar reportes.' },
    };
  }
}
