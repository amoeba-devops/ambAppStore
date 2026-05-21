'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, Save, Trash2 } from 'lucide-react';
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
import type {
  CarVehicle,
  CarVehicleFuel,
  CarVehicleStatus,
} from '@car-v2/db/schema';
import {
  createVehicleAction,
  deleteVehicleAction,
  updateVehicleAction,
} from '@/server/actions/vehicles/vehicle.actions';

const FUEL_TYPES: CarVehicleFuel[] = ['PETROL', 'DIESEL', 'HYBRID', 'EV'];
const STATUSES: CarVehicleStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];

interface VehicleFormProps {
  /* Pass the existing vehicle to enter edit mode; omit for create. */
  vehicle?: CarVehicle;
}

export function VehicleForm({ vehicle }: VehicleFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!vehicle;

  const [plateNumber, setPlateNumber] = useState(vehicle?.cvhPlateNumber ?? '');
  const [model, setModel] = useState(vehicle?.cvhModel ?? '');
  const [make, setMake] = useState(vehicle?.cvhMake ?? '');
  const [year, setYear] = useState<string>(vehicle?.cvhYear?.toString() ?? '');
  const [color, setColor] = useState(vehicle?.cvhColor ?? '');
  const [fuelType, setFuelType] = useState<CarVehicleFuel>(vehicle?.cvhFuelType ?? 'PETROL');
  const [status, setStatus] = useState<CarVehicleStatus>(vehicle?.cvhStatus ?? 'AVAILABLE');
  const [odometer, setOdometer] = useState<string>(vehicle?.cvhOdometerKm?.toString() ?? '0');
  const [oilIntervalKm, setOilIntervalKm] = useState<string>(vehicle?.cvhOilIntervalKm?.toString() ?? '5000');
  const [oilIntervalMonths, setOilIntervalMonths] = useState<string>(vehicle?.cvhOilIntervalMonths?.toString() ?? '3');
  const [homeBase, setHomeBase] = useState(vehicle?.cvhHomeBase ?? '');
  const [notes, setNotes] = useState(vehicle?.cvhNotes ?? '');

  const onSubmit = () => {
    if (!plateNumber.trim() || !model.trim()) {
      toast.error('Missing required fields', { description: 'Plate number and model are required.' });
      return;
    }

    startTransition(async () => {
      const payload = {
        plate_number: plateNumber.trim(),
        model: model.trim(),
        make: make.trim() || undefined,
        year: year ? Number(year) : undefined,
        color: color.trim() || undefined,
        fuel_type: fuelType,
        odometer_km: Number(odometer) || 0,
        oil_interval_km: Number(oilIntervalKm) || 5000,
        oil_interval_months: Number(oilIntervalMonths) || 3,
        home_base: homeBase.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const result = isEdit
        ? await updateVehicleAction(vehicle.cvhId, { ...payload, status })
        : await createVehicleAction(payload);

      if (result.success) {
        toast.success(isEdit ? 'Vehicle updated' : 'Vehicle added', {
          description: result.data.cvhPlateNumber,
        });
        router.push(`/vehicles/${result.data.cvhId}`);
        router.refresh();
      } else {
        toast.error(isEdit ? 'Could not update' : 'Could not create', {
          description: `${result.error.code} — ${result.error.message}`,
        });
      }
    });
  };

  const onDelete = () => {
    if (!vehicle) return;
    if (!confirm(`Remove ${vehicle.cvhPlateNumber}? This soft-deletes the vehicle — trip history is preserved.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteVehicleAction(vehicle.cvhId);
      if (result.success) {
        toast.success('Vehicle removed');
        router.push('/vehicles');
        router.refresh();
      } else {
        toast.error('Could not remove', { description: `${result.error.code} — ${result.error.message}` });
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
            <CardTitle>Vehicle details</CardTitle>
            <CardDescription>Identification and ownership data.</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="License plate" required>
              <Input value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="51K-238.91" maxLength={20} className="font-mono" />
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as CarVehicleStatus)} disabled={!isEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.replace('_', ' ').toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Model" required>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Hyundai Staria 11" maxLength={100} />
            </Field>
            <Field label="Make">
              <Input value={make ?? ''} onChange={(e) => setMake(e.target.value)} placeholder="Hyundai" maxLength={50} />
            </Field>
            <Field label="Year">
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} min={1990} max={2100} />
            </Field>
            <Field label="Color">
              <Input value={color ?? ''} onChange={(e) => setColor(e.target.value)} placeholder="Pearl White" maxLength={50} />
            </Field>
            <Field label="Fuel type">
              <Select value={fuelType} onValueChange={(v) => setFuelType(v as CarVehicleFuel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Home base">
              <Input value={homeBase ?? ''} onChange={(e) => setHomeBase(e.target.value)} placeholder="HCMC HQ" maxLength={100} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Mileage &amp; maintenance</CardTitle>
            <CardDescription>Used for oil-change reminders.</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Odometer (km)">
              <Input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} min={0} inputMode="numeric" />
            </Field>
            <Field label="Oil change every (km)">
              <Input type="number" value={oilIntervalKm} onChange={(e) => setOilIntervalKm(e.target.value)} min={1000} max={30000} inputMode="numeric" />
            </Field>
            <Field label="Or every (months)">
              <Input type="number" value={oilIntervalMonths} onChange={(e) => setOilIntervalMonths(e.target.value)} min={1} max={24} inputMode="numeric" />
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
          <Textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes, quirks, accessories…" rows={3} maxLength={2000} />
        </CardContent>
      </Card>

      <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
        sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
        {isEdit && (
          <Button type="button" variant="danger" size="lg" onClick={onDelete} disabled={pending} iconLeft={<Trash2 />} className="md:mr-auto">
            Remove
          </Button>
        )}
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href={isEdit ? `/vehicles/${vehicle.cvhId}` : '/vehicles'}>Cancel</Link>
        </Button>
        <Button type="submit" variant="accent" size="lg" className="flex-1 md:flex-initial" disabled={pending}
          iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add vehicle'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block" required={required}>{label}</Label>
      {children}
    </div>
  );
}
