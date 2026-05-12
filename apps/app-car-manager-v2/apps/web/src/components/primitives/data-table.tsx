import type { ReactNode } from 'react';
import { cn } from '@car-v2/ui/cn';

export type Column<T> = {
  key: string;
  label: string;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  nowrap?: boolean;
  render?: (row: T) => ReactNode;
};

type Props<T> = {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  dense?: boolean;
  empty?: ReactNode;
};

export function DataTable<T>({ columns, rows, rowKey, dense, empty }: Props<T>) {
  if (rows.length === 0 && empty) {
    return <div className="border-t border-neutral-100">{empty}</div>;
  }
  const cellPad = dense ? 'py-2 px-3' : 'py-3 px-4';
  const fontSize = dense ? 'text-[12.5px]' : 'text-[13px]';
  return (
    <div className="overflow-auto">
      <table className={cn('w-full border-collapse', fontSize)}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width, textAlign: c.align ?? 'left' }}
                className="bg-neutral-25 text-[11px] font-bold text-neutral-500 uppercase tracking-[0.06em] border-b border-neutral-100 px-4 py-2.5 whitespace-nowrap"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-neutral-75 hover:bg-neutral-25 transition-colors">
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{ textAlign: c.align ?? 'left' }}
                  className={cn(cellPad, 'text-neutral-700', c.nowrap === false ? '' : 'whitespace-nowrap')}
                >
                  {c.render ? c.render(r) : (r as Record<string, ReactNode>)[c.key] ?? null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
