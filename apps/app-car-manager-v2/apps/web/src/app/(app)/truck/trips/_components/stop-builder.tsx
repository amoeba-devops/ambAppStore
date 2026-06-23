'use client';

import { useTranslations } from 'next-intl';
import { MapPin, Navigation, PackageCheck, PackageOpen, Plus, X } from 'lucide-react';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@car-v2/ui';
import type { CarStopType } from '@car-v2/db/schema';

export interface StopField {
  id: string;
  type: CarStopType;
  address: string;
  km: string;
}

const STOP_ICONS: Record<CarStopType, React.ElementType> = {
  ORIGIN: Navigation,
  PICKUP: PackageOpen,
  DELIVERY: PackageCheck,
  WAYPOINT: MapPin,
  RETURN: Navigation,
};

/** Types that the user can freely pick for middle stops. */
const SELECTABLE_TYPES: { value: CarStopType; label: string }[] = [
  { value: 'PICKUP', label: 'Lấy hàng' },
  { value: 'DELIVERY', label: 'Giao hàng' },
  { value: 'WAYPOINT', label: 'Điểm ghé khác' },
];

/** Fixed terminal types — address is editable but type is not a dropdown. */
const TERMINAL_TYPES: CarStopType[] = ['ORIGIN', 'RETURN'];

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
}

export function StopBuilder({ stops, onChange }: StopBuilderProps) {
  const t = useTranslations('screens.truckTrips.form.stops');

  const update = (id: string, patch: Partial<StopField>) =>
    onChange(stops.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const remove = (id: string) => onChange(stops.filter((s) => s.id !== id));

  /* Insert a new PICKUP stop before the RETURN stop. */
  const addStop = () => {
    if (stops.length >= MAX_STOPS) return;
    const returnIdx = stops.map((s) => s.type).lastIndexOf('RETURN');
    const insertAt = returnIdx >= 0 ? returnIdx : stops.length;
    const newStop: StopField = { id: makeId(), type: 'PICKUP', address: '', km: '' };
    const next = [...stops];
    next.splice(insertAt, 0, newStop);
    onChange(next);
  };

  /* Auto-calculate total km from first and last filled km values. */
  const kmValues = stops.map((s) => (s.km.trim() ? Number(s.km) : null));
  const firstKm = kmValues.find((v) => v != null);
  const lastKm = [...kmValues].reverse().find((v) => v != null);
  const totalKm = firstKm != null && lastKm != null && lastKm > firstKm ? lastKm - firstKm : null;

  const canAdd = stops.length < MAX_STOPS;

  return (
    <div className="space-y-1">
      {stops.map((stop, idx) => {
        const Icon = STOP_ICONS[stop.type];
        const isTerminal = TERMINAL_TYPES.includes(stop.type);
        const isLast = idx === stops.length - 1;

        return (
          <div key={stop.id} className="flex items-start gap-2">
            {/* Connector column */}
            <div className="flex flex-col items-center pt-3 shrink-0 w-7">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                  stop.type === 'PICKUP'
                    ? 'bg-warning/15 text-warning'
                    : stop.type === 'DELIVERY'
                      ? 'bg-success/15 text-success'
                      : stop.type === 'ORIGIN' || stop.type === 'RETURN'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-surface-2 text-text-faint'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 min-h-[16px] bg-border mt-1" />}
            </div>

            {/* Input column */}
            <div className="flex-1 min-w-0 pb-2 space-y-1.5">
              {/* Type selector OR fixed label */}
              {isTerminal ? (
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                  {t(`type.${stop.type}`)}
                </span>
              ) : (
                <Select
                  value={stop.type}
                  onValueChange={(v) => update(stop.id, { type: v as CarStopType })}
                >
                  <SelectTrigger className="h-7 text-xs w-40 border-0 bg-surface-2 px-2 gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELECTABLE_TYPES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Address */}
              <Input
                value={stop.address}
                onChange={(e) => update(stop.id, { address: e.target.value })}
                placeholder={t(`placeholder.${stop.type}`)}
                className="text-sm"
                required={stop.type === 'PICKUP' || stop.type === 'DELIVERY'}
              />

              {/* Odometer */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-faint shrink-0 w-24">{t('km')}</span>
                <Input
                  type="number"
                  value={stop.km}
                  onChange={(e) => update(stop.id, { km: e.target.value })}
                  placeholder="—"
                  className="text-sm w-36 h-8"
                />
              </div>
            </div>

            {/* Remove button — middle stops only */}
            <div className="pt-3 shrink-0">
              {!isTerminal ? (
                <button
                  type="button"
                  onClick={() => remove(stop.id)}
                  aria-label={t('remove')}
                  className="h-7 w-7 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="w-7" />
              )}
            </div>
          </div>
        );
      })}

      {/* Add stop button */}
      {canAdd && (
        <div className="pl-9 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addStop}
            className="h-7 text-xs text-text-muted gap-1.5 hover:text-text"
          >
            <Plus className="h-3 w-3" />
            {t('addStop')}
          </Button>
        </div>
      )}

      {/* Total distance preview */}
      {totalKm != null && (
        <div className="pl-9 pt-2">
          <div className="inline-flex items-center gap-2 rounded-md bg-surface-2 border border-border px-3 py-1.5 text-sm">
            <span className="text-text-muted">{t('totalDistance')}</span>
            <span className="font-semibold tabular text-text">{totalKm.toLocaleString('vi-VN')} km</span>
          </div>
        </div>
      )}
    </div>
  );
}
