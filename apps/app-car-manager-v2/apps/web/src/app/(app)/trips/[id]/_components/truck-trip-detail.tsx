import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Edit3, FileText, MapPin, Navigation, PackageCheck, PackageOpen } from 'lucide-react';
import { Badge, Button, Card } from '@car-v2/ui';
import type { TruckCostBreakdown } from '@car-v2/core/truck';
import type { CarTripStopover, CarStopType } from '@car-v2/db/schema';
import { MapPreview } from '@/components/inputs/map-preview';
import { PageHeader } from '@/components/layout/page-header';
import { ReportStatusBadge } from '@/components/truck/report-status-badge';
import { FuelReconciliationBadge, type FuelBadgeMode } from '@/components/truck/fuel-reconciliation-badge';
import type { TruckReportStatus } from '@/server/queries/truck-report.queries';
import {
  TruckCompleteSection,
  type CompleteSectionInitial,
} from '@/components/truck/truck-complete-section';

function bcp47(locale: string): string {
  if (locale === 'vi') return 'vi-VN';
  if (locale === 'ko') return 'ko-KR';
  return 'en-US';
}

export interface TruckTripDetailProps {
  tripId: string;
  tripRef: string;
  status: string;
  scheduledAt: Date;
  customer: string | null;
  bol: string | null;
  cdf: string | null;
  pickup: string;
  dropoff: string;
  vehiclePlate: string | null;
  driverName: string | null;
  extras: { name: string; amount: number }[];
  /** Receipt/invoice attachments grouped by cost kind (REQ-20260709). `s3Key`
   * is carried so the completion form can echo kept attachments back on save. */
  costAttachments?: {
    id: string;
    costKind: 'FUEL' | 'TOLL' | 'EXTRA';
    s3Key: string;
    mime: string;
    sizeBytes: number;
    signedUrl: string | null;
  }[];
  breakdown: TruckCostBreakdown;
  /** How `breakdown.fuelCost` was derived: AVERAGED | LIVE | UNSET —
   * undefined when the trip isn't completed yet (no fuel cost to qualify). */
  fuelMode?: FuelBadgeMode;
  /** This trip's km + cost per km — rendered under the fuel row as
   * `{km} km × {đ}/km` so the figure explains itself (REQ-20260724 UX). */
  fuelKm?: number;
  fuelCostPerKm?: number;
  /** "Nhiên liệu thực tế" — the trip's OWN spend (litres × price it recorded).
   * Shown as its own row above the allocated one (REQ-20260822) so the two
   * concepts are never mistaken for each other: this is the money this trip
   * paid, the allocated row is its share of the vehicle's monthly fuel. */
  fuelActualCost?: number;
  /** This trip's slice of the month's fixed cost + the profit after it
   * (Sheet3 "phân bổ theo chuyến" / "Lợi nhuận theo chuyến"). */
  salaryAllocated?: number;
  depreciationAllocated?: number;
  profitAfterFixed?: number;
  /** How many trips the month's fixed cost was split across. */
  fixedTripCount?: number;
  completed: boolean;
  canComplete: boolean;
  /** Figures already on the trip, seeded into the completion form. `extras`
   * comes from `extras` above — this carries the scalars only. */
  completeInitial?: Omit<CompleteSectionInitial, 'extras'>;
  /** Which completion action to call. */
  mode: 'driver' | 'staff';
  /** Back link + parent breadcrumb (manager opens from /truck/trips). */
  backHref?: string;
  parentLabel?: string;
  /** Header actions (manager: edit/delete). Desktop only — `PageHeader` never
   * mirrors `actions` into the mobile app bar. */
  actions?: React.ReactNode;
  /** Edit destination for the viewer, rendered inline in the body so it also
   * reaches a phone (see the button below). A driver arriving from a
   * notification link lands here rather than on their own `/today/truck/[id]`,
   * so without this they had no way to correct the trip. */
  editHref?: string;
  /** Drivers don't see revenue/profit — only the cost total. */
  hideFinancials?: boolean;
  /** Ordered stopovers (REQ-20260623). When empty, falls back to pickup→dropoff display. */
  stopovers?: CarTripStopover[];
  /** When was the report covering this trip's (month, region) last generated,
   * and is it stale — null when the trip isn't completed yet (no cost card). */
  reportStatus?: TruckReportStatus | null;
}

/** Truck (LOG) trip detail — read-only breakdown when completed, otherwise the
 * completion section. Rendered by the trip detail page's LOG branch so the car
 * dispatch detail stays untouched. */
export async function TruckTripDetail(props: TruckTripDetailProps) {
  const t = await getTranslations('screens.truckTripDetail');
  const tCo = await getTranslations('company');
  const tNav = await getTranslations('nav');
  const tToday = await getTranslations('today.truck');
  const locale = await getLocale();
  const loc = bcp47(locale);
  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const backHref = props.backHref ?? '/trips';
  const parentLabel = props.parentLabel ?? tNav('tripsMine');

  /* Trip facts (map + info rows + stopover timeline) — the "what/where" of the
   * trip. Shared between the completed 2-column layout (main column) and the
   * open-trip single column. A fragment so the parent's `space-y-*` spaces the
   * rows directly. */
  const infoBlock = (
    <>
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY && (
        <MapPreview pickup={props.pickup} dropoff={props.dropoff} stopovers={[]} showFullscreenLink />
      )}
      <section className="rounded-md border border-border divide-y divide-border">
        <InfoRow label={t('customer')} value={props.customer ?? '—'} />
        {(!props.stopovers || props.stopovers.length === 0) && (
          <InfoRow label={t('route')} value={`${props.pickup} → ${props.dropoff}`} />
        )}
        {props.bol && <InfoRow label={t('bol')} value={props.bol} mono />}
        {props.cdf && <InfoRow label={t('cdf')} value={props.cdf} mono />}
        {props.vehiclePlate && <InfoRow label={t('vehicle')} value={props.vehiclePlate} mono />}
        {props.driverName && <InfoRow label={t('driver')} value={props.driverName} />}
      </section>
      {props.stopovers && props.stopovers.length > 0 && (
        <StopoverTimeline stopovers={props.stopovers} locale={locale} />
      )}
    </>
  );

  const costCard = (
    <Card variant="outline" className="p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-sm font-semibold text-text">{t('costTitle')}</div>
        {props.reportStatus && (
          <ReportStatusBadge reportedAt={props.reportStatus.reportedAt} stale={props.reportStatus.stale} covered={props.reportStatus.covered} locale={locale} />
        )}
      </div>
      {/* Two distinct fuel concepts, spelled out (REQ-20260822): what this trip
        * paid, then its share of the vehicle's monthly fuel. Only the allocated
        * one feeds Tổng chi phí / Lợi nhuận below, so those keep matching the
        * finance screen and the report. */}
      {(props.fuelActualCost ?? 0) > 0 && (
        <CostRow label={t('fuelActual')} value={vnd(props.fuelActualCost as number)} note={t('fuelActualNote')} />
      )}
      <CostRow
        label={t('fuelAllocated')}
        value={vnd(props.breakdown.fuelCost)}
        badge={props.fuelMode !== undefined ? <FuelReconciliationBadge mode={props.fuelMode} /> : undefined}
        note={
          props.fuelMode && props.fuelMode !== 'UNSET' && (props.fuelKm ?? 0) > 0
            ? `${(props.fuelKm as number).toLocaleString(loc)} km × ${vnd(props.fuelCostPerKm ?? 0)}/km`
            : undefined
        }
      />
      <CostRow label={t('toll')} value={vnd(props.breakdown.tollFee)} />
      {props.extras.map((e, i) => (
        <CostRow key={i} label={e.name} value={vnd(e.amount)} />
      ))}
      <CostRow label={t('total')} value={vnd(props.breakdown.totalCost)} strong />
      {!props.hideFinancials && (
        <>
          {/* Fixed cost allocated to this trip (Sheet3 "phân bổ theo chuyến") —
            * monthly salary/depreciation ÷ the vehicle's trips that month. */}
          {(props.salaryAllocated ?? 0) > 0 && (
            <CostRow
              label={t('salaryAllocated')}
              value={vnd(props.salaryAllocated as number)}
              note={props.fixedTripCount ? t('allocNote', { count: props.fixedTripCount }) : undefined}
            />
          )}
          {(props.depreciationAllocated ?? 0) > 0 && (
            <CostRow label={t('depreciationAllocated')} value={vnd(props.depreciationAllocated as number)} />
          )}
          <CostRow label={t('revenue')} value={vnd(props.breakdown.revenue)} />
          <CostRow
            label={t('profit')}
            value={vnd(props.profitAfterFixed ?? props.breakdown.profit)}
            tone={(props.profitAfterFixed ?? props.breakdown.profit) >= 0 ? 'success' : 'danger'}
            strong
          />
        </>
      )}
    </Card>
  );

  /* Receipt/invoice attachments (REQ-20260709), grouped by cost kind. Server-
   * rendered read-only tiles — images inline, PDFs as an open-in-new-tab tile.
   * Omitted entirely when the trip carries no attachments. */
  const attachments = props.costAttachments ?? [];
  const receiptGroups: { kind: 'FUEL' | 'TOLL' | 'EXTRA'; label: string }[] = [
    { kind: 'FUEL', label: t('fuel') },
    { kind: 'TOLL', label: t('toll') },
    { kind: 'EXTRA', label: t('receiptsExtra') },
  ];
  const receiptsCard =
    attachments.length > 0 ? (
      <Card variant="outline" className="p-4 space-y-3">
        <div className="text-sm font-semibold text-text">{t('receiptsTitle')}</div>
        {receiptGroups.map((g) => {
          const items = attachments.filter((a) => a.costKind === g.kind);
          if (items.length === 0) return null;
          return (
            <div key={g.kind} className="space-y-1.5">
              <div className="text-xs text-text-muted uppercase tracking-wide">{g.label}</div>
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {items.map((a) => (
                  <li key={a.id} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-surface-2">
                    {a.signedUrl ? (
                      <a href={a.signedUrl} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                        {a.mime.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.signedUrl} alt={g.label} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-text-muted">
                            <FileText className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                            <span className="text-[10px] font-semibold uppercase tracking-wide">
                              {a.mime.replace(/^application\//, '')}
                            </span>
                          </div>
                        )}
                      </a>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-text-faint">
                        <FileText className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Card>
    ) : null;

  /* Edit affordance in the BODY, not the header: `PageHeader.actions` is
   * desktop-only by design (Edit/Delete are meant to sit inline in the page's
   * primary card on mobile), and this component asks for the 'brand' mobile bar,
   * which drops the action slot entirely. A driver on a phone is exactly the
   * viewer who needs this, so a header button would have been invisible to them. */
  const editButton = props.editHref ? (
    <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
      <Link href={props.editHref}>
        <Edit3 className="h-4 w-4" />
        {tToday('editTrip')}
      </Link>
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title={props.tripRef}
        subtitle={props.completed ? t('statusDone') : t('statusOpen')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: parentLabel, href: backHref },
          { label: props.tripRef },
        ]}
        back={backHref}
        actions={props.actions}
        mobileVariant="brand"
      />

      {/* `pb-24` clears the fixed BottomTabNav on mobile. The shell reserves
        * that band on <main>, but this page's content makes <main> taller than
        * the viewport, which pushes its padding off-screen — so scrolled to the
        * end, the last element sits under the nav. Measured: the edit button
        * below landed at y=788..828 with the nav covering 787..844, i.e. its
        * lower half was untappable. Same per-page padding the driver's Today
        * already applies for the same reason. */}
      <div className="flex-1 overflow-auto px-4 md:px-7 pt-5 md:pt-6 pb-24 md:pb-6 w-full space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone={props.completed ? 'success' : 'warning'} size="md">
            {props.completed ? t('statusDone') : t('statusOpen')}
          </Badge>
          <span className="text-sm text-text-muted tabular">
            {new Date(props.scheduledAt).toLocaleDateString(loc)}
          </span>
        </div>

        {props.completed ? (
          /* Completed trips are read-only: trip info + route fill the main column
           * and the cost/profit breakdown sits in a side rail, so the detail uses
           * the full desktop width instead of a narrow center strip. Mobile stacks. */
          <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
            <div className="space-y-5 lg:col-span-2">{infoBlock}</div>
            <div className="space-y-5">
              {costCard}
              {/* Right after the figures — "these are wrong" is the reason a
                * driver opens a finished trip at all. */}
              {editButton}
              {receiptsCard}
            </div>
          </div>
        ) : (
          /* Open trips lead with the completion form, kept at a comfortable
           * reading width (the focused task, not a wide dashboard). */
          <div className="max-w-3xl space-y-5">
            {infoBlock}
            {props.canComplete ? (
              <TruckCompleteSection
                tripId={props.tripId}
                mode={props.mode}
                existingAttachments={attachments}
                initial={{ ...props.completeInitial, extras: props.extras }}
              />
            ) : (
              <div className="text-sm text-text-muted">{t('notCompletable')}</div>
            )}
            {/* Secondary to completing — an open trip is normally closed from
              * here, corrected only if something was typed wrong earlier. */}
            {editButton}
            {receiptsCard}
          </div>
        )}
      </div>
    </>
  );
}

const STOP_ICONS: Record<CarStopType, React.ElementType> = {
  ORIGIN: Navigation,
  PICKUP: PackageOpen,
  DELIVERY: PackageCheck,
  WAYPOINT: MapPin,
  RETURN: Navigation,
};

const STOP_TYPE_LABEL: Record<CarStopType, string> = {
  ORIGIN: 'Xuất phát',
  PICKUP: 'Lấy hàng',
  DELIVERY: 'Giao hàng',
  WAYPOINT: 'Điểm ghé',
  RETURN: 'Về bãi',
};

function StopoverTimeline({ stopovers, locale }: { stopovers: CarTripStopover[]; locale: string }) {
  const sorted = [...stopovers].sort((a, b) => a.tstOrder - b.tstOrder);
  const loc = locale === 'vi' ? 'vi-VN' : locale === 'ko' ? 'ko-KR' : 'en-US';
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Lộ trình</div>
      <div className="space-y-0">
        {sorted.map((stop, idx) => {
          const Icon = STOP_ICONS[stop.tstType];
          const isLast = idx === sorted.length - 1;
          return (
            <div key={stop.tstId} className="flex gap-3">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                    stop.tstType === 'PICKUP'
                      ? 'bg-warning/15 text-warning'
                      : stop.tstType === 'DELIVERY'
                        ? 'bg-success/15 text-success'
                        : 'bg-surface-2 text-text-faint'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {!isLast && <div className="w-px flex-1 min-h-[20px] bg-border my-1" />}
              </div>
              <div className="flex-1 pb-3 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-text-muted">{STOP_TYPE_LABEL[stop.tstType]}</span>
                  {stop.tstKm != null && (
                    <span className="text-xs tabular font-mono text-text-faint">{stop.tstKm.toLocaleString(loc)} km</span>
                  )}
                  {stop.tstArrivedAt && (
                    <span className="text-xs text-text-faint">
                      {new Date(stop.tstArrivedAt).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="text-sm text-text mt-0.5 truncate">{stop.tstAddress}</div>
                {stop.tstNotes && <div className="text-xs text-text-muted mt-0.5 italic">{stop.tstNotes}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-2.5">
      <span className="text-xs text-text-faint uppercase tracking-wide shrink-0">{label}</span>
      <span className={'text-sm text-text text-right ' + (mono ? 'font-mono tabular' : '')}>{value}</span>
    </div>
  );
}

function CostRow({
  label,
  value,
  strong,
  tone,
  badge,
  note,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'success' | 'danger';
  badge?: React.ReactNode;
  /** Small muted line under the value — used to spell out the fuel arithmetic. */
  note?: string;
}) {
  return (
    <div className={'flex items-start justify-between text-sm ' + (strong ? 'pt-2 border-t border-border font-semibold' : '')}>
      <span className="text-text-muted">{label}</span>
      <span className="inline-flex flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={
              'tabular ' +
              (tone === 'success' ? 'text-success font-semibold' : tone === 'danger' ? 'text-danger font-semibold' : 'text-text')
            }
          >
            {value}
          </span>
          {badge}
        </span>
        {note && <span className="text-xs font-normal text-text-faint">{note}</span>}
      </span>
    </div>
  );
}
