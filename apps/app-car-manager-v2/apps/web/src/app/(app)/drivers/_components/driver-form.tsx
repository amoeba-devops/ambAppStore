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
import type { CarDriver, CarDriverLicenseClass, CarDriverStatus, CarVehicleType } from '@car-v2/db/schema';
import { MoneyInput } from '@/components/inputs/money-input';
import { ConfirmDeleteDialog, type DeleteWarningRef } from '@/components/dialogs/confirm-delete-dialog';
import { RefDetailPanel } from '@/components/dialogs/ref-detail-panel';
import { DraftRestoreBanner } from '@/components/forms/draft-restore-banner';
import { useFormDraft } from '@/hooks/use-form-draft';
import { formatActionError } from '@/lib/format-action-error';
import type { DriverCandidate } from '@/server/queries/drivers.queries';
import {
  createDriverAction,
  updateDriverAction,
  deleteDriverAction,
  getDriverDeleteWarningsAction,
} from '@/server/actions/drivers/driver.actions';

/** Mirror AMA normalize — preview only, server validate lại. */
function normalizePreview(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('84') && digits.length === 11) digits = '0' + digits.slice(2);
  return digits;
}
function isValidVnMobile(phone: string): boolean {
  return /^0[35789]\d{8}$/.test(phone);
}

interface DriverDraftValues {
  userId: string;
  licenseNumber: string;
  licenseClass: CarDriverLicenseClass;
  licenseExpiry: string;
  phone: string;
  status: CarDriverStatus;
  emergencyContact: string;
  fixedSalary: string;
  notes: string;
}

const LICENSE_CLASSES: CarDriverLicenseClass[] = ['A2', 'B1', 'B2', 'C', 'D', 'E', 'F'];
const STATUSES: CarDriverStatus[] = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'UNAVAILABLE'];

interface DriverFormProps {
  driver?: CarDriver & { user?: { usrName?: string | null; usrEmail?: string | null } };
  userCandidates?: DriverCandidate[];
  /** When creating from a department surface (e.g. truck): the new driver is
   * also granted that fleet membership, and navigation returns to its roster. */
  dept?: CarVehicleType;
}

export function DriverForm({ driver, userCandidates = [], dept }: DriverFormProps) {
  const t       = useTranslations('drivers.form');
  const tList   = useTranslations('drivers.list');
  const tStatus = useTranslations('drivers.status');
  const tTripStatus = useTranslations('trips.status');
  const tA      = useTranslations('actions');
  /* Role labels for the candidate picker — reuses the existing map rather than
   * adding a fourth copy of ADMIN/MANAGER/DRIVER. */
  const tRole   = useTranslations('settings.me.roles');
  const tErr    = useTranslations();
  const locale  = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isEdit = !!driver;

  const [userId, setUserId] = useState(driver?.drvUserId ?? '');
  const [licenseNumber, setLicenseNumber] = useState(driver?.drvLicenseNumber ?? '');
  const [licenseClass, setLicenseClass] = useState<CarDriverLicenseClass>(driver?.drvLicenseClass ?? 'B2');
  const [licenseExpiry, setLicenseExpiry] = useState<string>(driver?.drvLicenseExpiry ?? '');
  const [phone, setPhone] = useState(driver?.drvPhone ?? '');
  const [status, setStatus] = useState<CarDriverStatus>(driver?.drvStatus ?? 'AVAILABLE');
  const [emergencyContact, setEmergencyContact] = useState(driver?.drvEmergencyContact ?? '');
  const [fixedSalary, setFixedSalary] = useState(driver?.drvFixedSalary ?? '');
  const [notes, setNotes] = useState(driver?.drvNotes ?? '');
  const isTruck = dept === 'TRUCK';

  /* Track whether user has made any changes — draft is only saved when dirty. */
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);

  const draftValues: DriverDraftValues = {
    userId,
    licenseNumber,
    licenseClass,
    licenseExpiry,
    phone,
    status,
    emergencyContact,
    fixedSalary,
    notes,
  };
  const driverLabel = isEdit
    ? {
        primary: t('draftLabelEdit', {
          name: driver!.user?.usrName ?? driver!.drvLicenseNumber,
        }),
        secondary: driver!.drvLicenseNumber
          ? `${driver!.drvLicenseClass} · ${driver!.drvLicenseNumber}`
          : undefined,
      }
    : {
        primary: t('draftLabelNew'),
        secondary:
          [licenseClass, licenseNumber.trim(), phone.trim()]
            .filter(Boolean)
            .join(' · ') || undefined,
      };
  const { draft, clearDraft, dismissDraft } = useFormDraft<DriverDraftValues>({
    key: isEdit ? `driver:edit:${driver!.drvId}` : dept ? `driver:new:${dept}` : 'driver:new',
    values: draftValues,
    label: driverLabel,
    href: isEdit
      ? `/drivers/${driver!.drvId}/edit`
      : dept === 'TRUCK'
        ? '/truck/drivers/new'
        : '/drivers/new',
    entity: 'driver',
    isDirty,
  });

  const handleRestoreDraft = () => {
    if (!draft) return;
    const v = draft.values;
    setUserId(v.userId);
    setLicenseNumber(v.licenseNumber);
    setLicenseClass(v.licenseClass);
    setLicenseExpiry(v.licenseExpiry);
    setPhone(v.phone);
    setStatus(v.status);
    setEmergencyContact(v.emergencyContact);
    setFixedSalary(v.fixedSalary ?? '');
    setNotes(v.notes);
    setIsDirty(true); // Restored draft should be persisted
    dismissDraft();
  };

  const phoneValid = !phone || isValidVnMobile(normalizePreview(phone));

  const onSubmit = () => {
    if (!isEdit && !userId) {
      toast.error(t('errPickUser'), { description: t('errPickUserDesc') });
      return;
    }
    if (!licenseNumber.trim() || !licenseExpiry) {
      toast.error(t('errMissing'), { description: t('errMissingDesc') });
      return;
    }
    if (phone && !phoneValid) {
      toast.error(t('phoneInvalidToast'), {
        description: t('phoneInvalidDesc'),
      });
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
        /* Salary is a TRUCK-only field; leave undefined elsewhere so update
         * never touches it. Empty input clears it (null). */
        fixed_salary: isTruck ? (fixedSalary.trim() === '' ? null : Number(fixedSalary)) : undefined,
      };

      /* Phone là contact info local trong car_drivers — KHÔNG đẩy ngược lên
       * AMA (Option 1b: car-v2 không mutate AMA member data). Nếu cần sync
       * sang AMA, admin tự cập nhật ở AMA UI. */
      const result = isEdit
        ? await updateDriverAction(driver.drvId, { ...basePayload, status })
        : await createDriverAction({
            ...basePayload,
            user_id: userId,
            vehicle_type: dept,
            status,
          });

      if (result.success) {
        clearDraft();
        toast.success(isEdit ? t('tUpdated') : t('tAdded'));
        /* Truck create returns to its roster; car create opens the detail.
         * Tests `dept === 'TRUCK'`, not `!dept` — /drivers/new now passes
         * dept="CAR" (so the CAR membership gets granted), and the old check
         * would have read that as "truck" and redirected car creates to
         * /truck/drivers. */
        router.push(
          isEdit || dept !== 'TRUCK' ? `/drivers/${result.data.drvId}` : '/truck/drivers',
        );
        router.refresh();
      } else {
        toast.error(isEdit ? t('errUpdate') : t('errCreate'), {
          description: formatActionError(result.error, tErr),
        });
      }
    });
  };

  const handleDelete = async () => {
    if (!driver) return;
    const result = await deleteDriverAction(driver.drvId);
    if (result.success) {
      toast.success(t('tRemoved'));
      /* Return to the roster the driver belongs to (Sheet-2 DR11) — truck
       * drivers back to /truck/drivers, not the car roster. */
      router.push(dept === 'TRUCK' ? '/truck/drivers' : '/drivers');
      router.refresh();
    } else {
      toast.error(t('errRemove'), { description: formatActionError(result.error, tErr) });
      throw new Error('Delete failed'); // Keep dialog open on error
    }
  };

  const fetchDeleteWarnings = async () => {
    if (!driver) return [];
    const result = await getDriverDeleteWarningsAction(driver.drvId);
    if (result.success) {
      // Translate warning messages using i18n and add hrefs
      return result.data.warnings.map((w) => ({
        ...w,
        message:
          w.type === 'active_trips'
            ? t('warningActiveTrips', { count: w.count })
            : w.type === 'pending_expenses'
              ? t('warningPendingExpenses', { count: w.count })
              : w.message,
        refs: w.refs?.map((ref) => ({
          ...ref,
          href: w.type === 'active_trips' ? `/trips/${ref.id}` : `/costs?highlight=${ref.id}`,
        })),
      }));
    }
    return [];
  };

  const driverName = driver?.user?.usrName ?? driver?.drvLicenseNumber ?? '';

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
            <CardTitle>{t('sectionAccount')}</CardTitle>
            <CardDescription>
              {isEdit ? t('sectionAccountEditDesc') : t('sectionAccountNewDesc')}
            </CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          {isEdit ? (
            <div className="rounded border border-border bg-surface-2/40 px-4 py-3 text-sm">
              <div className="text-text-faint text-xs uppercase tracking-wide mb-0.5">{t('user')}</div>
              <div className="text-text font-medium">{driver?.user?.usrName ?? driver?.drvUserId}</div>
              {driver?.user?.usrEmail && <div className="text-text-muted text-xs">{driver.user.usrEmail}</div>}
            </div>
          ) : (
            <Field label={t('user')} required>
              <Select value={userId} onValueChange={(v) => { setUserId(v); markDirty(); }}>
                <SelectTrigger><SelectValue placeholder={t('userPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {userCandidates.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-text-faint italic">
                      {t('noCandidates')}
                    </div>
                  ) : (
                    userCandidates.map((u) => (
                      <SelectItem key={u.usrId} value={u.usrId}>
                        {u.usrName ?? u.usrEmail ?? u.usrId}
                        {/* Email next to the name — display names are NOT unique
                          * (staging currently has two users called "김익용",
                          * fremdung@gmail.com vs fremd@naver.com), and the email
                          * is the only thing a human can tell them apart by.
                          * Skipped when the email is already serving as the
                          * primary label above. Radix also folds these children
                          * into its typeahead, so typing an email jumps to the
                          * right person, and into SelectValue, so the trigger
                          * keeps showing WHICH one was picked. */}
                        {u.usrName && u.usrEmail && (
                          <span className="ml-2 text-xs text-text-faint">{u.usrEmail}</span>
                        )}
                        {/* Flag the non-drivers. Making a MANAGER into a driver
                          * is allowed, but it should be a visible choice — three
                          * managers already hold driver rows and carry trucks'
                          * salary lines because this picker never said so. */}
                        {u.usrLocalRole !== 'DRIVER' && (
                          <span className="ml-2 text-xs text-text-faint">
                            · {tRole(u.usrLocalRole)}
                          </span>
                        )}
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
            <CardTitle>{t('sectionLicense')}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('licenseNumber')} required>
              <Input value={licenseNumber} onChange={(e) => { setLicenseNumber(e.target.value); markDirty(); }} placeholder={t('licenseNumberPlaceholder')} maxLength={50} className="font-mono" />
            </Field>
            <Field label={t('class')} required>
              <Select value={licenseClass} onValueChange={(v) => { setLicenseClass(v as CarDriverLicenseClass); markDirty(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LICENSE_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>{tList('classLabel', { class: c })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('expiry')} required hint={t('expiryHint')}>
              <Input type="date" value={licenseExpiry} onChange={(e) => { setLicenseExpiry(e.target.value); markDirty(); }} />
            </Field>
            {/* Status renders on create too (QA P2) — defaults to AVAILABLE. */}
            <Field label={t('status')}>
              <Select value={status} onValueChange={(v) => { setStatus(v as CarDriverStatus); markDirty(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{tStatus(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {/* Phone là contact info local trong car_drivers (admin gọi tài xế).
             *  Login = email, không liên quan SĐT. Render cả ở create + edit mode. */}
            <Field label={t('phone')}>
              <Input
                value={phone ?? ''}
                onChange={(e) => { setPhone(e.target.value); markDirty(); }}
                placeholder={t('phonePlaceholder')}
                type="tel"
                inputMode="tel"
                pattern="[+0-9\s\-]{9,15}"
                maxLength={20}
                className={
                  'font-mono ' +
                  (phone && !phoneValid ? 'border-danger focus-visible:border-danger' : '')
                }
              />
              {phone && !phoneValid && (
                <div className="text-xs text-danger mt-1">{t('phoneInvalid')}</div>
              )}
            </Field>
            <Field label={t('emergencyContact')}>
              <Input value={emergencyContact ?? ''} onChange={(e) => { setEmergencyContact(e.target.value); markDirty(); }} placeholder={t('emergencyPlaceholder')} maxLength={100} />
            </Field>
            {isTruck && (
              <Field label={t('fixedSalary')} hint={t('fixedSalaryHint')}>
                <MoneyInput
                  value={fixedSalary ?? ''}
                  onChange={(v) => { setFixedSalary(v); markDirty(); }}
                  placeholder={t('fixedSalaryPlaceholder')}
                />
              </Field>
            )}
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
          <Link href={isEdit ? `/drivers/${driver.drvId}` : dept === 'TRUCK' ? '/truck/drivers' : '/drivers'}>
            {tA('cancel')}
          </Link>
        </Button>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="flex-1 md:flex-initial"
          disabled={pending || (Boolean(phone) && !phoneValid)}
          iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}
        >
          {pending ? t('submitSaving') : isEdit ? t('submitSave') : t('submitAdd')}
        </Button>
      </div>

      {isEdit && (
        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t('deleteDialogTitle')}
          description={t('confirmRemove', { name: driverName })}
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

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block" required={required}>{label}</Label>
      {children}
      {hint && <div className="text-xs text-text-faint mt-1">{hint}</div>}
    </div>
  );
}
