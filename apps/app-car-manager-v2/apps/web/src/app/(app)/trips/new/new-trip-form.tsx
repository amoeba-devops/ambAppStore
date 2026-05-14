'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, MapPin, Plus, Save, X } from 'lucide-react';
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
import { createTripAction } from '@/server/actions/trips/trip.actions';

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [passengerId, setPassengerId] = useState(currentUserId);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationStr, setDurationStr] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [stopovers, setStopovers] = useState<string[]>([]);

  const addStopover = () => {
    if (stopovers.length >= 10) return;
    setStopovers((s) => [...s, '']);
  };
  const removeStopover = (i: number) =>
    setStopovers((s) => s.filter((_, idx) => idx !== i));
  const updateStopover = (i: number, value: string) =>
    setStopovers((s) => s.map((v, idx) => (idx === i ? value : v)));

  const onSubmit = () => {
    if (!pickup.trim() || !dropoff.trim() || !scheduledAt) {
      toast.error('Missing required fields', { description: 'Pickup, drop-off and time are required.' });
      return;
    }
    /* Validate assignment is all-or-nothing on client to give early feedback. */
    if ((driverId && !vehicleId) || (!driverId && vehicleId)) {
      toast.error('Incomplete assignment', { description: 'Pick both driver and vehicle, or neither.' });
      return;
    }

    startTransition(async () => {
      const scheduledIso = new Date(scheduledAt).toISOString();
      const result = await createTripAction({
        passenger_id: passengerId || undefined,
        pickup_address: pickup.trim(),
        dropoff_address: dropoff.trim(),
        scheduled_at: scheduledIso,
        duration_minutes: durationStr ? Number(durationStr) : undefined,
        purpose: purpose.trim() || undefined,
        notes: notes.trim() || undefined,
        driver_id: driverId || undefined,
        vehicle_id: vehicleId || undefined,
        stopovers: stopovers.filter((s) => s.trim()).map((s) => s.trim()),
      });
      if (result.success) {
        toast.success('Trip created', { description: result.data.trpRef });
        router.push(`/trips/${result.data.trpId}`);
      } else {
        toast.error('Could not create trip', {
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
      aria-label="Create new trip"
    >
      {/* Trip basics */}
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Trip details</CardTitle>
            <CardDescription>Who is travelling and why.</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Passenger">
              <Select value={passengerId} onValueChange={setPassengerId}>
                <SelectTrigger><SelectValue placeholder="Select passenger" /></SelectTrigger>
                <SelectContent>
                  {passengers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Purpose" hint="Short description, used by approvers.">
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Airport pickup for HQ delegation"
                maxLength={255}
              />
            </FormField>
            <FormField label="Notes" className="md:col-span-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional context, special requirements, etc."
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
            <CardTitle>Schedule &amp; route</CardTitle>
            <CardDescription>Pickup, drop-off and timing.</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Pickup address" required className="md:col-span-2">
              <Input
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                iconLeft={<MapPin />}
                placeholder="Building, street, district…"
                maxLength={2000}
              />
            </FormField>
            <FormField label="Drop-off address" required className="md:col-span-2">
              <Input
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                iconLeft={<MapPin />}
                placeholder="Building, street, district…"
                maxLength={2000}
              />
            </FormField>
            <FormField label="Pickup date & time" required hint="Rounded to 15-minute steps.">
              <Input
                type="datetime-local"
                step={900}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </FormField>
            <FormField label="Expected duration">
              <Select value={durationStr} onValueChange={setDurationStr}>
                <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="240">Half day (4h)</SelectItem>
                  <SelectItem value="480">Full day (8h)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <Separator className="my-5" />

          <div>
            <div className="text-xs font-medium text-text-muted mb-2">Stopovers ({stopovers.length}/10)</div>
            {stopovers.length === 0 && (
              <div className="text-xs text-text-faint mb-2">Add stops along the route — up to 10.</div>
            )}
            <ul className="space-y-2">
              {stopovers.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Input
                    value={s}
                    onChange={(e) => updateStopover(i, e.target.value)}
                    placeholder={`Stop ${i + 1}`}
                    iconLeft={<MapPin />}
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => removeStopover(i)}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
            {stopovers.length < 10 && (
              <Button type="button" variant="ghost" size="sm" iconLeft={<Plus />} onClick={addStopover} className="mt-2">
                Add stopover
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assignment (optional) */}
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Assignment</CardTitle>
            <CardDescription>Optional — leave blank for Admin to assign later.</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Driver">
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger><SelectValue placeholder="Leave for Admin to assign" /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Vehicle">
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder="Leave for Admin to assign" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Sticky footer */}
      <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
        sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href="/trips">Cancel</Link>
        </Button>
        <Button type="submit" variant="accent" size="lg" className="flex-1 md:flex-initial" disabled={pending}
          iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}>
          {pending ? 'Creating…' : 'Create trip'}
        </Button>
      </div>
    </form>
  );
}

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function FormField({ label, required, hint, className, children }: FormFieldProps) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block" required={required}>{label}</Label>
      {children}
      {hint && <div className="text-xs text-text-faint mt-1">{hint}</div>}
    </div>
  );
}
