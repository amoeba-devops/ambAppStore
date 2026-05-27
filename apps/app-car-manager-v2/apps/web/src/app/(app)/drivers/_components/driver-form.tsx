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
import type { CarDriver, CarDriverLicenseClass, CarDriverStatus } from '@car-v2/db/schema';
import { DraftRestoreBanner } from '@/components/forms/draft-restore-banner';
import { useFormDraft } from '@/hooks/use-form-draft';
import { formatActionError } from '@/lib/format-action-error';
import {
  createDriverAction,
  updateDriverAction,
} from '@/server/actions/drivers/driver.actions';
import { updateMemberAction } from '@/server/actions/users/update-member.action';

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
  notes: string;
}

const LICENSE_CLASSES: CarDriverLicenseClass[] = ['A2', 'B1', 'B2', 'C', 'D', 'E', 'F'];
const STATUSES: CarDriverStatus[] = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'UNAVAILABLE'];

interface DriverFormProps {
  driver?: CarDriver & { user?: { usrName?: string | null; usrEmail?: string | null } };
  userCandidates?: { usrId: string; usrName: string | null; usrEmail: string | null }[];
}

export function DriverForm({ driver, userCandidates = [] }: DriverFormProps) {
  const t       = useTranslations('drivers.form');
  const tList   = useTranslations('drivers.list');
  const tStatus = useTranslations('drivers.status');
  const tA      = useTranslations('actions');
  const tErr    = useTranslations();
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

  const draftValues: DriverDraftValues = {
    userId,
    licenseNumber,
    licenseClass,
    licenseExpiry,
    phone,
    status,
    emergencyContact,
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
    key: isEdit ? `driver:edit:${driver!.drvId}` : 'driver:new',
    values: draftValues,
    label: driverLabel,
    href: isEdit ? `/drivers/${driver!.drvId}/edit` : '/drivers/new',
    entity: 'driver',
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
    setNotes(v.notes);
    dismissDraft();
  };

  const normalizedPhone = normalizePreview(phone);
  const phoneChanged = isEdit && normalizedPhone !== (driver?.drvPhone ?? '');
  const phoneValid = !phone || isValidVnMobile(normalizedPhone);

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
        emergency_contact: emergencyContact.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      /* Phone là contact info — đẩy lên AMA member trước (source of truth cho
       * usr_phone), sau đó driver action sẽ tự re-sync drv_phone qua
       * resolveUserPhone(). Phone KHÔNG còn là login key (login = email),
       * nên không có warning/confirmation. */
      if (isEdit && phoneChanged && driver) {
        const memberRes = await updateMemberAction({
          userId: driver.drvUserId,
          phone: phone.trim(),
        });
        if (!memberRes.success) {
          toast.error(formatActionError(memberRes.error, tErr));
          return;
        }
      }

      const result = isEdit
        ? await updateDriverAction(driver.drvId, { ...basePayload, status })
        : await createDriverAction({
            ...basePayload,
            user_id: userId,
            // Phone auto-synced từ AMA user account trong server action — không
            // nhận từ form ở create mode.
          });

      if (result.success) {
        clearDraft();
        toast.success(isEdit ? t('tUpdated') : t('tAdded'));
        router.push(`/drivers/${result.data.drvId}`);
        router.refresh();
      } else {
        toast.error(isEdit ? t('errUpdate') : t('errCreate'), {
          description: formatActionError(result.error, tErr),
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
              <Select value={userId} onValueChange={setUserId}>
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
              <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder={t('licenseNumberPlaceholder')} maxLength={50} className="font-mono" />
            </Field>
            <Field label={t('class')} required>
              <Select value={licenseClass} onValueChange={(v) => setLicenseClass(v as CarDriverLicenseClass)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LICENSE_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>{tList('classLabel', { class: c })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('expiry')} required hint={t('expiryHint')}>
              <Input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
            </Field>
            {isEdit && (
              <Field label={t('status')}>
                <Select value={status} onValueChange={(v) => setStatus(v as CarDriverStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{tStatus(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {/* Phone là contact info (admin click-to-call). Login = email,
             *  nên không cần warning. Chỉ render ở edit mode — create mode
             *  phone auto-sync từ AMA user account trong server action. */}
            {isEdit && (
              <Field label={t('phone')}>
                <Input
                  value={phone ?? ''}
                  onChange={(e) => setPhone(e.target.value)}
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
            )}
            <Field label={t('emergencyContact')}>
              <Input value={emergencyContact ?? ''} onChange={(e) => setEmergencyContact(e.target.value)} placeholder={t('emergencyPlaceholder')} maxLength={100} />
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
          <Textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} placeholder={t('notesPlaceholder')} rows={3} maxLength={2000} />
        </CardContent>
      </Card>

      <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
        sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href={isEdit ? `/drivers/${driver.drvId}` : '/drivers'}>{tA('cancel')}</Link>
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
