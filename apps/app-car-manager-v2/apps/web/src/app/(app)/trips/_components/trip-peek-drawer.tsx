'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  Calendar,
  Car as CarIcon,
  Clock,
  MapPin,
  User as UserIcon,
} from 'lucide-react';
import { Badge, Button } from '@car-v2/ui';
import type { CarTripStatus } from '@car-v2/db/schema';
import type { LocalRole } from '@car-v2/shared/auth';
import { MapPreview } from '@/components/inputs/map-preview';
import { Sheet, SheetCloseButton } from '@/components/layout/sheet';
import type { TripDetail } from '@/server/queries/trips.queries';
import { TripActions } from '../[id]/trip-actions';

const STATUS_TONE: Record<CarTripStatus, 'accent' | 'warning' | 'success' | 'info' | 'neutral' | 'danger'> = {
  PENDING_ASSIGNMENT:          'accent',
  PENDING_DRIVER_CONFIRMATION: 'warning',
  CONFIRMED:                   'success',
  IN_PROGRESS:                 'info',
  COMPLETED:                   'neutral',
  REJECTED_BY_DRIVER:          'danger',
  CANCELLED:                   'danger',
};

interface DriverOption {
  id: string;
  label: string;
}
interface VehicleOption {
  id: string;
  label: string;
}

interface TripPeekDrawerProps {
  trip: TripDetail;
  role: LocalRole;
  isAssignedDriver: boolean;
  isCreator: boolean;
  drivers: DriverOption[];
  vehicles: VehicleOption[];
}

/**
 * Slide-over drawer cho trip detail — bật khi `?peek={tripId}` ở URL.
 *
 * Server pre-fetches trip + role flags + driver/vehicle options for assignment
 * and passes them in as props (matches the full /trips/{id}/page.tsx contract).
 * The drawer is purely UI — close = strip `?peek` from URL, preserves the
 * list's `?status` + `?page` filters.
 *
 * UX: compact layout (smaller map, condensed metadata rows). For deeper work
 * the footer's "Open full details" link routes to the full page.
 */
export function TripPeekDrawer(props: TripPeekDrawerProps) {
  const { trip } = props;
  const t = useTranslations('trips.peek');
  const tStatus = useTranslations('trips.status');
  const tDetail = useTranslations('trips.detail');

  const router = useRouter();
  const searchParams = useSearchParams();

  /* Close = drop the `peek` param. Preserve everything else (status, page).
   * Use `replace` to avoid bloating history with intermediate states. */
  const handleClose = (open: boolean) => {
    if (open) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('peek');
    const qs = params.toString();
    router.replace(qs ? `/trips?${qs}` : '/trips', { scroll: false });
  };

  return (
    <Sheet
      open
      onOpenChange={handleClose}
      title={t('a11yTitle', { ref: trip.trpRef })}
      description={t('a11yDescription')}
    >
      {/* ── Header ── sticky top, ref + status + close ─────────────────── */}
      <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-bg">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono font-bold text-text tabular text-lg leading-none">
              {trip.trpRef}
            </span>
            <Badge tone={STATUS_TONE[trip.trpStatus]} size="sm">
              {tStatus(trip.trpStatus)}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-text-faint truncate">
            {trip.passengerName ?? tDetail('passengerUnspecified')}
          </div>
        </div>
        <SheetCloseButton label={t('close')} />
      </header>

      {/* ── Body ── scrollable middle section ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Schedule block */}
        <PeekRow icon={<Calendar />} label={tDetail('scheduled')}>
          <div className="font-medium text-text">
            {new Date(trip.trpScheduledAt).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </div>
          {trip.trpDurationMinutes != null && (
            <div className="text-xs text-text-muted">
              <Clock className="inline h-3 w-3 mr-1 -mt-0.5" />
              {tDetail('durationApprox', { minutes: trip.trpDurationMinutes })}
            </div>
          )}
        </PeekRow>

        {/* Route block */}
        <PeekRow icon={<MapPin />} label={tDetail('pickup')}>
          <div className="text-text">{trip.trpPickupAddress}</div>
        </PeekRow>
        <PeekRow icon={<MapPin />} label={tDetail('dropoff')}>
          <div className="text-text">{trip.trpDropoffAddress}</div>
        </PeekRow>

        {/* Driver / Vehicle */}
        <div className="grid grid-cols-2 gap-3">
          <PeekRow icon={<UserIcon />} label={tDetail('driver')} compact>
            {trip.driverName ? (
              <div className="text-text font-medium text-sm">{trip.driverName}</div>
            ) : (
              <div className="text-text-muted italic text-xs">{tDetail('notAssigned')}</div>
            )}
          </PeekRow>
          <PeekRow icon={<CarIcon />} label={tDetail('vehicle')} compact>
            {trip.vehiclePlate ? (
              <div className="font-mono font-semibold text-sm tabular">{trip.vehiclePlate}</div>
            ) : (
              <div className="text-text-muted italic text-xs">{tDetail('notAssigned')}</div>
            )}
          </PeekRow>
        </div>

        {/* Notes */}
        {trip.trpNotes && (
          <PeekRow label={tDetail('notes')}>
            <div className="text-sm text-text-muted whitespace-pre-wrap leading-relaxed">
              {trip.trpNotes}
            </div>
          </PeekRow>
        )}

        {/* Map preview — smaller height in drawer */}
        {trip.trpPickupAddress.length >= 3 && trip.trpDropoffAddress.length >= 3 && (
          <MapPreview
            pickup={trip.trpPickupAddress}
            dropoff={trip.trpDropoffAddress}
            stopovers={trip.stopovers.map((s) => s.address)}
          />
        )}
      </div>

      {/* ── Footer ── sticky bottom, action buttons + open-full link ───── */}
      <footer className="border-t border-border bg-bg px-5 py-3 space-y-2">
        <TripActions
          tripId={trip.trpId}
          status={trip.trpStatus}
          role={props.role}
          isAssignedDriver={props.isAssignedDriver}
          isCreator={props.isCreator}
          drivers={props.drivers}
          vehicles={props.vehicles}
          tripScheduledAtIso={trip.trpScheduledAt.toISOString()}
          tripDurationMinutes={trip.trpDurationMinutes}
        />
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="w-full"
          iconRight={<ArrowUpRight />}
        >
          <Link href={`/trips/${trip.trpId}`}>{t('openFull')}</Link>
        </Button>
      </footer>
    </Sheet>
  );
}

function PeekRow({
  icon,
  label,
  children,
  compact,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? '' : 'space-y-0.5'}>
      <dt
        className={
          'inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint uppercase tracking-wider [&_svg]:h-3 [&_svg]:w-3 ' +
          (compact ? 'mb-1' : 'mb-1.5')
        }
      >
        {icon}
        <span>{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
