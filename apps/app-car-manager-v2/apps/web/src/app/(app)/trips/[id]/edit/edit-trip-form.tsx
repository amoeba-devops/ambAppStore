'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, MapPin, Save } from 'lucide-react';
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
import { updateTripAction } from '@/server/actions/trips/trip.actions';

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  /* Manager cannot change passenger after creation (PRD FR-1.3). */
  const passengerLocked = role === 'MANAGER';

  const [passengerId, setPassengerId] = useState(trip.trpPassengerId ?? '');
  const [pickup, setPickup] = useState(trip.trpPickupAddress);
  const [dropoff, setDropoff] = useState(trip.trpDropoffAddress);
  const [scheduledAt, setScheduledAt] = useState(isoToLocalInput(trip.trpScheduledAt));
  const [durationStr, setDurationStr] = useState(trip.trpDurationMinutes?.toString() ?? '');
  const [purpose, setPurpose] = useState(trip.trpPurpose ?? '');
  const [notes, setNotes] = useState(trip.trpNotes ?? '');

  const onSubmit = () => {
    if (!pickup.trim() || !dropoff.trim() || !scheduledAt) {
      toast.error('Missing required fields', { description: 'Pickup, drop-off and time are required.' });
      return;
    }

    startTransition(async () => {
      const result = await updateTripAction(trip.trpId, {
        passenger_id: passengerLocked ? undefined : passengerId || undefined,
        pickup_address: pickup.trim(),
        dropoff_address: dropoff.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: durationStr ? Number(durationStr) : null,
        purpose: purpose.trim() || null,
        notes: notes.trim() || null,
      });
      if (result.success) {
        toast.success('Trip updated', { description: result.data.trpRef });
        router.push(`/trips/${trip.trpId}`);
        router.refresh();
      } else {
        toast.error('Could not update', { description: `${result.error.code} — ${result.error.message}` });
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
            <CardTitle>Trip details</CardTitle>
            <CardDescription>
              Editable while pending. Driver/vehicle assignment is changed from the trip page actions.
            </CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Passenger" hint={passengerLocked ? 'Only Admin can change passenger.' : undefined}>
              <Select value={passengerId} onValueChange={setPassengerId} disabled={passengerLocked}>
                <SelectTrigger><SelectValue placeholder="Select passenger" /></SelectTrigger>
                <SelectContent>
                  {passengers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Purpose">
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={255} placeholder="e.g. Client meeting" />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Schedule &amp; route</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Pickup address" required className="md:col-span-2">
              <Input value={pickup} onChange={(e) => setPickup(e.target.value)} iconLeft={<MapPin />} maxLength={2000} />
            </Field>
            <Field label="Drop-off address" required className="md:col-span-2">
              <Input value={dropoff} onChange={(e) => setDropoff(e.target.value)} iconLeft={<MapPin />} maxLength={2000} />
            </Field>
            <Field label="Pickup date & time" required hint="Rounded to 15-minute steps.">
              <Input type="datetime-local" step={900} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </Field>
            <Field label="Expected duration">
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
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
        sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href={`/trips/${trip.trpId}`}>Cancel</Link>
        </Button>
        <Button type="submit" variant="accent" size="lg" className="flex-1 md:flex-initial" disabled={pending}
          iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}>
          {pending ? 'Saving…' : 'Save changes'}
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
