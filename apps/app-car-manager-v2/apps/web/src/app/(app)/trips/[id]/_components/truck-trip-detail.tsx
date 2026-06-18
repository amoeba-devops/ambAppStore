import { getLocale, getTranslations } from 'next-intl/server';
import { Badge, Card } from '@car-v2/ui';
import type { TruckCostBreakdown } from '@car-v2/core/truck';
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

  return (
    <>
      <PageHeader
        title={props.tripRef}
        subtitle={props.completed ? t('statusDone') : t('statusOpen')}
        breadcrumbs={[
          { label: tCo('tenant') },
          { label: tNav('tripsMine'), href: '/trips' },
          { label: props.tripRef },
        ]}
        back="/trips"
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

        <section className="rounded-md border border-border divide-y divide-border">
          <InfoRow label={t('customer')} value={props.customer ?? '—'} />
          <InfoRow label={t('route')} value={`${props.pickup} → ${props.dropoff}`} />
          {props.bol && <InfoRow label={t('bol')} value={props.bol} mono />}
          {props.cdf && <InfoRow label={t('cdf')} value={props.cdf} mono />}
          {props.vehiclePlate && <InfoRow label={t('vehicle')} value={props.vehiclePlate} mono />}
          {props.driverName && <InfoRow label={t('driver')} value={props.driverName} />}
        </section>

        {props.completed ? (
          <Card variant="outline" className="p-4 space-y-2">
            <div className="text-sm font-semibold text-text mb-1">{t('costTitle')}</div>
            <CostRow label={t('fuel')} value={vnd(props.breakdown.fuelCost)} />
            <CostRow label={t('toll')} value={vnd(props.breakdown.tollFee)} />
            {props.extras.map((e, i) => (
              <CostRow key={i} label={e.name} value={vnd(e.amount)} />
            ))}
            <CostRow label={t('total')} value={vnd(props.breakdown.totalCost)} strong />
            <CostRow label={t('revenue')} value={vnd(props.breakdown.revenue)} />
            <CostRow
              label={t('profit')}
              value={vnd(props.breakdown.profit)}
              tone={props.breakdown.profit >= 0 ? 'success' : 'danger'}
              strong
            />
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
