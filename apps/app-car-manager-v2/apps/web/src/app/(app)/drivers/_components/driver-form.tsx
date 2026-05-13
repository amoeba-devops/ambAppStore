'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
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
import type { CarDriver, CarDriverLicenseClass, CarDriverStatus } from '@car-v2/db/schema';
import {
  createDriverAction,
  updateDriverAction,
} from '@/server/actions/drivers/driver.actions';

const LICENSE_CLASSES: CarDriverLicenseClass[] = ['A2', 'B1', 'B2', 'C', 'D', 'E', 'F'];
const STATUSES: CarDriverStatus[] = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'UNAVAILABLE'];

interface DriverFormProps {
  driver?: CarDriver & { user?: { usrName?: string | null; usrEmail?: string | null } };
  userCandidates?: { usrId: string; usrName: string | null; usrEmail: string | null }[];
}

export function DriverForm({ driver, userCandidates = [] }: DriverFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!driver;

  const [userId, setUserId] = useState(driver?.drvUserId ?? '');
  const [licenseNumber, setLicenseNumber] = useState(driver?.drvLicenseNumber ?? '');
  const [licenseClass, setLicenseClass] = useState<CarDriverLicenseClass>(driver?.drvLicenseClass ?? 'B2');
  const [licenseExpiry, setLicenseExpiry] = useState<string>(driver?.drvLicenseExpiry ?? '');
  const [phone, setPhone] = useState(driver?.drvPhone ?? '');
  const [status, setStatus] = useState<CarDriverStatus>(driver?.drvStatus ?? 'AVAILABLE');
  const [emergencyContact, setEmergencyContact] = useState(driver?.drvEmergencyContact ?? '');
  const [notes, setNotes] = useState(driver?.drvNotes ?? '');

  const onSubmit = () => {
    if (!isEdit && !userId) {
      toast.error('Pick a user', { description: 'Drivers must be linked to an existing user account.' });
      return;
    }
    if (!licenseNumber.trim() || !licenseExpiry) {
      toast.error('Missing required fields', { description: 'License number and expiry are required.' });
      return;
    }

    startTransition(async () => {
      const basePayload = {
        license_number: licenseNumber.trim(),
        license_class: licenseClass,
        license_expiry: licenseExpiry,
        phone: phone.trim() || undefined,
        emergency_contact: emergencyContact.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const result = isEdit
        ? await updateDriverAction(driver.drvId, { ...basePayload, status })
        : await createDriverAction({ ...basePayload, user_id: userId });

      if (result.success) {
        toast.success(isEdit ? 'Driver updated' : 'Driver added');
        router.push(`/drivers/${result.data.drvId}`);
        router.refresh();
      } else {
        toast.error(isEdit ? 'Could not update' : 'Could not create', {
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
    >
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              {isEdit ? 'User account is fixed after creation.' : 'Pick the user this driver record belongs to.'}
            </CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          {isEdit ? (
            <div className="rounded border border-border bg-surface-2/40 px-4 py-3 text-sm">
              <div className="text-text-faint text-xs uppercase tracking-wide mb-0.5">User</div>
              <div className="text-text font-medium">{driver?.user?.usrName ?? driver?.drvUserId}</div>
              {driver?.user?.usrEmail && <div className="text-text-muted text-xs">{driver.user.usrEmail}</div>}
            </div>
          ) : (
            <Field label="User" required>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="Pick a user" /></SelectTrigger>
                <SelectContent>
                  {userCandidates.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-text-faint italic">
                      Everyone is already a driver. Invite a user in /users first.
                    </div>
                  ) : (
                    userCandidates.map((u) => (
                      <SelectItem key={u.usrId} value={u.usrId}>
                        {u.usrName ?? u.usrEmail ?? u.usrId}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>License &amp; contact</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="License number" required>
              <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="B2-1234567" maxLength={50} className="font-mono" />
            </Field>
            <Field label="Class" required>
              <Select value={licenseClass} onValueChange={(v) => setLicenseClass(v as CarDriverLicenseClass)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LICENSE_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>Class {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="License expiry" required hint="When the license becomes invalid.">
              <Input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
            </Field>
            {isEdit && (
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as CarDriverStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace('_', ' ').toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Phone">
              <Input value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} placeholder="+84 90 555 8819" maxLength={20} className="font-mono" />
            </Field>
            <Field label="Emergency contact">
              <Input value={emergencyContact ?? ''} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Name + phone" maxLength={100} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Notes</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <Textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} placeholder="Languages, preferences, schedule constraints…" rows={3} maxLength={2000} />
        </CardContent>
      </Card>

      <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
        sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href={isEdit ? `/drivers/${driver.drvId}` : '/drivers'}>Cancel</Link>
        </Button>
        <Button type="submit" variant="accent" size="lg" className="flex-1 md:flex-initial" disabled={pending}
          iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add driver'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block" required={required}>{label}</Label>
      {children}
      {hint && <div className="text-xs text-text-faint mt-1">{hint}</div>}
    </div>
  );
}
