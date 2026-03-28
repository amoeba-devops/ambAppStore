import { clsx } from 'clsx';

interface FilterChipProps {
  label: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
}

export function FilterChip({ label, active, count, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={clsx(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold',
            active ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
