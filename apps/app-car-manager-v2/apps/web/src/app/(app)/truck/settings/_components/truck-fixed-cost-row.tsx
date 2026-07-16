'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Truck } from 'lucide-react';
import { Button, Card, Input, Label, toast } from '@car-v2/ui';
import { upsertTruckFixedCostAction } from '@/server/actions/settings/truck-fixed-cost.actions';
import { formatActionError } from '@/lib/format-action-error';

interface Props {
  vehicleId: string;
  plate: string;
  model: string;
  month: string;
  initial: { salary: number; depreciation: number; insurance: number };
  /** Month book is closed → read-only (server also rejects). */
  locked?: boolean;
}

const numOrZero = (s: string) => (s.trim() === '' ? 0 : Number(s));

export function TruckFixedCostRow({ vehicleId, plate, model, month, initial, locked = false }: Props) {
  const t = useTranslations('screens.truckSettings');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState({
    salary: initial.salary ? String(initial.salary) : '',
    depreciation: initial.depreciation ? String(initial.depreciation) : '',
    insurance: initial.insurance ? String(initial.insurance) : '',
  });

  const save = () => {
    startTransition(async () => {
      const res = await upsertTruckFixedCostAction({
        vehicle_id: vehicleId,
        month,
        salary: numOrZero(v.salary),
        depreciation: numOrZero(v.depreciation),
        insurance: numOrZero(v.insurance),
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('savedToast', { plate }));
      router.refresh();
    });
  };

  return (
    <Card variant="outline" className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="h-4 w-4 text-text-muted" />
        <span className="font-mono font-semibold text-text">{plate}</span>
        <span className="text-sm text-text-muted truncate">· {model}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>{t('salary')}</Label>
          <Input type="number" disabled={locked} className="mt-1.5" value={v.salary} onChange={(e) => setV((s) => ({ ...s, salary: e.target.value }))} />
        </div>
        <div>
          <Label>{t('depreciation')}</Label>
          <Input type="number" disabled={locked} className="mt-1.5" value={v.depreciation} onChange={(e) => setV((s) => ({ ...s, depreciation: e.target.value }))} />
        </div>
        <div>
          <Label>{t('insurance')}</Label>
          <Input type="number" disabled={locked} className="mt-1.5" value={v.insurance} onChange={(e) => setV((s) => ({ ...s, insurance: e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <Button type="button" size="sm" className="h-11 md:h-9" variant="accent" disabled={pending || locked} onClick={save}
          iconLeft={pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}>
          {t('save')}
        </Button>
      </div>
    </Card>
  );
}
