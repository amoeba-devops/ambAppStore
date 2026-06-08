'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@car-v2/ui';

type VehicleDeletedFilter = 'active' | 'deleted' | 'all';

interface VehicleDeletedFilterProps {
  currentFilter: VehicleDeletedFilter;
  labels: {
    active: string;
    deleted: string;
    all: string;
  };
}

export function VehicleDeletedFilter({ currentFilter, labels }: VehicleDeletedFilterProps) {
  const router = useRouter();

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams();
    // Add deleted filter (default is 'active', omit for cleaner URL)
    if (value !== 'active') {
      params.set('deleted', value);
    }
    const queryString = params.toString();
    router.push(`/vehicles${queryString ? `?${queryString}` : ''}`);
  };

  return (
    <Select value={currentFilter} onValueChange={handleFilterChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">{labels.active}</SelectItem>
        <SelectItem value="deleted">{labels.deleted}</SelectItem>
        <SelectItem value="all">{labels.all}</SelectItem>
      </SelectContent>
    </Select>
  );
}
