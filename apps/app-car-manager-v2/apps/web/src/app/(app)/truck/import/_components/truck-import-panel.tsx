'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import {
  Button,
  Card,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@car-v2/ui';
import type { TruckImportRow } from '@car-v2/shared/zod';
import { importTruckTripsAction } from '@/server/actions/imports/import.actions';
import { formatActionError } from '@/lib/format-action-error';
import type { OptionItem } from '@/app/(app)/truck/trips/_components/truck-trip-form';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const str = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
};
const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};
const int = (v: unknown): number | undefined => {
  const n = num(v);
  return n == null ? undefined : Math.trunc(n);
};
const dateStr = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v ?? '').trim();
};

export function TruckImportPanel({ vehicles, drivers }: { vehicles: OptionItem[]; drivers: OptionItem[] }) {
  const t = useTranslations('screens.truckImport');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [parsing, setParsing] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<TruckImportRow[]>([]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet!, { header: 1, blankrows: false });
      /* Skip the header row; map by column index (CR-Vietnam-Truck-v1 order). */
      const mapped: TruckImportRow[] = aoa
        .slice(1)
        .map((r) => ({
          date: dateStr(r[0]),
          start_time: str(r[2]),
          end_time: str(r[3]),
          customer: str(r[4]),
          pickup: str(r[5]),
          dropoff: str(r[6]),
          odo_start: int(r[7]),
          odo_end: int(r[8]),
          fuel_liters: num(r[9]),
          fuel_price: num(r[10]),
          toll: num(r[11]),
          other_amount: num(r[12]),
          other_note: str(r[13]),
          bol: str(r[14]),
          cdf: str(r[15]),
          revenue: num(r[16]),
        }))
        .filter((row) => row.date !== '');
      if (mapped.length === 0) {
        toast.error(t('noRows'));
        return;
      }
      setRows(mapped);
      setFileName(file.name);
    } catch {
      toast.error(t('parseError'));
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const canImport = vehicleId !== '' && driverId !== '' && rows.length > 0 && !pending;

  const runImport = () => {
    if (!canImport) return;
    startTransition(async () => {
      const res = await importTruckTripsAction({
        vehicle_id: vehicleId,
        driver_id: driverId,
        file_name: fileName,
        rows,
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('importedToast', { count: res.data.count }));
      router.push('/truck/trips');
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Step 1 — template */}
      <Card variant="outline" className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileSpreadsheet className="h-5 w-5 text-accent shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-text">{t('templateTitle')}</div>
            <div className="text-xs text-text-muted">{t('templateDesc')}</div>
          </div>
        </div>
        <Button asChild variant="ghost" size="md" iconLeft={<Download />}>
          <a href={`${BASE_PATH}/truck/import/template`}>{t('downloadTemplate')}</a>
        </Button>
      </Card>

      {/* Step 2 — target truck + driver */}
      <Card variant="outline" className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{t('vehicle')}</Label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder={t('selectVehicle')} />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t('driver')}</Label>
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder={t('selectDriver')} />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Step 3 — upload + preview */}
      <Card variant="outline" className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-medium text-text">{t('uploadTitle')}</div>
          <label className="inline-flex items-center gap-2 rounded-md border border-dashed border-accent bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent cursor-pointer hover:bg-accent-soft/70">
            {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {t('chooseFile')}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} disabled={parsing} />
          </label>
        </div>

        {rows.length > 0 && (
          <>
            <div className="text-xs text-text-muted">
              {t('parsedCount', { file: fileName, count: rows.length })}
            </div>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    <th className="text-left px-2 py-1.5">{t('colDate')}</th>
                    <th className="text-left px-2 py-1.5">{t('colCustomer')}</th>
                    <th className="text-right px-2 py-1.5">{t('colRevenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-2 py-1.5">{r.date}</td>
                      <td className="px-2 py-1.5">{r.customer ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular">
                        {r.revenue != null ? r.revenue.toLocaleString('vi-VN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 8 && (
              <div className="text-xs text-text-faint">{t('andMore', { n: rows.length - 8 })}</div>
            )}
          </>
        )}
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="lg" disabled={!canImport} onClick={runImport}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {t('runImport')}
        </Button>
      </div>
    </div>
  );
}
