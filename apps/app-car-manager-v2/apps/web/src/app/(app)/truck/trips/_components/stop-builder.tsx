'use client';

import { useTranslations } from 'next-intl';
import { MapPin, PackageOpen, PackageCheck, Navigation, Plus, X } from 'lucide-react';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@car-v2/ui';
import type { CarStopType } from '@car-v2/db/schema';

export interface StopField {
  id: string;
  type: CarStopType;
  address: string;
  km?: string;
}

const STOP_ICONS: Record<CarStopType, React.ElementType> = {
  ORIGIN: Navigation,
  PICKUP: PackageOpen,
  DELIVERY: PackageCheck,
  WAYPOINT: MapPin,
  RETURN: Navigation,
};

const LOCKED_TYPES: CarStopType[] = ['ORIGIN', 'PICKUP', 'DELIVERY', 'RETURN'];

/** Maximum total stops (including ORIGIN + RETURN). */
const MAX_STOPS = 20;

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function makeDefaultStops(depotAddress?: string | null): StopField[] {
  return [
    { id: makeId(), type: 'ORIGIN', address: depotAddress ?? '', km: '' },
    { id: makeId(), type: 'PICKUP', address: '', km: '' },
    { id: makeId(), type: 'DELIVERY', address: '', km: '' },
    { id: makeId(), type: 'RETURN', address: depotAddress ?? '', km: '' },
  ];
}

interface StopBuilderProps {
  stops: StopField[];
  onChange: (stops: StopField[]) => void;
  /** When true, km field is shown for each stop (used in completion / edit flows). */
  showKm?: boolean;
}

export function StopBuilder({ stops, onChange, showKm = false }: StopBuilderProps) {
  const t = useTranslations('screens.truckTrips.form.stops');

  const update = (id: string, patch: Partial<StopField>) => {
    onChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const remove = (id: string) => {
    onChange(stops.filter((s) => s.id !== id));
  };

  /* Insert a WAYPOINT after the stop at index `afterIdx`. */
  const addWaypoint = (afterIdx: number) => {
    if (stops.length >= MAX_STOPS) return;
    const newStop: StopField = { id: makeId(), type: 'WAYPOINT', address: '', km: '' };
    const next = [...stops];
    next.splice(afterIdx + 1, 0, newStop);
    onChange(next);
  };

  const pickupIdx = stops.findIndex((s) => s.type === 'PICKUP');
  const deliveryIdx = stops.findIndex((s) => s.type === 'DELIVERY');
  const canAddMore = stops.length < MAX_STOPS;

  return (
    <div className="space-y-2">
      {stops.map((stop, idx) => {
        const Icon = STOP_ICONS[stop.type];
        const locked = LOCKED_TYPES.includes(stop.type);
        const isWaypoint = stop.type === 'WAYPOINT';
        const isAfterPickup = idx > pickupIdx && idx < deliveryIdx;
        const isAfterDelivery = idx > deliveryIdx && stop.type !== 'RETURN';
        const showAddAfterPickup = idx === pickupIdx && canAddMore;
        const showAddAfterDelivery = idx === deliveryIdx && canAddMore;

        return (
          <div key={stop.id}>
            {/* Stop row */}
            <div className="flex items-start gap-2">
              {/* Connector line + icon */}
              <div className="flex flex-col items-center pt-2.5 shrink-0">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    stop.type === 'PICKUP'
                      ? 'text-warning'
                      : stop.type === 'DELIVERY'
                        ? 'text-success'
                        : 'text-text-faint'
                  }`}
                />
                {idx < stops.length - 1 && (
                  <div className="w-px flex-1 min-h-[20px] bg-border mt-1" />
                )}
              </div>

              {/* Address + type label */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                    {t(`type.${stop.type}`)}
                  </span>
                </div>
                <Input
                  value={stop.address}
                  onChange={(e) => update(stop.id, { address: e.target.value })}
                  placeholder={t(`placeholder.${stop.type}`)}
                  className="text-sm"
                  required={stop.type === 'PICKUP' || stop.type === 'DELIVERY'}
                />
                {showKm && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-faint shrink-0">{t('km')}</span>
                    <Input
                      type="number"
                      value={stop.km ?? ''}
                      onChange={(e) => update(stop.id, { km: e.target.value })}
                      placeholder="—"
                      className="text-sm w-32"
                    />
                  </div>
                )}
              </div>

              {/* Remove button (waypoints only) */}
              {isWaypoint && (
                <button
                  type="button"
                  onClick={() => remove(stop.id)}
                  aria-label={t('remove')}
                  className="mt-2.5 shrink-0 h-6 w-6 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* "Add stop" button — after PICKUP or after DELIVERY */}
            {(showAddAfterPickup || showAddAfterDelivery || (isAfterPickup && idx === deliveryIdx - 1) || (isAfterDelivery && idx === stops.length - 2)) && (
              <div className="pl-6 py-1">
                {(showAddAfterPickup || (isAfterPickup && idx === deliveryIdx - 1)) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addWaypoint(idx)}
                    className="h-7 text-xs text-text-muted gap-1 hover:text-text"
                  >
                    <Plus className="h-3 w-3" />
                    {t('addAfterPickup')}
                  </Button>
                )}
                {(showAddAfterDelivery || (isAfterDelivery && idx === stops.length - 2)) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addWaypoint(idx)}
                    className="h-7 text-xs text-text-muted gap-1 hover:text-text"
                  >
                    <Plus className="h-3 w-3" />
                    {t('addAfterDelivery')}
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
