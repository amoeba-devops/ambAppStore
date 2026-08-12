'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Navigation, PackageCheck, PackageOpen, Check, Loader2 } from 'lucide-react';
import { Button, Input, toast } from '@car-v2/ui';
import { updateStopoverAction } from '@/server/actions/trips/stopover.actions';
import { formatActionError } from '@/lib/format-action-error';
import type { CarTripStopover, CarStopType } from '@car-v2/db/schema';

const STOP_ICONS: Record<CarStopType, React.ElementType> = {
  ORIGIN: Navigation,
  PICKUP: PackageOpen,
  DELIVERY: PackageCheck,
  WAYPOINT: MapPin,
  RETURN: Navigation,
};

interface StopRowProps {
  tripId: string;
  stop: CarTripStopover;
}

function StopRow({ tripId, stop }: StopRowProps) {
  const t = useTranslations('today.truck.stops');
  /* Stop-type names live with the stop builder — one wording for the whole app. */
  const tType = useTranslations('screens.truckTrips.form.stops.type');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [km, setKm] = useState(stop.tstKm != null ? String(stop.tstKm) : '');
  const [notes, setNotes] = useState(stop.tstNotes ?? '');
  const hasData = stop.tstKm != null || stop.tstArrivedAt != null;

  const Icon = STOP_ICONS[stop.tstType];

  const save = () => {
    startTransition(async () => {
      const res = await updateStopoverAction({
        trip_id: tripId,
        stopover_id: stop.tstId,
        km: km.trim() ? Number(km) : undefined,
        arrived_at: new Date().toISOString(),
        notes: notes.trim() || undefined,
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('savedToast'));
      setExpanded(false);
    });
  };

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-2 transition-colors text-left"
      >
        <div
          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
            stop.tstType === 'PICKUP'
              ? 'bg-warning/15 text-warning'
              : stop.tstType === 'DELIVERY'
                ? 'bg-success/15 text-success'
                : 'bg-surface-2 text-text-faint'
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">{tType(stop.tstType)}</span>
            {hasData && <Check className="h-3 w-3 text-success" />}
          </div>
          <div className="text-sm text-text truncate">{stop.tstAddress}</div>
          {stop.tstKm != null && (
            <div className="text-xs text-text-faint font-mono">{stop.tstKm.toLocaleString('vi-VN')} km</div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-surface border-t border-border space-y-3">
          <div>
            <label className="text-xs text-text-muted">{t('kmLabel')}</label>
            <Input
              type="number"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder={t('kmPlaceholder')}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">{t('notesLabel')}</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
              disabled={pending}
              className="flex-1"
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={save}
              disabled={pending}
              className="flex-1"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {t('save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StopUpdateList({ tripId, stopovers }: { tripId: string; stopovers: CarTripStopover[] }) {
  const t = useTranslations('today.truck.stops');
  const sorted = [...stopovers].sort((a, b) => a.tstOrder - b.tstOrder);

  if (sorted.length === 0) {
    return <p className="text-sm text-text-muted py-8 text-center">{t('empty')}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted mb-3">{t('hint')}</p>
      {sorted.map((s) => (
        <StopRow key={s.tstId} tripId={tripId} stop={s} />
      ))}
    </div>
  );
}
