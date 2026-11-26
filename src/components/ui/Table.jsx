export function Table({
  columns = [],
  data = [],
  keyField = 'id',
  caption = '',
  emptyMessage = 'No hay registros disponibles para mostrar.',
  className = '',
}) {
  return (
    <div
      className={`w-full overflow-x-auto border border-border-subtle rounded-[var(--radius-sm)] bg-surface-elevated ${className}`.trim()}
    >
      <table className="w-full border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-surface-muted/80 border-b border-border-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-coffee whitespace-nowrap"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(columns.length, 1)}
                className="px-4 py-8 text-center text-xs text-text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={row[keyField] ?? rowIndex}
                className="hover:bg-surface-muted/40 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-text-primary align-middle">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
