import { getTranslations } from 'next-intl/server';
import { computeTruckPnl, type TruckPnlRow } from '@car-v2/core/truck';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { hasFleet } from '@/lib/auth/fleet-access';
import { allowedRegions, hasRegion, resolveVehicleScope } from '@/lib/auth/region-access';
import { buildExcel, excelResponse, type ExcelColumn } from '@/server/lib/excel';
import { buildReportPdf, buildTableContent, pdfResponse, type PdfColumn } from '@/server/lib/pdf';
import { exportFileName, exportSheetName } from '@/server/lib/export-file-name';
import { bcp47, monthName, resolveUiLocale } from '@/i18n/ui-locale';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** More trucks than this and the table stops fitting A4 portrait. */
const LANDSCAPE_FROM = 6;

/**
 * GET /truck/pnl/export?month=&format=xlsx|pdf&vehicles=&region= — quick ad-hoc
 * download of the monthly P&L.
 *
 * `vehicles` is a comma-separated list (REQ-20260814). With a subset selected
 * the sheet grows one column PER truck plus a TOTAL column, so the file matches
 * the screen the user is looking at — until REQ-20260814 this route ignored the
 * vehicle filter entirely and always exported the whole region. Region ACL
 * (REQ-20260813) is enforced here too; route handlers bypass the layout guard.
 */
export async function GET(req: Request) {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
  if (user.role === 'DRIVER' || !(await hasFleet(user, 'TRUCK'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(req.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') ?? '')
    ? (url.searchParams.get('month') as string)
    : currentMonth();
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';

  const rawRegion = url.searchParams.get('region');
  const region =
    rawRegion && (TRUCK_REGIONS as readonly string[]).includes(rawRegion) ? rawRegion : undefined;
  if (region && !(await hasRegion(user, region))) {
    return new Response('Forbidden', { status: 403 });
  }
  const regions = await allowedRegions(user);

  const { trucks, vehicleIds, isAll } = await resolveVehicleScope(
    user,
    url.searchParams.get('vehicles') ?? url.searchParams.get('vehicle') ?? undefined,
  );
  /* One column per selected truck, plus the TOTAL column. "All" stays a single
   * column — that is the historical file, and a fleet of 8 would otherwise turn
   * every routine export into a wide sheet nobody asked for. */
  const perVehicle = !isAll && (vehicleIds?.length ?? 0) > 1;

  /* Row labels, headers, title and filename all follow the exporter's UI
   * language (exportContent.truckPnl). */
  const locale = await resolveUiLocale();
  const t = await getTranslations({ locale, namespace: 'exportContent.truckPnl' });
  const [y = '', mm = ''] = month.split('-');
  const m = String(Number(mm));
  const label = t('monthLabel', { m, mn: monthName(month, locale), y });

  /* Total column (and the only column when not splitting per truck) — one call
   * with the whole scope, so it is the scope's real total rather than a sum of
   * rounded per-truck rows. */
  const totalQuery = computeTruckPnl(user, { vehicleIds, region, regions, months: [month] });
  /* Per-truck columns run in PARALLEL: 8 trucks sequentially would blow the
   * request budget on Render. */
  const columnIds = perVehicle ? (vehicleIds ?? []) : [];
  const [totalRow, ...vehicleRows] = await Promise.all([
    totalQuery,
    ...columnIds.map((id) => computeTruckPnl(user, { vehicleIds: [id], region, regions, months: [month] })),
  ]);

  const METRICS: { labelKey: string; pick: (r: TruckPnlRow) => number }[] = [
    { labelKey: 'lineRevenue', pick: (r) => r.revenue },
    { labelKey: 'lineFuel', pick: (r) => r.fuelCost },
    { labelKey: 'lineToll', pick: (r) => r.tollFee },
    { labelKey: 'lineExtra', pick: (r) => r.extraTotal },
    { labelKey: 'lineVariable', pick: (r) => r.variableCost },
    { labelKey: 'lineSalary', pick: (r) => r.salary },
    { labelKey: 'lineDepreciation', pick: (r) => r.depreciation },
    { labelKey: 'lineFixed', pick: (r) => r.fixedCost },
    { labelKey: 'lineTrips', pick: (r) => r.tripCount },
    { labelKey: 'lineNet', pick: (r) => r.netProfit },
  ];

  const plateOf = (id: string) => trucks.find((v) => v.cvhId === id)?.cvhPlateNumber ?? id;
  const scopeLine = isAll
    ? t('scopeAll', { total: String(trucks.length) })
    : t('scopeVehicles', {
        n: String(vehicleIds?.length ?? 0),
        total: String(trucks.length),
        plates: (vehicleIds ?? []).map(plateOf).join(', '),
      });

  /* Column keys: `v0..vN` per truck, `total` last. Without the split there is
   * just `total`, headed by the month label — byte-identical to the old file. */
  const valueColumns = perVehicle
    ? [
        ...columnIds.map((id, i) => ({ key: `v${i}`, header: plateOf(id), row: vehicleRows[i]?.[0] })),
        { key: 'total', header: t('colTotal'), row: totalRow[0] },
      ]
    : [{ key: 'total', header: label, row: totalRow[0] }];

  const lines = METRICS.map((metric) => {
    const line: Record<string, string | number> = { k: t(metric.labelKey as 'lineRevenue') };
    for (const col of valueColumns) line[col.key] = col.row ? metric.pick(col.row) : 0;
    return line;
  });

  const fileName = await exportFileName('screens.truckPnl', 'fileName', { y, mm, m }, `truck-pnl-${month}`);

  if (format === 'pdf') {
    const cols: PdfColumn[] = [
      { header: t('colItem'), key: 'k', width: '*' },
      ...valueColumns.map((c) => ({
        header: c.header,
        key: c.key,
        width: perVehicle ? 90 : 160,
        alignment: 'right' as const,
      })),
    ];
    const rows = lines.map((l) => {
      const out: Record<string, string> = { k: String(l.k) };
      for (const c of valueColumns) out[c.key] = Number(l[c.key] ?? 0).toLocaleString(bcp47(locale));
      return out;
    });
    const buffer = await buildReportPdf({
      title: t('title'),
      subtitle: `${label} · ${scopeLine}`,
      sections: [{ title: t('sheetName'), content: buildTableContent(cols, rows) }],
      orientation: valueColumns.length > LANDSCAPE_FROM ? 'landscape' : 'portrait',
    });
    return pdfResponse(buffer, `${fileName}.pdf`);
  }

  const cols: ExcelColumn[] = [
    { header: t('colItem'), key: 'k', width: 28 },
    ...valueColumns.map((c) => ({ header: c.header, key: c.key, width: 20 })),
  ];
  const buffer = buildExcel(
    await exportSheetName('exportContent.truckPnl', 'P&L'),
    cols,
    lines,
    { scopeLine },
  );
  return excelResponse(buffer, `${fileName}.xlsx`);
}
