'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Save, X } from 'lucide-react';
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
  Separator,
  Textarea,
  toast,
} from '@car-v2/ui';
import { AddressAutocomplete } from '@/components/inputs/address-autocomplete';
import { MapPreview } from '@/components/inputs/map-preview';
import { useTripConflicts } from '@/hooks/use-trip-conflicts';
import { toMinutes, type DurationUnit } from '@/lib/duration';
import type { ConflictResult } from '@/server/services/trip-conflict.service';
import { createTripAction } from '@/server/actions/trips/trip.actions';
import { TripConflictBanner } from '../_components/trip-conflict-banner';

/** Inline equivalent of server-only `collectConflictIds` — pure utility. */
function flattenConflictIds(c: ConflictResult | null): string[] {
  if (!c) return [];
  const set = new Set<string>();
  for (const x of c.vehicle) set.add(x.trpId);
  for (const x of c.driver) set.add(x.trpId);
  return Array.from(set);
}

/** `datetime-local` input → ISO string. Empty string khi parse fail —
 *  hook sẽ skip check khi thấy chuỗi rỗng. */
function safeIsoOrEmpty(localValue: string): string {
  const d = new Date(localValue);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

interface SelectOption {
  id: string;
  label: string;
}

interface NewTripFormProps {
  passengers: SelectOption[];
  drivers: SelectOption[];
  vehicles: SelectOption[];
  currentUserId: string;
}

export function NewTripForm({ passengers, drivers, vehicles, currentUserId }: NewTripFormProps) {
  const t  = useTranslations('trips.form');
  const tA = useTranslations('actions');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [passengerId, setPassengerId] = useState(currentUserId);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationValue, setDurationValue] = useState<string>('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('hours');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [stopovers, setStopovers] = useState<string[]>([]);
  /* Per-field error flags. Set on failed submit, cleared as user types. */
  const [fieldErrors, setFieldErrors] = useState<{ pickup?: boolean; dropoff?: boolean; scheduledAt?: boolean; driver?: boolean; vehicle?: boolean }>({});

  /* PRD R-1/R-2 R3 — debounced conflict check. Chỉ active khi có đủ
   * (driver | vehicle) + scheduledAt. Banner hiện trong card Assignment. */
  const scheduledIso = scheduledAt ? safeIsoOrEmpty(scheduledAt) : '';
  const durationMinutes = toMinutes(durationValue, durationUnit) ?? null;
  const { conflicts, loading: conflictsLoading } = useTripConflicts({
    vehicleId: vehicleId || null,
    driverId: driverId || null,
    scheduledAtIso: scheduledIso,
    durationMinutes,
  });

  const addStopover = () => {
    if (stopovers.length >= 10) return;
    setStopovers((s) => [...s, '']);
  };
  const removeStopover = (i: number) =>
    setStopovers((s) => s.filter((_, idx) => idx !== i));
  const updateStopover = (i: number, value: string) =>
    setStopovers((s) => s.map((v, idx) => (idx === i ? value : v)));

  const onSubmit = () => {
    const missing = {
      pickup: !pickup.trim(),
      dropoff: !dropoff.trim(),
      scheduledAt: !scheduledAt,
    };
    if (missing.pickup || missing.dropoff || missing.scheduledAt) {
      setFieldErrors((prev) => ({ ...prev, ...missing }));
      toast.error(t('errMissing'), { description: t('errMissingDesc') });
      return;
    }
    /* Validate assignment is all-or-nothing on client to give early feedback. */
    if ((driverId && !vehicleId) || (!driverId && vehicleId)) {
      setFieldErrors((prev) => ({ ...prev, driver: !driverId, vehicle: !vehicleId }));
      toast.error(t('errIncomplete'), { description: t('errIncompleteDesc') });
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const scheduledIsoSubmit = new Date(scheduledAt).toISOString();
      const acknowledged = flattenConflictIds(conflicts);
      const result = await createTripAction({
        passenger_id: passengerId || undefined,
        pickup_address: pickup.trim(),
        dropoff_address: dropoff.trim(),
        scheduled_at: scheduledIsoSubmit,
        duration_minutes: toMinutes(durationValue, durationUnit),
        purpose: purpose.trim() || undefined,
        notes: notes.trim() || undefined,
        driver_id: driverId || undefined,
        vehicle_id: vehicleId || undefined,
        stopovers: stopovers.filter((s) => s.trim()).map((s) => s.trim()),
        acknowledged_conflicts: acknowledged.length > 0 ? acknowledged : undefined,
      });
      if (result.success) {
        toast.success(t('tCreated'), { description: result.data.trpRef });
        router.push(`/trips/${result.data.trpId}`);
      } else {
        toast.error(t('errCreate'), {
          description: `${result.error.code} — ${result.error.message}`,
        });
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
      aria-label={t('createAria')}
    >
      {/* Trip basics */}
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionDetails')}</CardTitle>
            <CardDescription>{t('sectionDetailsDesc')}</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('passenger')}>
              <Select value={passengerId} onValueChange={setPassengerId}>
                <SelectTrigger><SelectValue placeholder={t('passengerPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {passengers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t('purpose')} hint={t('purposeHint')}>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder={t('purposePlaceholder')}
                maxLength={255}
              />
            </FormField>
            <FormField label={t('notes')} className="md:col-span-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                rows={3}
                maxLength={2000}
              />
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Schedule + route */}
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionSchedule')}</CardTitle>
            <CardDescription>{t('sectionScheduleDesc')}</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('pickup')} required error={fieldErrors.pickup} className="md:col-span-2">
              <AddressAutocomplete
                value={pickup}
                onChange={(val) => {
                  setPickup(val);
                  if (fieldErrors.pickup && val.trim()) setFieldErrors((p) => ({ ...p, pickup: false }));
                }}
                error={fieldErrors.pickup}
                placeholder={t('pickupPlaceholder')}
                maxLength={2000}
              />
            </FormField>
            <FormField label={t('dropoff')} required error={fieldErrors.dropoff} className="md:col-span-2">
              <AddressAutocomplete
                value={dropoff}
                onChange={(val) => {
                  setDropoff(val);
                  if (fieldErrors.dropoff && val.trim()) setFieldErrors((p) => ({ ...p, dropoff: false }));
                }}
                error={fieldErrors.dropoff}
                placeholder={t('dropoffPlaceholder')}
                maxLength={2000}
              />
            </FormField>
            <FormField label={t('scheduledAt')} required error={fieldErrors.scheduledAt} hint={t('scheduledAtHint')}>
              <Input
                type="datetime-local"
                step={900}
                value={scheduledAt}
                onChange={(e) => {
                  setScheduledAt(e.target.value);
                  if (fieldErrors.scheduledAt && e.target.value) setFieldErrors((p) => ({ ...p, scheduledAt: false }));
                }}
                error={fieldErrors.scheduledAt}
              />
            </FormField>
            <FormField label={t('duration')}>
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
            </FormField>
          </div>

          <Separator className="my-5" />

          <div>
            <div className="text-xs font-medium text-text-muted mb-2">{t('stopoversLabel', { count: stopovers.length })}</div>
            {stopovers.length === 0 && (
              <div className="text-xs text-text-faint mb-2">{t('stopoversHint')}</div>
            )}
            <ul className="space-y-2">
              {stopovers.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <AddressAutocomplete
                      value={s}
                      onChange={(val) => updateStopover(i, val)}
                      placeholder={t('stopPlaceholder', { n: i + 1 })}
                      maxLength={2000}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label={t('removeStopAria')} onClick={() => removeStopover(i)}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
            {stopovers.length < 10 && (
              <Button type="button" variant="ghost" size="sm" iconLeft={<Plus />} onClick={addStopover} className="mt-2">
                {t('addStop')}
              </Button>
            )}
          </div>

          <MapPreview pickup={pickup} dropoff={dropoff} stopovers={stopovers} />
        </CardContent>
      </Card>

      {/* Assignment (optional) */}
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionAssignment')}</CardTitle>
            <CardDescription>{t('sectionAssignmentDesc')}</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('driver')} error={fieldErrors.driver}>
              <Select
                value={driverId}
                onValueChange={(v) => {
                  setDriverId(v);
                  if (fieldErrors.driver && v) setFieldErrors((p) => ({ ...p, driver: false }));
                }}
              >
                <SelectTrigger error={fieldErrors.driver}><SelectValue placeholder={t('driverPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t('vehicle')} error={fieldErrors.vehicle}>
              <Select
                value={vehicleId}
                onValueChange={(v) => {
                  setVehicleId(v);
                  if (fieldErrors.vehicle && v) setFieldErrors((p) => ({ ...p, vehicle: false }));
                }}
              >
                <SelectTrigger error={fieldErrors.vehicle}><SelectValue placeholder={t('vehiclePlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <TripConflictBanner
            conflicts={conflicts}
            loading={conflictsLoading}
            className="mt-4"
          />
        </CardContent>
      </Card>

      {/* Sticky footer */}
      <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
        sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href="/trips">{tA('cancel')}</Link>
        </Button>
        <Button type="submit" variant="accent" size="lg" className="flex-1 md:flex-initial" disabled={pending}
          iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}>
          {pending ? t('submitCreating') : t('submitCreate')}
        </Button>
      </div>
    </form>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function FormField({ label, required, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={className}>
      <Label className={'mb-1.5 block ' + (error ? 'text-danger' : '')} required={required}>{label}</Label>
      {children}
      {hint && !error && <div className="text-xs text-text-faint mt-1">{hint}</div>}
    </div>
  );
}
