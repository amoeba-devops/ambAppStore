import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle, Edit3, Wallet } from 'lucide-react';
import { Badge, Button, Card } from '@car-v2/ui';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { getTrip } from '@/server/queries/trips.queries';
import { getTripStopovers } from '@/server/queries/stopovers.queries';
import { getDriverByUserId } from '@/server/queries/drivers.queries';
import {
  getTripExtraCosts,
  getTripCostAttachmentsView,
  getTruckTripBreakdown,
} from '@/server/queries/truck-trips.queries';
import { getLatestTruckReportForMonth } from '@/server/queries/truck-report.queries';
import { completeInitialOf } from '@/lib/truck-complete-initial';
import { PageHeader } from '@/components/layout/page-header';
import { TruckCompleteSection } from '@/components/truck/truck-complete-section';
import { StopUpdateList } from './_components/stop-update-list';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

/** Driver truck-trip page (REQ-20260623 stop updates + REQ-20260803 self-edit).
 *
 * Three things a driver does with a trip they own, in the order they need them:
 * record what happened at each stop, see what the trip has cost so far, and
 * correct either after the fact. Revenue and profit stay off this screen — a
 * driver never sees the money side (same rule as the shared trip detail). */
export default async function DriverTruckTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  requireRole(user.role, ['DRIVER']);
  await requireFleet(user, 'TRUCK');

  const driver = await getDriverByUserId(user.entId, user.userId);
  const trip = await getTrip(user.entId, id);

  if (!trip || trip.trpKind !== 'LOG' || !driver || trip.trpDriverId !== driver.drvId) {
    notFound();
  }

  const tripMonth = new Date(trip.trpScheduledAt).toISOString().slice(0, 7);
  const [stopovers, extras, monthReport, costAttachments] = await Promise.all([
    getTripStopovers(user.entId, trip.trpId),
    getTripExtraCosts(user.entId, trip.trpId),
    getLatestTruckReportForMonth(user.entId, tripMonth),
    getTripCostAttachmentsView(user.entId, trip.trpId),
  ]);
  const { breakdown, fuelLiters, fuelUnitPrice } = await getTruckTripBreakdown(
    user.entId,
    trip,
    extras.map((e) => e.amount),
  );

  const t = await getTranslations('today.truck');
  const tDetail = await getTranslations('screens.truckTripDetail');
  const tTrips = await getTranslations('screens.truckTrips');
  const locale = await getLocale();
  const loc = bcp47(locale);
  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';

  const completed = trip.trpStatus === 'COMPLETED';
  /* The reason this page exists (BUG-260810): the driver's trip cards point
   * here, not at the shared `/trips/[id]`, so this is the only screen where a
   * truck driver can close their own trip. Same gate core enforces in
   * `completeTruckTrip` — ownership is already settled by the notFound above. */
  const canComplete =
    !completed && (trip.trpStatus === 'CONFIRMED' || trip.trpStatus === 'IN_PROGRESS');
  const editHref = `/today/truck/${trip.trpId}/edit`;

  /* The fuel figure IS the driver's own entry now (litres × unit price — user
   * rule 2026-08-18: trip screens track reality, allocation lives on the
   * finance screens), so just spell the arithmetic out under it. */
  const fuelNote =
    fuelLiters > 0 && fuelUnitPrice > 0
      ? `${fuelLiters.toLocaleString(loc)} L × ${vnd(fuelUnitPrice)}/L`
      : undefined;

  const editButton = (
    <Button asChild variant="secondary" size="md">
      <Link href={editHref}>
        <Edit3 className="h-4 w-4" />
        {t('editTrip')}
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        title={trip.trpRef}
        subtitle={trip.trpPickupAddress + ' → ' + trip.trpDropoffAddress}
        breadcrumbs={[{ label: t('title'), href: '/today' }, { label: trip.trpRef }]}
        /* Default 'breadcrumb' variant on purpose: 'brand' is for home routes
         * and renders neither the back chevron nor the action slot, which left
         * the driver with no way back from a trip on a phone. */
        back="/today"
        actions={editButton}
        mobileAction={
          <Link
            href={editHref}
            aria-label={t('editTrip')}
            className="inline-flex items-center justify-center h-10 w-10 rounded-full text-text hover:bg-surface-2 active:bg-surface-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Edit3 className="h-5 w-5" />
          </Link>
        }
      />
      <div className="flex-1 overflow-auto px-4 md:px-7 py-5 w-full space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone={completed ? 'success' : 'warning'} size="md">
            {completed ? tDetail('statusDone') : tDetail('statusOpen')}
          </Badge>
          <span className="text-sm text-text-muted tabular">
            {new Date(trip.trpScheduledAt).toLocaleDateString(loc)}
          </span>
          {trip.vehiclePlate && (
            <span className="text-sm font-mono text-text-muted">{trip.vehiclePlate}</span>
          )}
        </div>

        {/* Reported month — soft warning (no lock): editing stays allowed, the
          * official numbers refresh on the next report generation. */}
        {monthReport && (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm text-text">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>{tTrips('reportedMonthBanner')}</span>
          </div>
        )}

        {/* Closing the trip is the whole point of the screen for an open trip,
          * so it leads — above the costs even on a phone. Collapsed it is a
          * single button; expanded it becomes the completion form (the same one
          * staff use), which is why it sits full-width rather than in the
          * narrow cost rail. */}
        {canComplete && (
          <TruckCompleteSection
            tripId={trip.trpId}
            mode="driver"
            existingAttachments={costAttachments}
            initial={{ ...completeInitialOf(trip), extras }}
          />
        )}

        {/* On a phone the money comes first — it is what the driver opened the
          * screen for. On a wide screen the stop list becomes the main column
          * and the costs move to a side rail, matching the driver's Today. */}
        <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
          {/* Costs the driver recorded, with the way back into them. Revenue
            * and profit are deliberately absent. */}
          <Card variant="outline" className="order-1 p-4 space-y-2.5 lg:order-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-text">{t('costsTitle')}</h2>
            </div>
            <CostRow label={tDetail('fuel')} value={vnd(breakdown.fuelCost)} note={fuelNote} />
            <CostRow label={tDetail('toll')} value={vnd(breakdown.tollFee)} />
            {extras.map((e, i) => (
              <CostRow key={i} label={e.name} value={vnd(e.amount)} />
            ))}
            <CostRow label={tDetail('total')} value={vnd(breakdown.totalCost)} strong />
            {/* Secondary while the trip is open — the completion form above is
              * the primary action and captures the same figures. */}
            <Button
              asChild
              variant={canComplete ? 'secondary' : 'accent'}
              size="lg"
              className="w-full mt-1"
            >
              <Link href={editHref}>{t('updateCosts')}</Link>
            </Button>
          </Card>

          <section className="order-2 space-y-2.5 lg:order-1 lg:col-span-2">
            <h2 className="text-sm font-semibold text-text">{t('stopsTitle')}</h2>
            <StopUpdateList tripId={id} stopovers={stopovers} />
          </section>
        </div>
      </div>
    </>
  );
}

function CostRow({
  label,
  value,
  strong,
  note,
}: {
  label: string;
  value: string;
  strong?: boolean;
  /** Muted line under the value — explains a figure that needs it. */
  note?: string;
}) {
  return (
    <div className={'text-sm ' + (strong ? 'pt-2 border-t border-border font-semibold' : '')}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-text-muted">{label}</span>
        <span className="tabular text-text">{value}</span>
      </div>
      {/* Full-width so a long explanation never squeezes the label in the
        * narrow desktop rail. */}
      {note && <p className="mt-0.5 text-xs font-normal leading-snug text-text-faint">{note}</p>}
    </div>
  );
}
