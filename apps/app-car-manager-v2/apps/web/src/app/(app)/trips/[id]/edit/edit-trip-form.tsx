'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Save } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@car-v2/ui';
import type { CarTrip } from '@car-v2/db/schema';
import type { LocalRole } from '@car-v2/shared/auth';
import { AddressAutocomplete } from '@/components/inputs/address-autocomplete';
import { MapPreview } from '@/components/inputs/map-preview';
import { useFormPersistence } from '@/hooks/use-form-persistence';
import { useTripConflicts } from '@/hooks/use-trip-conflicts';
import { fromMinutes, toMinutes, type DurationUnit } from '@/lib/duration';
import type { ConflictResult } from '@/server/services/trip-conflict.service';
import { updateTripAction } from '@/server/actions/trips/trip.actions';
import { TripConflictBanner } from '../../_components/trip-conflict-banner';

function flattenConflictIds(c: ConflictResult | null): string[] {
  if (!c) return [];
  const set = new Set<string>();
  for (const x of c.vehicle) set.add(x.trpId);
  for (const x of c.driver) set.add(x.trpId);
  return Array.from(set);
}

function safeIsoOrEmpty(localValue: string): string {
  const d = new Date(localValue);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

interface SelectOption {
  id: string;
  label: string;
}

interface EditTripFormProps {
  trip: CarTrip;
  passengers: SelectOption[];
  role: LocalRole;
}

function isoToLocalInput(iso: Date | string): string {
  /* datetime-local expects "YYYY-MM-DDTHH:mm". Use local time. */
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditTripForm({ trip, passengers, role }: EditTripFormProps) {
  const t  = useTranslations('trips.form');
  const tA = useTranslations('actions');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /* Manager cannot change passenger after creation (PRD FR-1.3). */
  const passengerLocked = role === 'MANAGER';

  const [passengerId, setPassengerId] = useState(trip.trpPassengerId ?? '');
  const [pickup, setPickup] = useState(trip.trpPickupAddress);
  const [dropoff, setDropoff] = useState(trip.trpDropoffAddress);
  const [scheduledAt, setScheduledAt] = useState(isoToLocalInput(trip.trpScheduledAt));
  const initialDuration = fromMinutes(trip.trpDurationMinutes);
  const [durationValue, setDurationValue] = useState<string>(initialDuration.value);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initialDuration.unit);
  const [purpose, setPurpose] = useState(trip.trpPurpose ?? '');
  const [notes, setNotes] = useState(trip.trpNotes ?? '');

  /* sessionStorage draft — keyed per-trip so editing two trips concurrently
   * does not collide. Restores form values after a round-trip through a
   * conflict-banner internal link. */
  const { clearDraft } = useFormPersistence(
    `trip-edit-${trip.trpId}-draft`,
    { passengerId, pickup, dropoff, scheduledAt, durationValue, durationUnit, purpose, notes },
    (v) => {
      if (!passengerLocked && typeof v.passengerId === 'string') setPassengerId(v.passengerId);
      if (typeof v.pickup === 'string') setPickup(v.pickup);
      if (typeof v.dropoff === 'string') setDropoff(v.dropoff);
      if (typeof v.scheduledAt === 'string') setScheduledAt(v.scheduledAt);
      if (typeof v.durationValue === 'string') setDurationValue(v.durationValue);
      if (v.durationUnit === 'minutes' || v.durationUnit === 'hours' || v.durationUnit === 'days') setDurationUnit(v.durationUnit);
      if (typeof v.purpose === 'string') setPurpose(v.purpose);
      if (typeof v.notes === 'string') setNotes(v.notes);
    },
  );

  /* Conflict check chỉ active khi trip đã có driver + vehicle (mới có nghĩa). */
  const durationMinutes = toMinutes(durationValue, durationUnit) ?? null;
  const scheduledIso = safeIsoOrEmpty(scheduledAt);
  const { conflicts, loading: conflictsLoading } = useTripConflicts({
    vehicleId: trip.trpVehicleId,
    driverId: trip.trpDriverId,
    scheduledAtIso: scheduledIso,
    durationMinutes,
    excludeTripId: trip.trpId,
    enabled: Boolean(trip.trpVehicleId && trip.trpDriverId),
  });

  const onSubmit = () => {
    if (!pickup.trim() || !dropoff.trim() || !scheduledAt) {
      toast.error(t('errMissing'), { description: t('errMissingDesc') });
      return;
    }

    startTransition(async () => {
      const acknowledged = flattenConflictIds(conflicts);
      const result = await updateTripAction(trip.trpId, {
        passenger_id: passengerLocked ? undefined : passengerId || undefined,
        pickup_address: pickup.trim(),
        dropoff_address: dropoff.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: toMinutes(durationValue, durationUnit) ?? null,
        purpose: purpose.trim() || null,
        notes: notes.trim() || null,
        acknowledged_conflicts: acknowledged.length > 0 ? acknowledged : undefined,
      });
      if (result.success) {
        clearDraft();
        toast.success(t('tUpdated'), { description: result.data.trpRef });
        router.push(`/trips/${trip.trpId}`);
        router.refresh();
      } else {
        toast.error(t('errUpdate'), { description: `${result.error.code} — ${result.error.message}` });
      }
    });
  };

  return (
    <form
      className="max-w-[720px] mx-auto space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionDetails')}</CardTitle>
            <CardDescription>{t('editScheduleHint')}</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('passenger')} hint={passengerLocked ? t('passengerLockHint') : undefined}>
              <Select value={passengerId} onValueChange={setPassengerId} disabled={passengerLocked}>
                <SelectTrigger><SelectValue placeholder={t('passengerPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {passengers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('purpose')}>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={255} placeholder={t('purposePlaceholderEdit')} />
            </Field>
            <Field label={t('notes')} className="md:col-span-2">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionSchedule')}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('pickup')} required className="md:col-span-2">
              <AddressAutocomplete value={pickup} onChange={(val) => setPickup(val)} maxLength={2000} />
            </Field>
            <Field label={t('dropoff')} required className="md:col-span-2">
              <AddressAutocomplete value={dropoff} onChange={(val) => setDropoff(val)} maxLength={2000} />
            </Field>
            <Field label={t('scheduledAt')} required hint={t('scheduledAtHint')}>
              <Input type="datetime-local" step={900} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </Field>
            <Field label={t('duration')}>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                  placeholder={t('durationValuePlaceholder')}
                  className="w-24 shrink-0"
                />
                <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as DurationUnit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">{t('unitMinutes')}</SelectItem>
                    <SelectItem value="hours">{t('unitHours')}</SelectItem>
                    <SelectItem value="days">{t('unitDays')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Field>
          </div>
          <TripConflictBanner
            conflicts={conflicts}
            loading={conflictsLoading}
            className="mt-4"
          />
          <MapPreview pickup={pickup} dropoff={dropoff} />
        </CardContent>
      </Card>

      <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
        sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href={`/trips/${trip.trpId}`}>{tA('cancel')}</Link>
        </Button>
        <Button type="submit" variant="accent" size="lg" className="flex-1 md:flex-initial" disabled={pending}
          iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}>
          {pending ? t('submitSaving') : t('submitSave')}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required, hint, className, children }: { label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block" required={required}>{label}</Label>
      {children}
      {hint && <div className="text-xs text-text-faint mt-1">{hint}</div>}
    </div>
  );
}
