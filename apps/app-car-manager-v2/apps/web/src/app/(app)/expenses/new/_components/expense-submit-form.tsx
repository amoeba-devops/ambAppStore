'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Send } from 'lucide-react';
import { Button, Card, CardContent, Input, Label, Textarea, toast } from '@car-v2/ui';
import type { LocalRole } from '@car-v2/shared/auth';
import { DraftRestoreBanner } from '@/components/forms/draft-restore-banner';
import { useFormDraft } from '@/hooks/use-form-draft';
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
  const tA = useTranslations('actions');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isStaff = role === 'ADMIN' || role === 'MANAGER';
  /* Vehicle picker visibility — hidden whenever a trip context is provided
   * (server resolves the vehicle from the trip's vehicle_id). */
  const needsVehiclePicker = !tripId;
  const tDrafts = useTranslations('costs.types');

  /* Storage key embeds the trip context so a trip-linked draft doesn't
   * collide with a free-form one — same browser switching between the
   * two should each see its own unfinished form. */
  const draftKey = tripId ? `expense:new:trip:${tripId}` : 'expense:new';

  const [type, setType] = useState<ExpenseType | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [driverId, setDriverId] = useState<string>('');
  /* Receipts (File objects) deliberately NOT persisted — File can't be
   * structured-cloned into localStorage, and a half-uploaded photo isn't
   * a meaningful resume target. Re-pick on resume. */
  const [files, setFiles] = useState<File[]>([]);

  /* Draft cache — auto-save on change, surface in sidebar `Chi phí` (STAFF) /
   * `Ghi nhận chi phí` (Driver), restore via banner on next visit. Receipts
   * are intentionally excluded (see comment above). */
  const draftValues = useMemo(
    () => ({ type, amount, occurredAt, note, vehicleId, driverId }),
    [type, amount, occurredAt, note, vehicleId, driverId],
  );
  /* Sidebar label: primary = action verb, secondary = type + vehicle + amount
   * so the row reads as a self-explanatory chip ("FUEL · 51A-xxx · 500k₫").
   * We snapshot inputs the user has typed so they can recognise the draft. */
  const draftSecondary = useMemo(() => {
    if (!type && !amount) return undefined;
    const parts: string[] = [];
    if (type) parts.push(tDrafts(type));
    const plate = vehicles.find((v) => v.id === vehicleId)?.plate;
    if (plate) parts.push(plate);
    if (amount !== null && amount > 0) {
      parts.push(`${amount.toLocaleString('vi-VN')}₫`);
    }
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }, [type, amount, vehicleId, vehicles, tDrafts]);
  const { draft, clearDraft, dismissDraft } = useFormDraft({
    key: draftKey,
    values: draftValues,
    label: { primary: t('draftLabelNew'), secondary: draftSecondary },
    href: tripId ? `/expenses/new?tripId=${tripId}` : '/expenses/new',
    entity: 'expense',
  });

  const handleRestoreDraft = () => {
    if (!draft) return;
    const v = draft.values;
    setType(v.type);
    setAmount(v.amount);
    setOccurredAt(v.occurredAt);
    setNote(v.note);
    setVehicleId(v.vehicleId);
    setDriverId(v.driverId);
    dismissDraft();
  };
  /* Sub-stage of the submit transition. `pending` from useTransition is true
   * the whole time; this state tells the button which phase of work it's in:
   *   - { current, total }  → uploading file N of M to S3
   *   - 'submitting'        → uploads done, server action in flight
   *   - 'done'              → action resolved success (brief checkmark)
   *   - null                → idle */
  const [submitStage, setSubmitStage] =
    useState<{ current: number; total: number } | 'submitting' | 'done' | null>(null);

  /* Derive per-thumb upload state for `ReceiptCameraInput`.
   *
   * The submit transition is 1-based (`{ current: 1, total: 3 }` = first
   * file uploading); the camera input wants a 0-based pointer. During
   * `'submitting'`/`'done'`, all S3 PUTs are finished, so the pointer
   * advances past the last file so every thumb renders as ✓ done — visual
   * confirmation that the receipts landed while the action settles. */
  const uploadProgress = (() => {
    if (submitStage === null) return null;
    if (typeof submitStage === 'object') {
      return { currentIndex: submitStage.current - 1, total: submitStage.total };
    }
    return { currentIndex: files.length, total: files.length };
  })();

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
          /* Persist the same MIME we used for the presign + S3 PUT so the
           * stored attachment row matches the actual object's Content-Type
           * — keeps the later `<img src>` render in `/expenses/[id]` honest. */
          attachments.push({ s3_key: presigned.key, mime: resolveMime(f), size_bytes: f.size });
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
          /* Clear the localStorage draft + sidebar entry — submission is
           * permanent now, the half-typed snapshot has no value. */
          clearDraft();
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

  /* Resolve a MIME for the upload. `f.type` is empty surprisingly often —
   * some Android pickers, screenshot paste, older WebViews. The file input is
   * gated by `accept="image/*,image/heic,image/heif"` so anything reaching
   * here is an image; default to `image/jpeg` rather than the previous
   * `application/octet-stream` so:
   *   1. The server's content-type regex accepts it cleanly
   *   2. Later `<img src>` views render the receipt instead of trying to
   *      download an opaque binary blob. */
  function resolveMime(f: File): string {
    return f.type || 'image/jpeg';
  }

  async function requestPresigned(f: File): Promise<{ uploadUrl: string; key: string }> {
    const res = await fetch('/api/v1/expenses/upload-presigned', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: f.name,
        content_type: resolveMime(f),
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
     * presigned URL already encodes the content-type expected. The header
     * value MUST match what we sent to the presign route, so reuse
     * resolveMime() rather than re-deriving from `f.type` (would diverge
     * if f.type is empty). */
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': resolveMime(f) },
      body: f,
    });
    if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      /* No extra bottom padding needed — the action row below is now an
       * inline `sticky bottom-0` sibling (not a `fixed` overlay) so it
       * occupies real flow height and the last field stays above it by
       * default. AppShellClient already pads `<main>` to clear the
       * BottomTabNav, so the visual band the sticky bar parks above is
       * just the tab nav, nothing else. */
      className="mx-auto max-w-2xl space-y-5"
    >
      {tripId && (
        <div className="text-xs text-text-muted bg-surface-2 rounded-md px-3 py-2">
          {t('tripLinked', { ref: tripId.slice(0, 8) })}
        </div>
      )}

      {/* Draft restore — only shown when localStorage carries an unfinished
       * version of THIS form (key includes tripId so trip-linked drafts
       * don't leak into standalone, and vice versa). Receipts aren't part
       * of the snapshot; user re-picks if they want photos. */}
      {draft && (
        <DraftRestoreBanner
          savedAt={draft.savedAt}
          onRestore={handleRestoreDraft}
          onDiscard={clearDraft}
        />
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
                uploadProgress={uploadProgress}
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

      {/* Action row — matches the hybrid sticky/inline pattern used by the
       * Vehicle / Trip / Driver forms so the submit button reads the same
       * way across every form in the app:
       *   - Mobile: sticky bottom with backdrop blur, full-width buttons
       *     in the thumb zone. Negative margin breaks out of the form's
       *     px-4 padding so the bar spans the viewport edges.
       *   - Desktop (≥ md): static, right-aligned, fixed-width buttons.
       * Previously this form used `<DriverActionBar>` (fixed overlay,
       * size="2xl" full-width) which felt out of place on desktop and
       * inconsistent with the other admin forms. */}
      <div className="md:flex md:justify-end md:gap-2 md:pt-2 md:static md:bg-transparent md:px-0 md:py-0 md:border-t-0
        sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2">
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href={isStaff ? '/costs' : '/today'}>{tA('cancel')}</Link>
        </Button>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="flex-1 md:flex-initial md:min-w-[180px]"
          iconLeft={submitStage === 'done' ? <Check /> : <Send />}
          loading={pending && submitStage !== 'done'}
          disabled={!canSubmit}
        >
          {submitButtonLabel(submitStage, pending, t)}
        </Button>
      </div>
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
