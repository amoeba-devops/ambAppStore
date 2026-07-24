'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, Label, toast } from '@car-v2/ui';
import {
  driverCompleteTruckTripAction,
  completeTruckTripAction,
} from '@/server/actions/trips/truck-trip.actions';
import { formatActionError } from '@/lib/format-action-error';
import { CostReceiptInput, type ExistingCostAttachment } from '@/components/truck/cost-receipt-input';
import { fuelToastDescription } from '@/components/truck/fuel-toast';
import { uploadTruckCostFile } from '@/lib/truck-cost-upload';

const numF = (s: string) => (s.trim() === '' ? undefined : Number(s));
const numI = (s: string) => (s.trim() === '' ? undefined : Math.trunc(Number(s)));

type CostKind = 'FUEL' | 'TOLL' | 'EXTRA';
interface ReceiptBucket {
  existing: ExistingCostAttachment[];
  files: File[];
}
const RECEIPT_LABEL: Record<CostKind, string> = {
  FUEL: 'fuelReceipts',
  TOLL: 'tollReceipts',
  EXTRA: 'extraReceipts',
};

/** Attachments already saved on the trip (e.g. added at create time) — the
 * completion form shows them so completing doesn't silently drop them. */
export interface CompleteSectionAttachment {
  id: string;
  costKind: CostKind;
  s3Key: string;
  mime: string;
  sizeBytes: number;
  signedUrl: string | null;
}

interface ExtraRow {
  name: string;
  amount: string;
}

/**
 * Truck trip completion (P-E). Opened from the trip detail (not Home, per the
 * driver prototype). Captures the 7 metrics + a structured "other costs" list
 * ({name, amount} with +). Uses the driver-self action when mode='driver',
 * else the staff action.
 */
export function TruckCompleteSection({
  tripId,
  mode,
  existingAttachments = [],
}: {
  tripId: string;
  mode: 'driver' | 'staff';
  existingAttachments?: CompleteSectionAttachment[];
}) {
  const t = useTranslations('screens.truckComplete');
  const tR = useTranslations('screens.truckTrips.form');
  const tFuel = useTranslations('screens.truckFinance');
  const tErr = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [f, setF] = useState({ startTime: '', endTime: '', endOdo: '', fuelLiters: '', toll: '' });
  const [extras, setExtras] = useState<ExtraRow[]>([]);

  /* Receipt buckets (REQ-20260709) — seeded with any attachments already on the
   * trip so completing reconciles the full set instead of dropping them. */
  const [receipts, setReceipts] = useState<Record<CostKind, ReceiptBucket>>(() => {
    const init: Record<CostKind, ReceiptBucket> = {
      FUEL: { existing: [], files: [] },
      TOLL: { existing: [], files: [] },
      EXTRA: { existing: [], files: [] },
    };
    for (const a of existingAttachments) {
      init[a.costKind].existing.push({ id: a.id, s3Key: a.s3Key, mime: a.mime, sizeBytes: a.sizeBytes, signedUrl: a.signedUrl });
    }
    return init;
  });
  const setBucketExisting = (k: CostKind, next: ExistingCostAttachment[]) =>
    setReceipts((r) => ({ ...r, [k]: { ...r[k], existing: next } }));
  const setBucketFiles = (k: CostKind, next: File[]) =>
    setReceipts((r) => ({ ...r, [k]: { ...r[k], files: next } }));

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  const addExtra = () => setExtras((x) => [...x, { name: '', amount: '' }]);
  const setExtra = (i: number, k: keyof ExtraRow, v: string) =>
    setExtras((x) => x.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const removeExtra = (i: number) => setExtras((x) => x.filter((_, j) => j !== i));

  const buildCostAttachments = async (): Promise<
    { cost_kind: CostKind; s3_key: string; mime: string; size_bytes: number }[]
  > => {
    const out: { cost_kind: CostKind; s3_key: string; mime: string; size_bytes: number }[] = [];
    for (const k of ['FUEL', 'TOLL', 'EXTRA'] as const) {
      for (const e of receipts[k].existing) {
        out.push({ cost_kind: k, s3_key: e.s3Key, mime: e.mime, size_bytes: e.sizeBytes });
      }
      for (const file of receipts[k].files) {
        const up = await uploadTruckCostFile(file);
        out.push({ cost_kind: k, ...up });
      }
    }
    return out;
  };

  const submit = () => {
    startTransition(async () => {
      let cost_attachments: { cost_kind: CostKind; s3_key: string; mime: string; size_bytes: number }[];
      try {
        cost_attachments = await buildCostAttachments();
      } catch {
        toast.error(tR('receiptUploadFailed'));
        return;
      }
      const payload = {
        trip_id: tripId,
        start_time: f.startTime || undefined,
        end_time: f.endTime || undefined,
        end_odometer: numI(f.endOdo),
        fuel_liters: numF(f.fuelLiters),
        toll_fee: numF(f.toll),
        extra_costs: extras
          .filter((e) => e.name.trim() !== '' && e.amount.trim() !== '')
          .map((e) => ({ name: e.name.trim(), amount: Number(e.amount) })),
        cost_attachments,
      };
      const res =
        mode === 'driver'
          ? await driverCompleteTruckTripAction(payload)
          : await completeTruckTripAction(payload);
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      /* Say how the per-trip fuel was treated (REQ-20260724): averaged (invoices)
       * / vehicle rate (km × định mức × giá xe) / unset (xe chưa đặt → 0). */
      toast.success(t('completedToast'), {
        description: fuelToastDescription(res.data.fuelMode, tFuel),
      });
      router.refresh();
    });
  };

  if (!open) {
    return (
      <Button variant="accent" size="lg" className="w-full" onClick={() => setOpen(true)}>
        <Check className="h-4 w-4" />
        {t('completeCta')}
      </Button>
    );
  }

  return (
    <Card variant="elevated" className="p-4 space-y-4">
      <div className="text-sm font-semibold text-text">{t('title')}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('startTime')}>
          <Input type="datetime-local" value={f.startTime} onChange={set('startTime')} />
        </Field>
        <Field label={t('endTime')}>
          <Input type="datetime-local" value={f.endTime} onChange={set('endTime')} />
        </Field>
        <Field label={t('endOdo')}>
          <Input type="number" value={f.endOdo} onChange={set('endOdo')} />
        </Field>
        <Field label={t('toll')}>
          <Input type="number" value={f.toll} onChange={set('toll')} />
        </Field>
      </div>
      {/* Fuel is derived from the vehicle's rate × km (REQ-20260724) — no litres
       * input; entering the end odometer (km) is what drives the fuel cost. */}
      <p className="text-xs text-text-muted">{tFuel('fuelByTripKmHint')}</p>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>{t('extraSection')}</Label>
        </div>
        <div className="space-y-2">
          {extras.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={t('extraName')}
                value={row.name}
                onChange={(e) => setExtra(i, 'name', e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder={t('extraAmount')}
                value={row.amount}
                onChange={(e) => setExtra(i, 'amount', e.target.value)}
                className="w-32"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeExtra(i)} aria-label={t('extraRemove')}>
                <Trash2 className="h-4 w-4 text-text-faint" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={addExtra} iconLeft={<Plus className="h-3.5 w-3.5" />}>
            {t('extraAdd')}
          </Button>
        </div>
      </div>

      {/* Receipt/invoice attachments (REQ-20260709) — one bucket per cost kind. */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wide">{tR('receiptsSection')}</div>
        {(['FUEL', 'TOLL', 'EXTRA'] as const).map((k) => (
          <div key={k} className="space-y-1.5">
            <div className="text-xs text-text-muted">{tR(RECEIPT_LABEL[k])}</div>
            <CostReceiptInput
              existing={receipts[k].existing}
              onExistingChange={(next) => setBucketExisting(k, next)}
              files={receipts[k].files}
              onFilesChange={(next) => setBucketFiles(k, next)}
              disabled={pending}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="button" variant="accent" size="lg" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t('confirm')}
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
