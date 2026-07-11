'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@car-v2/ui';

type TripDeletedFilter = 'active' | 'deleted' | 'all';

interface TripDeletedFilterProps {
  currentFilter: TripDeletedFilter;
  /** Preserve current status/q/date/view params when changing deleted filter. */
  currentParams: {
    status?: string;
    q?: string;
    date?: string;
    view?: string;
  };
  labels: {
    active: string;
    deleted: string;
    all: string;
  };
}

export function TripDeletedFilter({ currentFilter, currentParams, labels }: TripDeletedFilterProps) {
  const router = useRouter();

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams();
    // Preserve existing params
    if (currentParams.view === 'list') params.set('view', 'list');
    if (currentParams.status && currentParams.status !== 'pending') params.set('status', currentParams.status);
    if (currentParams.q) params.set('q', currentParams.q);
    if (currentParams.date && currentParams.date !== 'all') params.set('date', currentParams.date);
    // Add deleted filter (default is 'active', omit for cleaner URL)
    if (value !== 'active') {
      params.set('deleted', value);
    }
    const queryString = params.toString();
    router.push(`/trips${queryString ? `?${queryString}` : ''}`);
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
