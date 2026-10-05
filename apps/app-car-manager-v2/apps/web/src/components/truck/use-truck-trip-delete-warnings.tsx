'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';
import { Button } from '@car-v2/ui';
import type { DeleteWarning, DeleteWarningRef } from '@/components/dialogs/confirm-delete-dialog';
import { formatDayKey } from '@/lib/format-day';
import { getTruckTripDeleteImpactAction } from '@/server/actions/trips/truck-trip.actions';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

/**
 * Confirm-dialog options for deleting a truck trip (BUG-261005 follow-up):
 * loads the knock-on effects — sibling trips whose allocated fuel moves, and
 * the vehicle-month losing its salary + depreciation — so they are visible
 * BEFORE the user confirms.
 *
 *   const warnings = useTruckTripDeleteWarnings();
 *   await confirm(t('deleteConfirm'), warnings(tripId));
 */
export function useTruckTripDeleteWarnings() {
  const t = useTranslations('screens.truckTripDetail.deleteImpact');
  const locale = useLocale();
  const loc = bcp47(locale);

  return useCallback(
    (tripId: string) => {
      const vnd = (n: number) => `${n.toLocaleString(loc)} ₫`;
      const fetchWarnings = async (): Promise<DeleteWarning[]> => {
        const res = await getTruckTripDeleteImpactAction({ trip_id: tripId });
        if (!res.success) {
          /* The delete itself still goes through its own checks; a failed
           * preview must not block it, but must not claim "no impact" either. */
          return [{ type: 'impact_unavailable', count: 0, message: t('failed') }];
        }
        const impact = res.data;
        if (!impact) return [];
        const plate = impact.vehiclePlate ?? '—';
        /* "MM/YYYY" in every locale — the vi long form already says "tháng",
         * which doubled up with the message's own "tháng {month}". */
        const [yy, mm] = impact.month.split('-');
        const month = `${mm}/${yy}`;
        const out: DeleteWarning[] = [];
        if (impact.fuelShifts.length > 0) {
          out.push({
            type: 'fuel_realloc',
            count: impact.fuelShifts.length,
            message: t('fuelRealloc', { count: impact.fuelShifts.length, plate, month }),
            refs: impact.fuelShifts.slice(0, 3).map((s) => ({
              id: s.tripId,
              label: s.ref,
              subtitle: t('fuelChange', {
                /* Trip day key (UTC midnight) → the app's dd/mm/yyyy form. */
                date: formatDayKey(new Date(s.scheduledAt).toISOString().slice(0, 10), loc),
                before: vnd(s.before),
                after: vnd(s.after),
              }),
              href: `/truck/trips/${s.tripId}`,
            })),
          });
        }
        if (impact.lastTripOfMonth) {
          out.push({
            type: 'fixed_cost_month',
            count: 1,
            message: t('lastTrip', {
              plate,
              month,
              salary: vnd(impact.lastTripOfMonth.salary),
              depreciation: vnd(impact.lastTripOfMonth.depreciation),
            }),
          });
        }
        return out;
      };
      return {
        fetchWarnings,
        warningLabels: {
          loading: t('checking'),
          hasWarnings: t('found'),
          noWarnings: t('none'),
          more: (count: number) => t('more', { count }),
        },
        renderRefDetail: (ref: DeleteWarningRef) => (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-text">{ref.label}</div>
              {ref.subtitle && <div className="text-sm text-text-muted">{ref.subtitle}</div>}
            </div>
            {ref.href && (
              <Button asChild variant="secondary" size="md" iconLeft={<ExternalLink className="h-4 w-4" />}>
                <Link href={ref.href} target="_blank" rel="noopener">
                  {t('openTrip')}
                </Link>
              </Button>
            )}
          </div>
        ),
      };
    },
    [t, loc],
  );
}
