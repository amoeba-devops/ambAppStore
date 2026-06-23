import { getLocale, getTranslations } from 'next-intl/server';
import { MapPin, Navigation, PackageCheck, PackageOpen } from 'lucide-react';
import { Badge, Card } from '@car-v2/ui';
import type { TruckCostBreakdown } from '@car-v2/core/truck';
import type { CarTripStopover, CarStopType } from '@car-v2/db/schema';
import { MapPreview } from '@/components/inputs/map-preview';
import { PageHeader } from '@/components/layout/page-header';
import { TruckCompleteSection } from './truck-complete-section';

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
  breakdown: TruckCostBreakdown;
  completed: boolean;
  canComplete: boolean;
  /** Which completion action to call. */
  mode: 'driver' | 'staff';
  /** Back link + parent breadcrumb (manager opens from /truck/trips). */
  backHref?: string;
  parentLabel?: string;
  /** Header actions (manager: edit/delete). */
  actions?: React.ReactNode;
  /** Drivers don't see revenue/profit — only the cost total. */
  hideFinancials?: boolean;
  /** Ordered stopovers (REQ-20260623). When empty, falls back to pickup→dropoff display. */
  stopovers?: CarTripStopover[];
}

/** Truck (LOG) trip detail — read-only breakdown when completed, otherwise the
 * completion section. Rendered by the trip detail page's LOG branch so the car
 * dispatch detail stays untouched. */
export async function TruckTripDetail(props: TruckTripDetailProps) {
  const t = await getTranslations('screens.truckTripDetail');
  const tCo = await getTranslations('company');
  const tNav = await getTranslations('nav');
  const locale = await getLocale();
  const loc = bcp47(locale);
  const vnd = (n: number) => n.toLocaleString(loc) + ' ₫';
  const backHref = props.backHref ?? '/trips';
  const parentLabel = props.parentLabel ?? tNav('tripsMine');

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

      <div className="flex-1 overflow-auto px-4 md:px-7 py-5 md:py-6 w-full max-w-2xl space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge tone={props.completed ? 'success' : 'warning'} size="md">
            {props.completed ? t('statusDone') : t('statusOpen')}
          </Badge>
          <span className="text-sm text-text-muted tabular">
            {new Date(props.scheduledAt).toLocaleDateString(loc)}
          </span>
        </div>

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

        {props.completed ? (
          <Card variant="outline" className="p-4 space-y-2">
            <div className="text-sm font-semibold text-text mb-1">{t('costTitle')}</div>
            <CostRow label={t('fuel')} value={vnd(props.breakdown.fuelCost)} />
            <CostRow label={t('toll')} value={vnd(props.breakdown.tollFee)} />
            {props.extras.map((e, i) => (
              <CostRow key={i} label={e.name} value={vnd(e.amount)} />
            ))}
            <CostRow label={t('total')} value={vnd(props.breakdown.totalCost)} strong />
            {!props.hideFinancials && (
              <>
                <CostRow label={t('revenue')} value={vnd(props.breakdown.revenue)} />
                <CostRow
                  label={t('profit')}
                  value={vnd(props.breakdown.profit)}
                  tone={props.breakdown.profit >= 0 ? 'success' : 'danger'}
                  strong
                />
              </>
            )}
          </Card>
        ) : props.canComplete ? (
          <TruckCompleteSection tripId={props.tripId} mode={props.mode} />
        ) : (
          <div className="text-sm text-text-muted">{t('notCompletable')}</div>
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
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'success' | 'danger';
}) {
  return (
    <div className={'flex items-center justify-between text-sm ' + (strong ? 'pt-2 border-t border-border font-semibold' : '')}>
      <span className="text-text-muted">{label}</span>
      <span
        className={
          'tabular ' +
          (tone === 'success' ? 'text-success font-semibold' : tone === 'danger' ? 'text-danger font-semibold' : 'text-text')
        }
      >
        {value}
      </span>
    </div>
  );
}
