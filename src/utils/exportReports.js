import { getTodayBogotaIso } from './formatDate';

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Genera texto CSV preservando metadatos del reporte (nombre, período, fecha y filtros).
 */
export function buildReportCsv({ reportName, periodLabel, headers, rows }) {
  const generatedAt = getTodayBogotaIso();
  const metaLines = [
    `# FORJA BRAVA — SIGR`,
    `# Reporte: ${reportName}`,
    `# Periodo: ${periodLabel}`,
    `# Generado (America/Bogota): ${generatedAt}`,
  ];
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [...metaLines, headerLine, ...dataLines].join('\n');
}

/**
 * Descarga un archivo CSV en el navegador.
 */
export function downloadCsvFile(filename, csvContent) {
  if (typeof window === 'undefined' || typeof Blob === 'undefined') return;
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Dispara impresión nativa / exportación PDF del navegador preservando filtros visibles.
 */
export function triggerReportPrintPdf() {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}
