import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: 'green' | 'blue' | 'red' | 'yellow' | 'gray';
  sub?: string;
}

const colorMap = {
  green: 'bg-green-50 text-green-600',
  blue: 'bg-blue-50 text-blue-600',
  red: 'bg-red-50 text-red-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  gray: 'bg-gray-50 text-gray-600',
};

export function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  return (
    <div className="rounded-[10px] border border-[#e2e5eb] bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] text-gray-400">{label}</p>
          <p className="mt-1 text-[28px] font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
