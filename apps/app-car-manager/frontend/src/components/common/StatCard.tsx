import { type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  icon?: LucideIcon;
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-gray-50 text-gray-700',
};

const iconColorMap = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  red: 'bg-red-100 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
};

export function StatCard({ label, value, sub, color = 'blue', icon: Icon }: StatCardProps) {
  return (
    <div className={clsx('rounded-xl border p-5 shadow-sm', colorMap[color])}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
          {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
        </div>
        {Icon && (
          <div className={clsx('flex h-12 w-12 items-center justify-center rounded-lg', iconColorMap[color])}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </div>
  );
}
