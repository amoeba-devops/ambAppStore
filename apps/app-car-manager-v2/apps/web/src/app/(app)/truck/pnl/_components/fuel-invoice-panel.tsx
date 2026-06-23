'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button, Card, Input, toast } from '@car-v2/ui';
import {
  addFuelInvoiceAction,
  deleteFuelInvoiceAction,
} from '@/server/actions/settings/truck-finance.actions';
import { formatActionError } from '@/lib/format-action-error';
import type { FuelInvoiceRow, FuelStats } from '@/server/queries/truck-finance.queries';

/** Monthly fuel-invoice ledger + derived avg price / consumption (REQ-20260623 P3). */
export function FuelInvoicePanel({
  month,
  invoices,
  stats,
  locked,
}: {
  month: string;
  invoices: FuelInvoiceRow[];
  stats: FuelStats;
  locked: boolean;
}) {
  const t = useTranslations('screens.truckPnl');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ date: `${month}-01`, station: '', liters: '', price: '' });
  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

  const add = () =>
    start(async () => {
      const res = await addFuelInvoiceAction({
        date: f.date,
        station: f.station || undefined,
        liters: Number(f.liters || 0),
        price: Number(f.price || 0),
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('invoiceAdded'));
      setF({ date: `${month}-01`, station: '', liters: '', price: '' });
      router.refresh();
    });

  const del = (id: string) =>
    start(async () => {
      const res = await deleteFuelInvoiceAction({ id });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      router.refresh();
    });

  return (
    <Card variant="outline" className="p-4 space-y-3">
      <h2 className="text-sm font-semibold text-text">{t('fuelLedger')}</h2>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('avgPrice')} value={vnd(stats.avgPrice)} />
        <Stat label={t('consumption')} value={`${stats.consumption.toFixed(3)} L/km`} />
        <Stat label={t('invoiceLiters')} value={`${stats.invoiceLiters.toLocaleString('vi-VN')} L`} />
      </div>
      {invoices.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {invoices.map((i) => (
            <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="tabular text-text-faint w-24 shrink-0">{i.date}</span>
              <span className="flex-1 truncate text-text">{i.station ?? '—'}</span>
              <span className="tabular text-text shrink-0">{i.liters} L</span>
              <span className="tabular text-text-muted shrink-0">× {vnd(i.price)}</span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => del(i.id)}
                  disabled={pending}
                  aria-label={t('deleteInvoice')}
                  className="text-text-faint hover:text-danger shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {locked ? (
        <p className="text-xs text-text-faint">{t('lockedHint')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
          <Input type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} />
          <Input placeholder={t('station')} value={f.station} onChange={(e) => setF((s) => ({ ...s, station: e.target.value }))} />
          <Input type="number" placeholder={t('liters')} value={f.liters} onChange={(e) => setF((s) => ({ ...s, liters: e.target.value }))} />
          <Input type="number" placeholder={t('price')} value={f.price} onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))} />
          <Button size="sm" variant="accent" disabled={pending} onClick={add} iconLeft={pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}>
            {t('addInvoice')}
          </Button>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="font-semibold text-text tabular text-sm">{value}</div>
    </div>
  );
}
