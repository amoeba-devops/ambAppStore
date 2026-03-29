import { useTranslation } from 'react-i18next';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({ columns, data, isLoading, onRowClick }: DataTableProps<T>) {
  const { t } = useTranslation('stock');

  if (isLoading) {
    return <div className="flex h-40 items-center justify-center text-gray-400">{t('common.loading')}</div>;
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#e2e5eb] bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e2e5eb] bg-[#f0f2f5]">
            {columns.map((col) => (
              <th key={col.key} className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3.5 py-8 text-center text-[13px] text-gray-400">{t('common.noData')}</td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-[#e2e5eb] last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3.5 py-2.5 text-[13px] text-gray-700">
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
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
