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
import type { FuelInvoiceRow } from '@/server/queries/truck-finance.queries';

/** Monthly fuel-invoice ledger + add form. The derived month-end snapshot
 * (avg price / consumption / total fuel) is shown by the page's computation
 * card; this panel just manages the invoice rows (REQ-20260629). */
export function FuelInvoicePanel({
  month,
  region,
  invoices,
  vehicles,
  locked,
}: {
  month: string;
  /** Invoices + the add form are scoped to this operating region. */
  region: string;
  invoices: FuelInvoiceRow[];
  /** Trucks in this region — the invoice must say WHICH vehicle was filled so
   * its fuel can be allocated across that vehicle's trips (REQ-20260726). */
  vehicles: { id: string; plate: string }[];
  locked: boolean;
}) {
  const t = useTranslations('screens.truckPnl');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    date: `${month}-01`,
    station: '',
    liters: '',
    price: '',
    vehicleId: '',
  });
  const plateById = new Map(vehicles.map((v) => [v.id, v.plate]));
  const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

  const add = () =>
    start(async () => {
      const res = await addFuelInvoiceAction({
        date: f.date,
        station: f.station || undefined,
        region,
        vehicle_id: f.vehicleId || undefined,
        liters: Number(f.liters || 0),
        price: Number(f.price || 0),
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('invoiceAdded'));
      setF({ date: `${month}-01`, station: '', liters: '', price: '', vehicleId: '' });
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
      {invoices.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {invoices.map((i) => (
            <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="tabular text-text-faint w-24 shrink-0">{i.date}</span>
              {/* Which vehicle was filled — the basis of the per-trip allocation. */}
              <span
                className={
                  'font-mono shrink-0 w-28 truncate ' +
                  (i.vehicleId ? 'text-text' : 'text-warning')
                }
              >
                {i.vehicleId ? (plateById.get(i.vehicleId) ?? '—') : t('invoiceNoVehicle')}
              </span>
              <span className="flex-1 truncate text-text-muted">{i.station ?? '—'}</span>
              <span className="tabular text-text shrink-0">{i.liters} L</span>
              <span className="tabular text-text-muted shrink-0">× {vnd(i.price)}</span>
              {!locked && (
                <button
                  type="button"
                  onClick={() => del(i.id)}
                  disabled={pending}
                  aria-label={t('deleteInvoice')}
                  className="inline-flex items-center justify-center h-9 w-9 -mr-1.5 shrink-0 text-text-faint hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
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
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
          <Input type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} />
          {/* Vehicle is what makes the fuel allocatable per trip — without it the
            * invoice only feeds the legacy region pool. */}
          <select
            value={f.vehicleId}
            onChange={(e) => setF((s) => ({ ...s, vehicleId: e.target.value }))}
            className="h-11 md:h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('invoiceSelectVehicle')}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </select>
          <Input placeholder={t('station')} value={f.station} onChange={(e) => setF((s) => ({ ...s, station: e.target.value }))} />
          <Input type="number" placeholder={t('liters')} value={f.liters} onChange={(e) => setF((s) => ({ ...s, liters: e.target.value }))} />
          <Input type="number" placeholder={t('price')} value={f.price} onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))} />
          <Button size="sm" className="h-11 md:h-9" variant="accent" disabled={pending} onClick={add} iconLeft={pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}>
            {t('addInvoice')}
          </Button>
        </div>
      )}
    </Card>
  );
}
