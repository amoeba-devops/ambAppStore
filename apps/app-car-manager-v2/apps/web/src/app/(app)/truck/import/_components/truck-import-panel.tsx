'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import {
  Button,
  Card,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
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
/* Time-of-day cell → "HH:MM". xlsx `cellDates` turns a typed time into a
 * UTC-based 1899 Date, so read UTC components to recover what the user typed;
 * a plain text cell ("8:00") passes through unchanged. */
const timeStr = (v: unknown): string | undefined => {
  if (v == null || v === '') return undefined;
  if (v instanceof Date) {
    return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  return s === '' ? undefined : s;
};

/* System fields ← Excel columns. `kw` = header keywords for auto-mapping;
 * `def` = fallback column index (CR-Vietnam-Truck-v1 template order). */
const FIELDS = [
  { key: 'date', required: true, kw: ['ngày', 'date'], def: 0 },
  { key: 'start_time', kw: ['bắt đầu', 'giờ đi', 'start'], def: 2 },
  { key: 'end_time', kw: ['kết thúc', 'giờ về', 'end'], def: 3 },
  { key: 'customer', kw: ['khách', 'customer'], def: 4 },
  { key: 'pickup', kw: ['lấy hàng', 'xuất phát', 'điểm đi', 'pickup'], def: 5 },
  { key: 'stopover', kw: ['điểm ghé', 'ghé', 'waypoint', 'stopover'], def: 6 },
  { key: 'dropoff', kw: ['giao hàng', 'điểm đến', 'dropoff'], def: 7 },
  { key: 'odo_start', kw: ['đồng hồ đầu', 'km đầu', 'odo start', 'start odo'], def: 8 },
  { key: 'odo_end', kw: ['đồng hồ cuối', 'km cuối', 'odo end', 'end odo'], def: 9 },
  { key: 'fuel_liters', kw: ['lít', 'liters', 'nhiên liệu'], def: 10 },
  { key: 'fuel_price', kw: ['đơn giá', 'giá', 'price'], def: 11 },
  { key: 'toll', kw: ['cầu đường', 'toll'], def: 12 },
  { key: 'other_amount', kw: ['chi phí khác', 'phát sinh', 'other'], def: 13 },
  { key: 'other_note', kw: ['ghi chú', 'note'], def: 14 },
  { key: 'bol', kw: ['bol', 'vận đơn'], def: 15 },
  { key: 'cdf', kw: ['cdf'], def: 16 },
  { key: 'revenue', kw: ['doanh thu', 'revenue'], def: 17 },
] as const;
type FieldKey = (typeof FIELDS)[number]['key'];
type Mapping = Record<FieldKey, number>;

interface Sheet {
  name: string;
  rows: unknown[][];
}

export function TruckImportPanel({ vehicles, drivers }: { vehicles: OptionItem[]; drivers: OptionItem[] }) {
  const t = useTranslations('screens.truckImport');
  const tErr = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [active, setActive] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);

  const parseFile = async (file: File) => {
    setParsing(true);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const parsed: Sheet[] = wb.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, { header: 1, blankrows: false }),
      })).filter((s) => s.rows.length > 1); // need a header + ≥1 data row
      if (parsed.length === 0) {
        toast.error(t('noRows'));
        return;
      }
      /* Auto-map from the first sheet's header row (keyword match → template
       * fallback). All sheets in one file share the same layout. */
      const headers = ((parsed[0]?.rows[0] ?? []) as unknown[]).map((h) => String(h ?? '').toLowerCase());
      const guess = {} as Mapping;
      for (const f of FIELDS) {
        let idx = headers.findIndex((h) => f.kw.some((k) => h.includes(k)));
        if (idx < 0) idx = f.def < headers.length ? f.def : -1;
        guess[f.key] = idx;
      }
      setSheets(parsed);
      setActive(0);
      setMapping(guess);
      setFileName(file.name);
    } catch {
      toast.error(t('parseError'));
    } finally {
      setParsing(false);
    }
  };

  const sheet = sheets[active];
  const headers = (sheet?.rows[0] ?? []) as unknown[];
  const dataRows = useMemo(() => (sheet ? sheet.rows.slice(1) : []), [sheet]);

  const mapped = useMemo(() => {
    if (!mapping) return [];
    return dataRows.map((row) => {
      const cell = (k: FieldKey) => {
        const i = mapping[k];
        return i >= 0 ? row[i] : undefined;
      };
      const date = dateStr(cell('date'));
      const r: TruckImportRow & { _valid: boolean } = {
        date,
        start_time: timeStr(cell('start_time')),
        end_time: timeStr(cell('end_time')),
        customer: str(cell('customer')),
        pickup: str(cell('pickup')),
        stopover: str(cell('stopover')),
        dropoff: str(cell('dropoff')),
        odo_start: int(cell('odo_start')),
        odo_end: int(cell('odo_end')),
        fuel_liters: num(cell('fuel_liters')),
        fuel_price: num(cell('fuel_price')),
        toll: num(cell('toll')),
        other_amount: num(cell('other_amount')),
        other_note: str(cell('other_note')),
        bol: str(cell('bol')),
        cdf: str(cell('cdf')),
        revenue: num(cell('revenue')),
        _valid: date !== '',
      };
      return r;
    });
  }, [dataRows, mapping]);

  const validRows = mapped.filter((r) => r._valid);
  const invalidCount = mapped.length - validRows.length;
  const canImport = vehicleId !== '' && driverId !== '' && validRows.length > 0 && !pending;

  const runImport = () => {
    if (!canImport) return;
    startTransition(async () => {
      const rows = validRows.map(({ _valid, ...r }) => r);
      const res = await importTruckTripsAction({
        vehicle_id: vehicleId,
        driver_id: driverId,
        file_name: sheet ? `${fileName} · ${sheet.name}` : fileName,
        rows,
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('importedToast', { count: res.data.count }));
      /* Land on the trip log filtered to the month just imported so the user
       * SEES the loaded rows immediately (QA: "tải lên, rồi sao nữa?"). */
      router.push(res.data.month ? `/truck/trips?month=${res.data.month}` : '/truck/trips');
      router.refresh();
    });
  };

  const colOptions = headers.map((h, i) => ({ value: String(i), label: str(h) ?? t('colN', { n: i + 1 }) }));

  return (
    <div className="space-y-4">
      {/* Template */}
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

      {/* Target truck + driver */}
      <Card variant="outline" className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{t('vehicle')}</Label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder={t('selectVehicle')} />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
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
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Drag & drop */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void parseFile(f);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragging ? 'border-accent bg-accent-soft' : 'border-border hover:border-accent/60',
        )}
      >
        {parsing ? (
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        ) : (
          <Upload className="h-6 w-6 text-text-muted" />
        )}
        <div className="text-sm font-medium text-text">{t('dropHere')}</div>
        <div className="text-xs text-text-muted">{t('dropHint')}</div>
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={parsing}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void parseFile(f);
            e.target.value = '';
          }}
        />
      </label>

      {sheets.length > 0 && (
        <>
          {/* Sheet picker — each sheet = 1 month */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-text-muted">{t('sheetLabel')}</div>
            <div className="flex flex-wrap gap-1.5">
              {sheets.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    i === active
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-border bg-surface text-text-muted hover:border-accent hover:text-accent',
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Column mapping */}
          <Card variant="outline" className="p-4 space-y-3">
            <div>
              <div className="text-sm font-medium text-text">{t('mappingTitle')}</div>
              <div className="text-xs text-text-muted">{t('mappingHint')}</div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-xs text-text-muted">
                    {t(`f.${f.key}`)}
                    {f.key === 'date' && <span className="text-danger"> *</span>}
                  </span>
                  <Select
                    value={String(mapping?.[f.key] ?? -1)}
                    onValueChange={(v) => setMapping((m) => (m ? { ...m, [f.key]: Number(v) } : m))}
                  >
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">{t('colUnused')}</SelectItem>
                      {colOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          {/* Validation + preview */}
          <Card variant="outline" className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-text">{t('parsedCount', { file: sheet?.name ?? '', count: mapped.length })}</span>
              <span className="inline-flex items-center gap-1 text-success">● {t('validRows', { n: validRows.length })}</span>
              {invalidCount > 0 && (
                <span className="inline-flex items-center gap-1 text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t('invalidRows', { n: invalidCount })}
                </span>
              )}
            </div>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left">
                    <th className="px-2 py-1.5">{t('colDate')}</th>
                    <th className="px-2 py-1.5">{t('colCustomer')}</th>
                    <th className="px-2 py-1.5 text-right">{t('f.revenue')}</th>
                    <th className="px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {mapped.slice(0, 10).map((r, i) => (
                    <tr key={i} className={cn('border-b border-border last:border-0', !r._valid && 'bg-danger-soft/40')}>
                      <td className="px-2 py-1.5">{r.date || '—'}</td>
                      <td className="px-2 py-1.5">{r.customer ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular">{r.revenue != null ? r.revenue.toLocaleString('vi-VN') : '—'}</td>
                      <td className="px-2 py-1.5 text-danger">{r._valid ? '' : t('rowInvalid')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mapped.length > 10 && <div className="text-xs text-text-faint">{t('andMore', { n: mapped.length - 10 })}</div>}
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="lg" disabled={!canImport} onClick={runImport}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {t('importSheet', { n: validRows.length })}
        </Button>
      </div>
    </div>
  );
}
