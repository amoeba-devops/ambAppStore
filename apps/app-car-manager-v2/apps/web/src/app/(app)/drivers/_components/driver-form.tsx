'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, KeyRound, Loader2, Save } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

  const originalPhone = driver?.drvPhone ?? '';
  const normalizedPhone = normalizePreview(phone);
  const phoneChanged = isEdit && normalizedPhone !== originalPhone;
  const phoneValid = !phone || isValidVnMobile(normalizedPhone);
  const [confirmPhoneOpen, setConfirmPhoneOpen] = useState(false);

  const doSubmit = () => {
    startTransition(async () => {
      const basePayload = {
        license_number: licenseNumber.trim(),
        license_class: licenseClass,
        license_expiry: licenseExpiry,
        emergency_contact: emergencyContact.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      /* Phone edit ở edit-mode: gọi updateMemberAction TRƯỚC để đồng bộ AMA's
       * `usr_phone` (source of truth cho phone-login). Driver action sau sẽ
       * tự re-sync drv_phone qua resolveUserPhone(). Nếu update AMA fail, dừng
       * lại — không cho driver mismatch. */
      if (isEdit && phoneChanged && driver) {
        const memberRes = await updateMemberAction({
          userId: driver.drvUserId,
          phone: phone.trim(),
        });
        if (!memberRes.success) {
          toast.error('Không đổi được SĐT', {
            description: formatActionError(memberRes.error, tErr),
          });
          return;
        }
      }

      const result = isEdit
        ? await updateDriverAction(driver.drvId, { ...basePayload, status })
        : await createDriverAction({
            ...basePayload,
            user_id: userId,
            phone: phone.trim() || undefined,
          });

      if (result.success) {
        clearDraft();
        toast.success(isEdit ? t('tUpdated') : t('tAdded'));
        if (phoneChanged) {
          toast.info('Tài xế cần đăng nhập lại bằng SĐT mới');
        }
        setConfirmPhoneOpen(false);
        router.push(`/drivers/${result.data.drvId}`);
        router.refresh();
      } else {
        toast.error(isEdit ? t('errUpdate') : t('errCreate'), {
          description: formatActionError(result.error, tErr),
        });
      }
    });
  };

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
      toast.error('SĐT không hợp lệ', {
        description: 'Yêu cầu 10 chữ số bắt đầu 03/05/07/08/09.',
      });
      return;
    }
    /* Đổi SĐT login → bắt buộc xác nhận. Banner trong form chỉ là nhắc lần 1,
     * dialog là rào chắn lần 2 trước khi commit. */
    if (phoneChanged) {
      setConfirmPhoneOpen(true);
      return;
    }
    doSubmit();
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
            {/* CRITICAL phone field — chỉ edit mode mới editable. Create mode
             *  phone sẽ resolve từ AMA sau khi link user (server action). */}
            {isEdit ? (
              <Field label={t('phone')}>
                <div className="rounded-md border-2 border-danger/40 bg-danger-soft/30 p-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <KeyRound className="h-4 w-4 text-danger shrink-0 mt-0.5" aria-hidden />
                    <div className="text-xs text-text-muted leading-relaxed">
                      <strong className="text-danger">SĐT đăng nhập</strong> — đổi sai
                      = tài xế không vào app được. Lưu ý: đổi xong tài xế PHẢI đăng nhập lại.
                    </div>
                  </div>
                  <Input
                    value={phone ?? ''}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0904567890 hoặc +84 904567890"
                    type="tel"
                    inputMode="tel"
                    pattern="[+0-9\s\-]{9,15}"
                    maxLength={20}
                    className={
                      'font-mono ' +
                      (phone && !phoneValid ? 'border-danger focus-visible:border-danger' : '')
                    }
                  />
                  {phone && (
                    <div className="text-xs flex items-center justify-end gap-1.5">
                      <span
                        className={
                          'font-mono tabular ' +
                          (phoneValid ? 'text-success font-semibold' : 'text-danger')
                        }
                      >
                        {phoneValid
                          ? `→ ${normalizedPhone}${phoneChanged ? ' (THAY ĐỔI)' : ''}`
                          : '✗ Không hợp lệ'}
                      </span>
                    </div>
                  )}
                </div>
              </Field>
            ) : (
              <Field
                label={t('phone')}
                hint="SĐT sẽ lấy từ user account sau khi link — không cần nhập tay ở đây."
              >
                <Input
                  value=""
                  readOnly
                  disabled
                  placeholder="(Tự lấy từ user account)"
                  className="font-mono bg-surface-2 text-text-muted cursor-not-allowed"
                />
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

      {/* Phone-change confirmation — driver login sẽ thay đổi, admin phải xác nhận. */}
      <Dialog open={confirmPhoneOpen} onOpenChange={(o) => !pending && setConfirmPhoneOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="h-5 w-5" />
              Xác nhận đổi SĐT đăng nhập
            </DialogTitle>
            <DialogDescription>
              Tài xế sẽ phải đăng nhập lại bằng SĐT mới.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-surface-2 p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">Tài xế</span>
                <span className="font-medium text-text">
                  {driver?.user?.usrName ?? driver?.drvLicenseNumber ?? '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-text-muted">SĐT cũ</span>
                <span className="font-mono text-text-muted line-through tabular">
                  {originalPhone || '(chưa có)'}
                </span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-text-muted">SĐT mới</span>
                <span className="font-mono tabular font-bold text-danger">
                  {normalizedPhone}
                </span>
              </div>
            </div>
            <div className="rounded-md bg-warning-soft/40 border border-warning/30 p-3 text-xs text-text leading-relaxed">
              <strong className="text-warning-strong">Sau khi đổi:</strong>
              <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                <li>SĐT cũ <strong>KHÔNG</strong> dùng để đăng nhập app được nữa</li>
                <li>Tài xế phải <strong>đăng nhập lại</strong> bằng SĐT mới <code className="font-mono">{normalizedPhone}</code></li>
                <li>Token hiện tại của tài xế còn dùng được tối đa 1 giờ</li>
                <li>Hãy gọi báo tài xế trước khi xác nhận</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmPhoneOpen(false)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={doSubmit}
              disabled={pending}
              iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}
            >
              {pending ? 'Đang lưu…' : 'Xác nhận đổi SĐT'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
