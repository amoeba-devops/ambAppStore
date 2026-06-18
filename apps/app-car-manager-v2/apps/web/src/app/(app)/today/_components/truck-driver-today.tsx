import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ChevronRight, ClipboardList, Truck } from 'lucide-react';
import { Badge, Card } from '@car-v2/ui';
import type { TripListItem } from '@/server/queries/trips.queries';
import type { DriverVehicleSummary } from '@/server/queries/vehicles.queries';

/** Truck driver's "Today" — their assigned truck trips split into "to complete"
 * vs "completed" (no dispatch confirmation flow). Each links to the trip detail
 * where the completion form lives. `vehicles` (Today only) shows the trucks the
 * driver has driven. */
export async function TruckDriverToday({
  trips,
  vehicles,
}: {
  trips: TripListItem[];
  vehicles?: DriverVehicleSummary[];
}) {
  const t = await getTranslations('today.truck');

  const logs = trips.filter((tr) => tr.trpKind === 'LOG');
  const todo = logs.filter((tr) => tr.trpStatus === 'CONFIRMED' || tr.trpStatus === 'IN_PROGRESS');
  const done = logs.filter((tr) => tr.trpStatus === 'COMPLETED');

  return (
    <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-6">
      <Section title={t('toComplete')} trips={todo} empty={t('noTodo')} tone="warning" />

      {vehicles && vehicles.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text">{t('myVehicles')}</h2>
          <Card variant="outline" className="divide-y divide-border">
            {vehicles.map((v) => (
              <div key={v.cvhId} className="flex items-center gap-3 px-4 py-3">
                <Truck className="h-4 w-4 text-text-faint shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-semibold text-text">{v.cvhPlateNumber}</div>
                  <div className="text-xs text-text-faint truncate">{v.cvhModel}</div>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      <Section title={t('completed')} trips={done} empty={t('noDone')} tone="success" />
    </div>
  );
}

function Section({
  title,
  trips,
  empty,
  tone,
}: {
  title: string;
  trips: TripListItem[];
  empty: string;
  tone: 'warning' | 'success';
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      {trips.length === 0 ? (
        <Card variant="outline" className="p-5 text-center text-sm text-text-muted">
          {empty}
        </Card>
      ) : (
        <ul className="space-y-2">
          {trips.map((tr) => (
            <li key={tr.trpId}>
              <Link
                href={`/trips/${tr.trpId}`}
                className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ClipboardList className="h-4 w-4 text-text-faint shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{tr.trpCustomer ?? tr.trpRef}</div>
                  <div className="text-xs text-text-faint truncate">
                    {tr.trpPickupAddress} → {tr.trpDropoffAddress}
                  </div>
                </div>
                <Badge tone={tone} size="sm">
                  {new Date(tr.trpScheduledAt).toLocaleDateString('vi-VN')}
                </Badge>
                <ChevronRight className="h-4 w-4 text-text-faint shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
