import { clsx } from 'clsx';

interface KanbanColumnProps {
  title: string;
  count: number;
  color: 'yellow' | 'blue' | 'green';
  children: React.ReactNode;
}

const COLUMN_STYLES: Record<KanbanColumnProps['color'], { header: string; countBg: string }> = {
  yellow: {
    header: 'border-b-2 border-yellow-500',
    countBg: 'bg-yellow-100 text-yellow-800',
  },
  blue: {
    header: 'border-b-2 border-blue-500',
    countBg: 'bg-blue-100 text-blue-800',
  },
  green: {
    header: 'border-b-2 border-green-500',
    countBg: 'bg-green-100 text-green-800',
  },
};

export function KanbanColumn({ title, count, color, children }: KanbanColumnProps) {
  const style = COLUMN_STYLES[color];

  return (
    <div className="flex min-h-[400px] flex-col rounded-[10px] border border-[#e2e5eb] bg-white">
      {/* Header */}
      <div className={clsx('flex items-center justify-between px-4 py-3', style.header)}>
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className={clsx('rounded-full px-2 py-0.5 text-xs font-bold', style.countBg)}>
          {count}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {children}
      </div>
    </div>
  );
}
