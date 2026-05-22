'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Send } from 'lucide-react';
import { Button, Card, CardContent, Input, Label, Textarea, toast } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { DriverActionBar } from '@/components/layout/driver-action-bar';
import { submitExpenseAction } from '@/server/actions/expenses/expense.actions';
import { AmountInput } from './amount-input';
import { ExpenseTypeChipGrid, type ExpenseType } from './expense-type-chip-grid';
import { ReceiptCameraInput } from './receipt-camera-input';

export interface VehicleOption {
  id: string;
  plate: string;
  label: string | null;
}

export interface DriverOption {
  id: string;
  name: string;
}

interface ExpenseSubmitFormProps {
  /** Pre-link to a specific trip. When set we don't render the vehicle
   * picker — the server resolves the vehicle from the trip's record. */
  tripId?: string;
  /** Current user's role. Drives which extra pickers to render. */
  role: LocalRole;
  /** Pre-fetched vehicle list for the picker. Empty when `tripId` is set
   * (server resolves vehicle from trip) or DRIVER without an explicit
   * picker need. */
  vehicles: VehicleOption[];
  /** Drivers list — only used in ADMIN/MANAGER mode to optionally attribute
   * the expense. Empty for DRIVER (their own record is auto-attached). */
  drivers: DriverOption[];
}

/* Single-screen expense submission form. Used by both Driver (own expense
 * tied to a trip / a vehicle they're using) and Admin/Manager (recording
 * a fleet expense on behalf of a vehicle).
 *
 * Picker visibility:
 *   - tripId set      → no vehicle picker (resolved from trip), no driver
 *                       picker (auto-attached for Driver, irrelevant for staff)
 *   - tripId unset    → vehicle picker REQUIRED
 *     · staff role      → optional driver picker (which driver was using it)
 *     · driver role     → no driver picker (their own record auto-attaches)
 *
 * Submit flow:
 *   1. Client-side validate (type + amount > 0 + vehicle when no trip).
 *   2. Call `submitExpenseAction` — lands AUTO_APPROVED (no admin review).
 *   3. On success → toast + router.push to the right list per role. */
export function ExpenseSubmitForm({
  tripId,
  role,
  vehicles,
  drivers,
}: ExpenseSubmitFormProps) {
  const t  = useTranslations('expenses.submit');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isStaff = role === 'ADMIN' || role === 'MANAGER';
  /* Vehicle picker visibility — hidden whenever a trip context is provided
   * (server resolves the vehicle from the trip's vehicle_id). */
  const needsVehiclePicker = !tripId;

  const [type, setType] = useState<ExpenseType | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [driverId, setDriverId] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  /* Sub-stage of the submit transition. `pending` from useTransition is true
   * the whole time; this state tells the button which phase of work it's in:
   *   - { current, total }  → uploading file N of M to S3
   *   - 'submitting'        → uploads done, server action in flight
   *   - 'done'              → action resolved success (brief checkmark)
   *   - null                → idle */
  const [submitStage, setSubmitStage] =
    useState<{ current: number; total: number } | 'submitting' | 'done' | null>(null);

  const canSubmit =
    type !== null &&
    amount !== null &&
    amount > 0 &&
    !pending &&
    (!needsVehiclePicker || vehicleId !== '');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || type === null || amount === null) {
      if (type === null || amount === null) {
        toast.error(t('errMissing'), { description: t('errMissingDesc') });
      } else if (amount <= 0) {
        toast.error(t('errAmountInvalid'));
      } else if (needsVehiclePicker && vehicleId === '') {
        toast.error(t('errVehicleRequired'));
      }
      return;
    }
    startTransition(async () => {
      try {
        /* Step 1 — upload each receipt to S3 via presigned URL.
         *
         * Sequential to avoid hammering the upload endpoint; receipts are
         * small (≤5MB) and there are at most 5 of them, so the wall-clock
         * cost (~5×<2s on 4G) is fine. Parallel uploads would also fight
         * iOS Safari's connection limit in PWA standalone. */
        const attachments: Array<{ s3_key: string; mime: string; size_bytes: number }> = [];
        for (let i = 0; i < files.length; i++) {
          /* Bump progress BEFORE the work so the button label shows the
           * file we're about to upload, not the one just finished. */
          setSubmitStage({ current: i + 1, total: files.length });
          const f = files[i]!;
          const presigned = await requestPresigned(f);
          await uploadToS3(presigned.uploadUrl, f);
          attachments.push({ s3_key: presigned.key, mime: f.type || 'application/octet-stream', size_bytes: f.size });
        }

        /* Step 2 — submit the metadata. The action persists the expense
         * row + attachment rows in a transaction. */
        setSubmitStage('submitting');
        const result = await submitExpenseAction({
          type,
          amount,
          occurred_at: occurredAt,
          note: note.trim() || undefined,
          trip_id: tripId,
          vehicle_id: needsVehiclePicker ? vehicleId : undefined,
          driver_id: isStaff && driverId !== '' ? driverId : undefined,
          attachments,
        });
        if (result.success) {
          /* Brief success affordance before navigation so the user gets a
           * confirmation of state-change beyond just the toast. */
          setSubmitStage('done');
          toast.success(t('submittedToast'), { description: t('submittedToastDesc') });
          /* Staff users land back on the cost ledger; drivers on their own
           * history. Both lists trigger revalidatePath in the action so
           * the new row shows up immediately. */
          router.push(isStaff ? '/costs' : '/expenses');
        } else {
          setSubmitStage(null);
          toast.error(t('errSubmit'), { description: `${result.error.code} — ${result.error.message}` });
        }
      } catch (err) {
        setSubmitStage(null);
        const msg = err instanceof Error ? err.message : 'unknown';
        toast.error(t('errSubmit'), { description: msg });
      }
    });
  };

  async function requestPresigned(f: File): Promise<{ uploadUrl: string; key: string }> {
    const res = await fetch('/api/v1/expenses/upload-presigned', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: f.name,
        content_type: f.type || 'application/octet-stream',
        size_bytes: f.size,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message ?? 'presign failed');
    }
    return json.data;
  }

  async function uploadToS3(url: string, f: File): Promise<void> {
    /* Direct PUT to S3. Don't set credentials or extra headers — the
     * presigned URL already encodes the content-type expected. Setting a
     * different header causes a signature mismatch. */
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': f.type || 'application/octet-stream' },
      body: f,
    });
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      /* `pb-[220px]` mirrors the trip detail driver view — keep the last
       * Textarea above the sticky <DriverActionBar>. */
      className="mx-auto max-w-2xl space-y-5 pb-[220px] md:pb-32"
    >
      {tripId && (
        <div className="text-xs text-text-muted bg-surface-2 rounded-md px-3 py-2">
          {t('tripLinked', { ref: tripId.slice(0, 8) })}
        </div>
      )}

      <Card>
        <CardContent>
          <div className="space-y-5">
            {/* Expense type */}
            <div>
              <Label id="exp-type-label" required className="mb-2 block">{t('typeLabel')}</Label>
              <ExpenseTypeChipGrid value={type} onChange={setType} labelledBy="exp-type-label" />
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="exp-amount" required className="mb-2 block">{t('amountLabel')}</Label>
              <AmountInput id="exp-amount" value={amount} onChange={setAmount} placeholder={t('amountPlaceholder')} />
            </div>

            {/* Vehicle picker — shown only when not linked to a trip. */}
            {needsVehiclePicker && (
              <div>
                <Label htmlFor="exp-vehicle" required className="mb-2 block">{t('vehicleLabel')}</Label>
                <select
                  id="exp-vehicle"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t('vehiclePlaceholder')}</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate}{v.label ? ` · ${v.label}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Driver picker — staff (ADMIN/MANAGER) only and only when not
              * tied to a trip. Optional; staff may not know which driver
              * was using the vehicle. */}
            {isStaff && needsVehiclePicker && drivers.length > 0 && (
              <div>
                <Label htmlFor="exp-driver" className="mb-2 block">{t('driverLabel')}</Label>
                <select
                  id="exp-driver"
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t('driverPlaceholder')}</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date */}
            <div>
              <Label htmlFor="exp-date" required className="mb-2 block">{t('dateLabel')}</Label>
              <Input
                id="exp-date"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>

            {/* Note */}
            <div>
              <Label htmlFor="exp-note" className="mb-2 block">{t('noteLabel')}</Label>
              <Textarea
                id="exp-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                rows={3}
              />
            </div>

            {/* Receipt */}
            <div>
              <Label className="mb-2 block">{t('receiptLabel')}</Label>
              <ReceiptCameraInput
                files={files}
                onChange={setFiles}
                onError={(key) => {
                  switch (key) {
                    case 'tooManyFiles':
                      toast.error(t('errTooManyFiles'));
                      return;
                    case 'fileTooLarge':
                      toast.error(t('errFileTooLarge'));
                      return;
                    case 'cameraDenied':
                      /* Show as info, not error — user hasn't done anything
                       * wrong, they probably just tapped Cancel or dismissed
                       * the iOS permission sheet. Includes the OS path so they
                       * can grant permission if that's what blocked them. */
                      toast.info(t('errCameraDenied'), {
                        description: t('errCameraDeniedDesc'),
                      });
                      return;
                    case 'heicConversionFailed':
                      toast.error(t('errHeicFailed'), {
                        description: t('errHeicFailedDesc'),
                      });
                      return;
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DriverActionBar>
        <Button
          type="submit"
          variant="accent"
          size="2xl"
          iconLeft={submitStage === 'done' ? <Check /> : <Send />}
          loading={pending && submitStage !== 'done'}
          disabled={!canSubmit}
        >
          {submitButtonLabel(submitStage, pending, t)}
        </Button>
      </DriverActionBar>
    </form>
  );
}

type SubmitStage = { current: number; total: number } | 'submitting' | 'done' | null;
type T = (key: string, vars?: Record<string, string | number>) => string;

/* Single source of truth for the submit button label across the 4 phases.
 * Kept outside the component so the JSX stays readable. */
function submitButtonLabel(stage: SubmitStage, pending: boolean, t: T): string {
  if (stage === 'done') return t('submittedToast');
  if (stage === 'submitting') return t('submitting');
  if (stage && typeof stage === 'object') {
    return t('submitUploading', { current: stage.current, total: stage.total });
  }
  return pending ? t('submitting') : t('submit');
}
