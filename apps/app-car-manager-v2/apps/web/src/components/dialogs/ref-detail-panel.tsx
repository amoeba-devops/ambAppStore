'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  Calendar,
  Car,
  Clock,
  Fuel,
  Receipt,
  User,
  Wrench,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, chartColors, cn, Spinner } from '@car-v2/ui';
import type { CarTripStatus, CarExpenseStatus, CarExpenseType } from '@car-v2/db/schema';
import type { DeleteWarningRef } from './confirm-delete-dialog';
import { getRefDetailAction, type RefDetailData } from '@/server/actions/drivers/ref-detail.actions';
import { MapPreview } from '@/components/inputs/map-preview';

const TRIP_STATUS_TONE: Record<CarTripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT: 'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED: 'success',
  IN_PROGRESS: 'info',
  COMPLETED: 'neutral',
  REJECTED_BY_DRIVER: 'danger',
  CANCELLED: 'danger',
};

const EXPENSE_STATUS_TONE: Record<CarExpenseStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  AUTO_APPROVED: 'success',
  REJECTED: 'danger',
};

const TYPE_COLOR: Record<CarExpenseType, string> = {
  FUEL: chartColors[0],
  REPAIR: chartColors[1],
  MEAL: chartColors[2],
  OIL: chartColors[3],
  ACCIDENT: chartColors[4],
  PARKING: chartColors[5],
  TOLL: chartColors[6],
  INSPECTION: chartColors[7],
};

interface RefDetailPanelProps {
  refData: DeleteWarningRef;
}

export function RefDetailPanel({ refData }: RefDetailPanelProps) {
  const tTrips = useTranslations('trips');
  const tExpenses = useTranslations('expenses');
  const tCosts = useTranslations('costs');
  const tPeek = useTranslations('expenses.peek');
  const locale = useLocale();
  const bcp = locale === 'ko' ? 'ko-KR' : locale === 'en' ? 'en-US' : 'vi-VN';

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<RefDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getRefDetailAction(refData.type, refData.id)
      .then((result) => {
        if (result.success) {
          setDetail(result.data);
        } else {
          setError(result.error?.message ?? 'Failed to load details');
        }
      })
      .catch(() => setError('Failed to load details'))
      .finally(() => setLoading(false));
  }, [refData.type, refData.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p>{error ?? 'No data found'}</p>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * TRIP DETAIL — mirrors /trips/[id] layout
   * Status strip + Route timeline + Properties
   * ───────────────────────────────────────────────────────────────────────── */
  if (detail.type === 'trip') {
    const trip = detail.trip;
    const scheduledDate = new Date(trip.scheduledAt);
    const fmtDateTime = scheduledDate.toLocaleString(bcp, { dateStyle: 'medium', timeStyle: 'short' });

    return (
      <div className="space-y-5">
        {/* Status strip */}
        <div className="flex items-center gap-3 flex-wrap pb-4 border-b border-border">
          <Badge tone={TRIP_STATUS_TONE[trip.status]} size="md" className="px-3 py-1 text-[13px] font-semibold">
            {tTrips(`status.${trip.status}`)}
          </Badge>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-text tabular">
            <Clock className="h-4 w-4 text-text-muted shrink-0" aria-hidden />
            {fmtDateTime}
          </div>
        </div>

        {/* Route timeline */}
        <section>
          <SectionTitle>{tTrips('detail.routeTitle')}</SectionTitle>
          <RouteTimeline
            pickup={trip.pickupAddress}
            dropoff={trip.dropoffAddress}
            labels={{
              pickup: tTrips('detail.pickup'),
              dropoff: tTrips('detail.dropoff'),
            }}
          />
        </section>

        {/* Map preview */}
        <MapPreview
          pickup={trip.pickupAddress}
          dropoff={trip.dropoffAddress}
          showFullscreenLink
          className="pt-2"
          heightClassName="h-[180px]"
        />

        {/* Properties */}
        <section className="pt-4 border-t border-border">
          <SectionTitle>{tTrips('detail.detailsTitle')}</SectionTitle>
          <dl className="divide-y divide-border-faint border-y border-border-faint -mt-1">
            <PropertyRow
              icon={<User />}
              label={tTrips('detail.passenger')}
              value={trip.passengerName ?? tTrips('detail.passengerUnspecified')}
              muted={!trip.passengerName}
            />
            <PropertyRow
              icon={<Car />}
              label={tTrips('detail.vehicle')}
              value={trip.vehiclePlate ?? tTrips('detail.notAssigned')}
              muted={!trip.vehiclePlate}
              mono={!!trip.vehiclePlate}
            />
          </dl>
        </section>

        {/* Purpose */}
        {trip.purpose && (
          <section className="pt-4 border-t border-border">
            <SectionTitle>{tTrips('detail.purposeTitle')}</SectionTitle>
            <p className="text-sm text-text leading-relaxed">{trip.purpose}</p>
          </section>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-border">
          <Button variant="ghost" size="md" className="w-full" iconRight={<ArrowUpRight />} asChild>
            <Link href={`/trips/${trip.id}`} target="_blank">
              {tPeek('openFull')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * EXPENSE DETAIL — mirrors expense-peek-drawer layout
   * Hero (icon + type + amount) + Fact grid + Note
   * ───────────────────────────────────────────────────────────────────────── */
  if (detail.type === 'expense') {
    const expense = detail.expense;
    const TypeIcon = expense.expenseType === 'FUEL' ? Fuel : expense.expenseType === 'REPAIR' ? Wrench : Receipt;
    const amount = `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(expense.amount))}₫`;
    const occurredAt = new Date(expense.occurredAt).toLocaleDateString(bcp, { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
      <div className="space-y-4">
        {/* Hero — type icon + amount */}
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: TYPE_COLOR[expense.expenseType] }}
            aria-hidden
          >
            <TypeIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <Badge tone={EXPENSE_STATUS_TONE[expense.status]} size="sm">
              {tExpenses(`status.${expense.status}`)}
            </Badge>
            <h2 className="mt-1 text-lg font-semibold leading-tight text-text">
              {tCosts(`types.${expense.expenseType}`)}
              {expense.vehiclePlate && ` · ${expense.vehiclePlate}`}
            </h2>
            <div className="mt-1.5 text-2xl font-bold tabular leading-none text-text">{amount}</div>
          </div>
        </div>

        {/* Fact grid */}
        <Card>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 text-sm">
              <Field icon={<Calendar />} label={tExpenses('detail.occurredAt')} value={occurredAt} />
              {expense.vehiclePlate && (
                <Field icon={<Car />} label={tCosts('fVehicle')} value={expense.vehiclePlate} mono />
              )}
            </dl>
            {expense.note && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-1 text-xs font-medium text-text-muted">{tExpenses('detail.noteLabel')}</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">{expense.note}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="pt-2">
          <Button variant="ghost" size="md" className="w-full" iconRight={<ArrowUpRight />} asChild>
            <Link href={`/costs?highlight=${expense.id}`} target="_blank">
              {tPeek('openFull')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10.5px] font-bold text-text-faint uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

function PropertyRow({
  icon,
  label,
  value,
  mono,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="py-3 first:pt-3 last:pb-3">
      <dt className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint uppercase tracking-wider mb-1.5 [&_svg]:h-3 [&_svg]:w-3">
        {icon}
        <span>{label}</span>
      </dt>
      <dd
        className={cn(
          'text-sm leading-tight',
          muted ? 'text-text-muted italic' : 'text-text font-semibold',
          mono && 'font-mono tabular',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function RouteTimeline({
  pickup,
  dropoff,
  labels,
}: {
  pickup: string;
  dropoff: string;
  labels: { pickup: string; dropoff: string };
}) {
  return (
    <div className="relative">
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" aria-hidden />

      <div className="relative flex items-start gap-3.5 pb-5">
        <div className="h-[22px] w-[22px] rounded-full bg-accent flex items-center justify-center shrink-0 ring-4 ring-bg relative z-10">
          <div className="h-1.5 w-1.5 bg-bg rounded-full" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider">{labels.pickup}</div>
          <div className="text-sm font-semibold text-text mt-1.5 leading-snug break-words">{pickup}</div>
        </div>
      </div>

      <div className="relative flex items-start gap-3.5">
        <div className="h-[22px] w-[22px] rounded-full bg-success flex items-center justify-center shrink-0 ring-4 ring-bg relative z-10">
          <div className="h-1.5 w-1.5 bg-bg rounded-full" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[10.5px] font-semibold text-text-faint uppercase tracking-wider">{labels.dropoff}</div>
          <div className="text-sm font-semibold text-text mt-1.5 leading-snug break-words">{dropoff}</div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-text-faint [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium text-text-muted">{label}</dt>
        <dd className={cn('truncate text-text font-medium', mono && 'font-mono tabular')}>{value}</dd>
      </div>
    </div>
  );
}
