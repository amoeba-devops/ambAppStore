import type { LocalRole } from '@car-v2/shared/auth';
import type { CalendarEvent } from './types';

/**
 * Mirrors permission rules in `updateTripAction`
 * ([trip.actions.ts:209-226](../../../../server/actions/trips/trip.actions.ts#L209-L226)).
 * Keep in sync when those rules change — server is the final authority,
 * but UX needs to reflect them up front (cursor, disabled draggable).
 */
export function canDragTrip(role: LocalRole, _userId: string, ev: CalendarEvent): boolean {
  if (role === 'DRIVER') return false;
  /* Staff (Admin/Manager) */
  return ev.status !== 'COMPLETED';
}
