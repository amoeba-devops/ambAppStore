'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
import { ConfirmDeleteDialog, type DeleteWarningRef } from '@/components/dialogs/confirm-delete-dialog';
import { RefDetailPanel } from '@/components/dialogs/ref-detail-panel';
import { DraftRestoreBanner } from '@/components/forms/draft-restore-banner';
import { useFormDraft } from '@/hooks/use-form-draft';
import { formatActionError } from '@/lib/format-action-error';
import {
  createVehicleAction,
  deleteVehicleAction,
  updateVehicleAction,
  getVehicleDeleteWarningsAction,
} from '@/server/actions/vehicles/vehicle.actions';

interface VehicleDraftValues {
  plateNumber: string;
  model: string;
  make: string;
  year: string;
  color: string;
  fuelType: CarVehicleFuel;
  status: CarVehicleStatus;
  odometer: string;
  oilIntervalKm: string;
  oilIntervalMonths: string;
  homeBase: string;
  notes: string;
}

const FUEL_TYPES: CarVehicleFuel[] = ['PETROL', 'DIESEL', 'HYBRID', 'EV'];
const STATUSES: CarVehicleStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];

interface VehicleFormProps {
  /* Pass the existing vehicle to enter edit mode; omit for create. */
  vehicle?: CarVehicle;
}

export function VehicleForm({ vehicle }: VehicleFormProps) {
  const t       = useTranslations('vehicles.form');
  const tStatus = useTranslations('vehicles.status');
  const tFuel   = useTranslations('vehicles.fuel');
  const tTripStatus = useTranslations('trips.status');
  const tA      = useTranslations('actions');
  const tErr    = useTranslations();
  const locale  = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

  /* Track whether user has made any changes — draft is only saved when dirty. */
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);

  const draftValues: VehicleDraftValues = {
    plateNumber,
    model,
    make,
    year,
    color,
    fuelType,
    status,
    odometer,
    oilIntervalKm,
    oilIntervalMonths,
    homeBase,
    notes,
  };
  /* Primary: action verb. Secondary: identifying info user already entered. */
  const vehicleLabel = isEdit
    ? {
        primary: t('draftLabelEdit', { plate: vehicle!.cvhPlateNumber }),
        secondary: [vehicle!.cvhMake, vehicle!.cvhModel].filter(Boolean).join(' ') || undefined,
      }
    : {
        primary: t('draftLabelNew'),
        secondary:
          [plateNumber.trim(), [make.trim(), model.trim()].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(' · ') || undefined,
      };
  const { draft, clearDraft, dismissDraft } = useFormDraft<VehicleDraftValues>({
    key: isEdit ? `vehicle:edit:${vehicle!.cvhId}` : 'vehicle:new',
    values: draftValues,
    label: vehicleLabel,
    href: isEdit ? `/vehicles/${vehicle!.cvhId}/edit` : '/vehicles/new',
    entity: 'vehicle',
    isDirty,
  });

  const handleRestoreDraft = () => {
    if (!draft) return;
    const v = draft.values;
    setPlateNumber(v.plateNumber);
    setModel(v.model);
    setMake(v.make);
    setYear(v.year);
    setColor(v.color);
    setFuelType(v.fuelType);
    setStatus(v.status);
    setOdometer(v.odometer);
    setOilIntervalKm(v.oilIntervalKm);
    setOilIntervalMonths(v.oilIntervalMonths);
    setHomeBase(v.homeBase);
    setNotes(v.notes);
    setIsDirty(true); // Restored draft should be persisted
    dismissDraft();
  };

  const onSubmit = () => {
    if (!plateNumber.trim() || !model.trim()) {
      toast.error(t('errMissing'), { description: t('errMissingDesc') });
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
        clearDraft();
        toast.success(isEdit ? t('tUpdated') : t('tAdded'), {
          description: result.data.cvhPlateNumber,
        });
        router.push(`/vehicles/${result.data.cvhId}`);
        router.refresh();
      } else {
        toast.error(isEdit ? t('errUpdate') : t('errCreate'), {
          description: formatActionError(result.error, tErr),
        });
      }
    });
  };

  const handleDelete = async () => {
    if (!vehicle) return;
    const result = await deleteVehicleAction(vehicle.cvhId);
    if (result.success) {
      toast.success(t('tRemoved'));
      router.push('/vehicles');
      router.refresh();
    } else {
      toast.error(t('errRemove'), { description: formatActionError(result.error, tErr) });
      throw new Error('Delete failed'); // Keep dialog open on error
    }
  };

  const fetchDeleteWarnings = async () => {
    if (!vehicle) return [];
    const result = await getVehicleDeleteWarningsAction(vehicle.cvhId);
    if (result.success) {
      // Translate warning messages using i18n and add hrefs
      return result.data.warnings.map((w) => ({
        ...w,
        message:
          w.type === 'active_trips'
            ? t('warningActiveTrips', { count: w.count })
            : w.type === 'linked_expenses'
              ? t('warningLinkedExpenses', { count: w.count })
              : w.message,
        refs: w.refs?.map((ref) => ({
          ...ref,
          href: w.type === 'active_trips' ? `/trips/${ref.id}` : `/costs?highlight=${ref.id}`,
        })),
      }));
    }
    return [];
  };

  return (
    <form
      className="max-w-[720px] mx-auto space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {draft && (
        <DraftRestoreBanner
          savedAt={draft.savedAt}
          onRestore={handleRestoreDraft}
          onDiscard={clearDraft}
        />
      )}

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionDetails')}</CardTitle>
            <CardDescription>{t('sectionDetailsDesc')}</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('plate')} required>
              <Input value={plateNumber} onChange={(e) => { setPlateNumber(e.target.value); markDirty(); }} placeholder={t('platePlaceholder')} maxLength={20} className="font-mono" />
            </Field>
            <Field label={t('status')}>
              <Select value={status} onValueChange={(v) => { setStatus(v as CarVehicleStatus); markDirty(); }} disabled={!isEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{tStatus(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('model')} required>
              <Input value={model} onChange={(e) => { setModel(e.target.value); markDirty(); }} placeholder={t('modelPlaceholder')} maxLength={100} />
            </Field>
            <Field label={t('make')}>
              <Input value={make ?? ''} onChange={(e) => { setMake(e.target.value); markDirty(); }} placeholder={t('makePlaceholder')} maxLength={50} />
            </Field>
            <Field label={t('year')}>
              <Input type="number" value={year} onChange={(e) => { setYear(e.target.value); markDirty(); }} min={1990} max={2100} />
            </Field>
            <Field label={t('color')}>
              <Input value={color ?? ''} onChange={(e) => { setColor(e.target.value); markDirty(); }} placeholder={t('colorPlaceholder')} maxLength={50} />
            </Field>
            <Field label={t('fuel')}>
              <Select value={fuelType} onValueChange={(v) => { setFuelType(v as CarVehicleFuel); markDirty(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((f) => (
                    <SelectItem key={f} value={f}>{tFuel(f)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('base')}>
              <Input value={homeBase ?? ''} onChange={(e) => { setHomeBase(e.target.value); markDirty(); }} placeholder={t('basePlaceholder')} maxLength={100} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionMileage')}</CardTitle>
            <CardDescription>{t('sectionMileageDesc')}</CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t('odometer')}>
              <Input type="number" value={odometer} onChange={(e) => { setOdometer(e.target.value); markDirty(); }} min={0} inputMode="numeric" />
            </Field>
            <Field label={t('oilEveryKm')}>
              <Input type="number" value={oilIntervalKm} onChange={(e) => { setOilIntervalKm(e.target.value); markDirty(); }} min={1000} max={30000} inputMode="numeric" />
            </Field>
            <Field label={t('oilEveryMonths')}>
              <Input type="number" value={oilIntervalMonths} onChange={(e) => { setOilIntervalMonths(e.target.value); markDirty(); }} min={1} max={24} inputMode="numeric" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('sectionNotes')}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <Textarea value={notes ?? ''} onChange={(e) => { setNotes(e.target.value); markDirty(); }} placeholder={t('notesPlaceholder')} rows={3} maxLength={2000} />
        </CardContent>
      </Card>

      <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
        sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
        {isEdit && (
          <Button type="button" variant="danger" size="lg" onClick={() => setDeleteDialogOpen(true)} disabled={pending} iconLeft={<Trash2 />} className="md:mr-auto">
            {t('submitRemove')}
          </Button>
        )}
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href={isEdit ? `/vehicles/${vehicle.cvhId}` : '/vehicles'}>{tA('cancel')}</Link>
        </Button>
        <Button type="submit" variant="accent" size="lg" className="flex-1 md:flex-initial" disabled={pending}
          iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}>
          {pending ? t('submitSaving') : isEdit ? t('submitSave') : t('submitAdd')}
        </Button>
      </div>

      {isEdit && (
        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t('deleteDialogTitle')}
          description={t('confirmRemove', { plate: vehicle.cvhPlateNumber })}
          confirmLabel={t('submitRemove')}
          cancelLabel={tA('cancel')}
          onConfirm={handleDelete}
          fetchWarnings={fetchDeleteWarnings}
          locale={locale}
          warningLabels={{
            loading: t('deleteWarningsLoading'),
            hasWarnings: t('deleteWarningsFound'),
            noWarnings: t('deleteNoWarnings'),
            more: (count) => t('warningMore', { count }),
            relatedTitle: t('relatedTrips'),
            viewFullDetails: t('viewFullDetails'),
            tripStatus: (status) => tTripStatus(status),
          }}
          renderRefDetail={(ref: DeleteWarningRef) => <RefDetailPanel refData={ref} />}
        />
      )}
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
