'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { Button, Card, CardContent, Input, Label, Textarea, toast } from '@car-v2/ui';
import { DriverActionBar } from '@/components/layout/driver-action-bar';
import { submitExpenseAction } from '@/server/actions/expenses/expense.actions';
import { AmountInput } from './amount-input';
import { ExpenseTypeChipGrid, type ExpenseType } from './expense-type-chip-grid';
import { ReceiptCameraInput } from './receipt-camera-input';

interface ExpenseSubmitFormProps {
  tripId?: string;
}

/* Single-screen expense submission form. State is local — RHF is overkill for
 * 5 fields and keeps the bundle slightly lighter on driver phones where every
 * KB of JS over 3G matters.
 *
 * Submit flow:
 *   1. Client-side validate (type + amount > 0). Everything else is optional.
 *   2. Call `submitExpenseAction` — currently a STUB (see action file).
 *   3. On success → toast + `router.push('/today')`. The stub mode banner
 *      under the form tells QA the submission won't show up in /costs yet. */
export function ExpenseSubmitForm({ tripId }: ExpenseSubmitFormProps) {
  const t  = useTranslations('expenses.submit');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState<ExpenseType | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const canSubmit = type !== null && amount !== null && amount > 0 && !pending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || type === null || amount === null) {
      if (type === null || amount === null) {
        toast.error(t('errMissing'), { description: t('errMissingDesc') });
      } else if (amount <= 0) {
        toast.error(t('errAmountInvalid'));
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
        for (const f of files) {
          const presigned = await requestPresigned(f);
          await uploadToS3(presigned.uploadUrl, f);
          attachments.push({ s3_key: presigned.key, mime: f.type || 'application/octet-stream', size_bytes: f.size });
        }

        /* Step 2 — submit the metadata. The action persists the expense
         * row + attachment rows in a transaction. */
        const result = await submitExpenseAction({
          type,
          amount,
          occurred_at: occurredAt,
          note: note.trim() || undefined,
          trip_id: tripId,
          attachments,
        });
        if (result.success) {
          toast.success(t('submittedToast'), { description: t('submittedToastDesc') });
          router.push('/expenses');
        } else {
          toast.error(t('errSubmit'), { description: `${result.error.code} — ${result.error.message}` });
        }
      } catch (err) {
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
          iconLeft={<Send />}
          loading={pending}
          disabled={!canSubmit}
        >
          {pending ? t('submitting') : t('submit')}
        </Button>
      </DriverActionBar>
    </form>
  );
}
