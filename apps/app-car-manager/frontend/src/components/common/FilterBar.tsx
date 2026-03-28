import { FilterChip } from './FilterChip';

export interface FilterItem {
  key: string;
  label: string;
  count?: number;
}

interface FilterBarProps {
  items: FilterItem[];
  selected: string;
  onChange: (key: string) => void;
  label?: string;
}

export function FilterBar({ items, selected, onChange, label }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="mr-1 text-sm font-medium text-gray-500">{label}</span>}
      {items.map((item) => (
        <FilterChip
          key={item.key}
          label={item.label}
          active={selected === item.key}
          count={item.count}
          onClick={() => onChange(item.key)}
        />
      ))}
    </div>
  );
}
