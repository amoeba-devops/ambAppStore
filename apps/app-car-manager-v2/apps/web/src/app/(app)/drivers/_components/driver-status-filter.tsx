'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@car-v2/ui';

type DriverFilter = 'active' | 'deleted' | 'all';

interface DriverStatusFilterProps {
  currentFilter: DriverFilter;
  currentSearch?: string;
  labels: {
    active: string;
    deleted: string;
    all: string;
  };
}

export function DriverStatusFilter({ currentFilter, currentSearch, labels }: DriverStatusFilterProps) {
  const router = useRouter();

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams();
    if (currentSearch) {
      params.set('q', currentSearch);
    }
    if (value !== 'active') {
      params.set('status', value);
    }
    const queryString = params.toString();
    router.push(`/drivers${queryString ? `?${queryString}` : ''}`);
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
