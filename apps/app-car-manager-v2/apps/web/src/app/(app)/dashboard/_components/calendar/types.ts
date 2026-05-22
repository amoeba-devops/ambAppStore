import type { CarTripStatus } from '@car-v2/db/schema';

export type CalendarViewType = 'month' | 'week' | 'day' | 'gantt';
export type CalendarColorMode = 'vehicle' | 'status';

/**
 * Active "filter" applied via toolbar quick chips or the custom-range
 * popover. `null` (no filter) means the calendar follows the default
 * `(view, anchor)` range. The quick kinds are derived dynamically from
 * `(view, anchor)` rather than stored — only `custom` carries explicit
 * start/end since it overrides the view's natural range.
 */
export type CalendarRangeFilter =
  | { kind: 'custom'; start: Date; end: Date };

export interface CalendarEvent {
  id: string;
  ref: string;
  title: string;
  start: Date;
  end: Date;
  status: CarTripStatus;
  creatorId: string;
  vehicleId: string | null;
  vehiclePlate: string;
  driverName: string;
  passengerName: string;
}

export interface CalendarVehicle {
  id: string;
  plate: string;
}
