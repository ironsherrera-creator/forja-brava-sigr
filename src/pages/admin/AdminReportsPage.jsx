import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  Pagination,
  Select,
  Table,
} from '../../components/ui';
import {
  fetchReportFilterCatalog,
  fetchServerAdminReports,
} from '../../services/reportsService';
import {
  buildReportCsv,
  downloadCsvFile,
  triggerReportPrintPdf,
} from '../../utils/exportReports';
import { formatMoney } from '../../utils/formatMoney';

const PRODUCTS_PAGE_SIZE = 10;

export function AdminReportsPage() {
  const [report, setReport] = useState(null);
  const [catalog, setCatalog] = useState({ categories: [], products: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 7 filtros operativos y financieros (AUD811-04)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('all');
  const [modality, setModality] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [productId, setProductId] = useState('all');

  const [productPage, setProductPage] = useState(1);

  useEffect(() => {
    let active = true;
    fetchReportFilterCatalog().then((res) => {
      if (!active || res.error) return;
      setCatalog(res.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetchServerAdminReports({
      dateFrom,
      dateTo,
      status,
      modality,
      paymentMethod,
      categoryId,
      productId,
    });
    if (res.error) {
      setError(res.error);
    } else {
      setReport(res.data);
      setError(null);
    }
    setIsLoading(false);
  }, [dateFrom, dateTo, status, modality, paymentMethod, categoryId, productId]);

  useEffect(() => {
    let active = true;
    fetchServerAdminReports({
      dateFrom,
      dateTo,
      status,
      modality,
      paymentMethod,
      categoryId,
      productId,
    }).then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      else {
        setReport(res.data);
        setError(null);
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, status, modality, paymentMethod, categoryId, productId]);

  const filteredProductOptions = useMemo(() => {
    if (categoryId === 'all') return catalog.products;
    return catalog.products.filter((p) => p.category_id === categoryId);
  }, [catalog.products, categoryId]);

  const topProducts = useMemo(
    () => report?.products?.topProducts ?? [],
    [report?.products?.topProducts],
  );
  const totalProductPages = Math.max(1, Math.ceil(topProducts.length / PRODUCTS_PAGE_SIZE));
  const pagedProducts = useMemo(() => {
    const safePage = Math.min(productPage, totalProductPages);
    const start = (safePage - 1) * PRODUCTS_PAGE_SIZE;
    return topProducts.slice(start, start + PRODUCTS_PAGE_SIZE);
  }, [topProducts, productPage, totalProductPages]);

  const handleExportCsv = () => {
    if (!report) return;
    const periodLabel = `${dateFrom || 'Inicio'} a ${dateTo || 'Hoy'}`;
    const csv = buildReportCsv({
      reportName: 'Ventas y Productos FORJA BRAVA',
      periodLabel,
      headers: ['Producto', 'Unidades vendidas', 'Ingresos COP'],
      rows: report.products.topProducts.map((p) => [p.name, p.quantity, p.revenue]),
    });
    downloadCsvFile(`forja-brava-reporte-${Date.now()}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ETAPA 10 · REPORTES FINANCIEROS Y OPERATIVOS"
        title="Reportes"
        accent="del restaurante."
        description="Métricas reales calculadas sin duplicaciones por joins en zona horaria America/Bogota, diferenciando pedidos, ventas y pagos confirmados."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!report}
              leftIcon={<Download className="h-3.5 w-3.5" />}
            >
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={triggerReportPrintPdf}
              disabled={!report}
              leftIcon={<Printer className="h-3.5 w-3.5" />}
            >
              Imprimir / PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Actualizar
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Input
            type="date"
            aria-label="Fecha inicial"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setProductPage(1);
            }}
          />
          <Input
            type="date"
            aria-label="Fecha final"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setProductPage(1);
            }}
          />
          <Select
            aria-label="Estado"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setProductPage(1);
            }}
            options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'Pendiente', label: 'Pendiente' },
              { value: 'Confirmado', label: 'Confirmado' },
              { value: 'En preparación', label: 'En preparación' },
              { value: 'Listo', label: 'Listo' },
              { value: 'Despachado', label: 'Despachado' },
              { value: 'Entregado', label: 'Entregado' },
              { value: 'Cancelado', label: 'Cancelado' },
            ]}
          />
          <Select
            aria-label="Modalidad"
            value={modality}
            onChange={(e) => {
              setModality(e.target.value);
              setProductPage(1);
            }}
            options={[
              { value: 'all', label: 'Todas las modalidades' },
              { value: 'domicilio', label: 'Domicilio' },
              { value: 'recoger', label: 'Recoger' },
              { value: 'mesa', label: 'Mesa' },
            ]}
          />
          <Select
            aria-label="Método de pago"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setProductPage(1);
            }}
            options={[
              { value: 'all', label: 'Todos los métodos' },
              { value: 'Efectivo', label: 'Efectivo' },
              { value: 'Tarjeta', label: 'Tarjeta' },
              { value: 'Nequi', label: 'Nequi' },
              { value: 'PSE', label: 'PSE' },
            ]}
          />
          <Select
            aria-label="Categoría"
            value={categoryId}
            onChange={(e) => {
              const nextCat = e.target.value;
              setCategoryId(nextCat);
              setProductId('all');
              setProductPage(1);
            }}
            options={[
              { value: 'all', label: 'Todas las categorías' },
              ...catalog.categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            aria-label="Producto"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setProductPage(1);
            }}
            options={[
              { value: 'all', label: 'Todos los productos' },
              ...filteredProductOptions.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>
      </Card>

      {error ? (
        <ErrorState
          title="No fue posible generar los reportes"
          description={error.message}
          onRetry={load}
        />
      ) : isLoading || !report ? (
        <LoadingState title="Consolidando reportes operativos y financieros en PostgreSQL…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Pedidos registrados
              </p>
              <p className="m-0 mt-1 text-2xl font-medium text-text-primary sigr-heading-display">
                {report.sales.totalOrders}
              </p>
              <p className="m-0 mt-1 text-[11px] text-text-muted">
                {report.sales.validOrdersCount} válidos · {report.sales.cancelledOrdersCount} cancelados
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Ventas confirmadas (no canceladas)
              </p>
              <p className="m-0 mt-1 text-2xl font-medium text-fire sigr-heading-display">
                {formatMoney(report.sales.totalSales)}
              </p>
              <p className="m-0 mt-1 text-[11px] text-text-muted">
                Ticket prom: {formatMoney(report.sales.avgTicket)}
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Pagos recibidos
              </p>
              <p className="m-0 mt-1 text-2xl font-medium text-success sigr-heading-display">
                {formatMoney(report.payments.totalPaid)}
              </p>
              <p className="m-0 mt-1 text-[11px] text-text-muted">
                {report.payments.count} pago(s) confirmados
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Reembolsos
              </p>
              <p className="m-0 mt-1 text-2xl font-medium text-error sigr-heading-display">
                {formatMoney(report.payments.refundedTotal)}
              </p>
              <p className="m-0 mt-1 text-[11px] text-text-muted">
                {report.payments.refundedCount} reembolso(s)
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Ingresos manuales
              </p>
              <p className="m-0 mt-1 text-xl font-semibold text-success sigr-heading-display">
                {formatMoney(report.cashMovements.manualIncomeTotal)}
              </p>
              <p className="m-0 mt-1 text-[11px] text-text-muted">
                Movimientos de caja
              </p>
            </Card>
            <Card>
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Egresos manuales
              </p>
              <p className="m-0 mt-1 text-xl font-semibold text-text-primary sigr-heading-display">
                {formatMoney(report.cashMovements.manualExpenseTotal)}
              </p>
              <p className="m-0 mt-1 text-[11px] text-text-muted">
                {report.operation.reservationsCount} res. · {report.operation.openAccountsCount} ab. / {report.operation.closedAccountsCount} cerr.
              </p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-3">
                Pagos confirmados por método
              </h2>
              <dl className="space-y-2 text-xs">
                {Object.entries(report.payments.byMethod).map(([m, total]) => (
                  <div key={m} className="flex justify-between py-1.5 border-b border-border-subtle">
                    <dt className="font-semibold text-text-primary">{m}</dt>
                    <dd className="m-0 font-bold text-fire">{formatMoney(total)}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-3">
                Operación por modalidad y caja
              </h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border-subtle">
                  <dt>Domicilio</dt>
                  <dd className="m-0 font-semibold">{report.operation.ordersByModality.domicilio}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-border-subtle">
                  <dt>Recoger</dt>
                  <dd className="m-0 font-semibold">{report.operation.ordersByModality.recoger}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-border-subtle">
                  <dt>En mesa</dt>
                  <dd className="m-0 font-semibold">{report.operation.ordersByModality.mesa}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt>Sesiones de caja / Diferencia neta</dt>
                  <dd className="m-0 font-semibold">
                    {report.cash.sessions.length} ses. · {formatMoney(report.cash.totalDifference)}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          <Card>
            <h2 className="m-0 text-xl font-medium text-text-primary sigr-heading-display mb-4">
              Productos más vendidos
            </h2>
            <Table
              caption="Productos más vendidos del período"
              columns={[
                { key: 'name', header: 'Producto', render: (r) => <strong>{r.name}</strong> },
                { key: 'quantity', header: 'Unidades', render: (r) => <span>{r.quantity}</span> },
                { key: 'revenue', header: 'Ingresos', render: (r) => <strong className="text-fire">{formatMoney(r.revenue)}</strong> },
              ]}
              data={pagedProducts}
            />
            <Pagination
              currentPage={Math.min(productPage, totalProductPages)}
              totalPages={totalProductPages}
              onPageChange={setProductPage}
            />
          </Card>
        </>
      )}
    </div>
  );
}
