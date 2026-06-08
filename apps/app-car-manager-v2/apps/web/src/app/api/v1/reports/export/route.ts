import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import {
  getReportKpis,
  getSpendByCategory,
  getSpendByWeek,
  getVehicleUtilization,
} from '@/server/queries/reports.queries';
import { buildCsv, fmtAmount } from '@/server/lib/csv';
import {
  buildMultiSheetExcel,
  excelResponse,
  type ExcelColumn,
  type ExcelSheetData,
} from '@/server/lib/excel';
import {
  buildReportPdf,
  buildTableContent,
  pdfResponse,
  type PdfColumn,
  type PdfSection,
} from '@/server/lib/pdf';

/* Reports export — multi-sheet Excel or multi-section PDF.
 * ADMIN + MANAGER only.
 *
 * Query params: format (csv|xlsx|pdf), weeks (period in weeks, default 12), locale
 */

function formatVndShort(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B₫`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M₫`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K₫`;
  return `${amount}₫`;
}

export async function GET(req: NextRequest) {
  const actor = await getCurrentUser();
  requireRole(actor.role, ['ADMIN', 'MANAGER']);

  const sp = req.nextUrl.searchParams;
  const format = (sp.get('format') ?? 'xlsx') as 'csv' | 'xlsx' | 'pdf';
  const weeks = Math.min(52, Math.max(1, Number(sp.get('weeks') ?? 12)));
  const locale = sp.get('locale') ?? 'vi';

  const dateStr = new Date().toISOString().slice(0, 10);

  // Load translations
  const t = await getTranslations({ locale, namespace: 'exportContent.reports' });
  const tCat = await getTranslations({ locale, namespace: 'exportContent.categories' });

  // Helper to translate category
  const fmtCat = (expType: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return tCat(expType as any);
    } catch {
      return expType;
    }
  };

  // Parallel fetch all report data
  const [kpis, categorySpend, weeklySpend, utilization] = await Promise.all([
    getReportKpis(actor.entId, weeks),
    getSpendByCategory(actor.entId, weeks),
    getSpendByWeek(actor.entId, weeks),
    getVehicleUtilization(actor.entId, weeks),
  ]);

  const totalCategorySpend = categorySpend.reduce((s, c) => s + c.amountVnd, 0);
  const expTypes = ['FUEL', 'REPAIR', 'MEAL', 'OIL', 'PARKING', 'TOLL', 'ACCIDENT', 'INSPECTION'] as const;

  // CSV format - simple combined output
  if (format === 'csv') {
    const lines: string[] = [];

    // KPIs section
    lines.push(t('csvKpiHeader'));
    lines.push(`${t('colMetric')},${t('colValue')},${t('colDelta')}`);
    lines.push(`${t('kTotalTrips')},${kpis.totalTrips},${kpis.delta.tripsPct}%`);
    lines.push(`${t('kTotalSpend')},${fmtAmount(kpis.totalSpendVnd, 'VND')},${kpis.delta.spendPct}%`);
    lines.push(`${t('kAvgCost')},${fmtAmount(kpis.avgCostVnd, 'VND')},${kpis.delta.avgCostPct}%`);
    lines.push(`${t('kUtil')},${kpis.utilizationPct}%,${kpis.delta.utilizationPts} pts`);
    lines.push('');

    // Spend by category
    lines.push(t('csvCategoryHeader'));
    lines.push(`${t('colType')},${t('colAmount')},${t('colPct')}`);
    for (const c of categorySpend) {
      const pct = totalCategorySpend > 0 ? Math.round((c.amountVnd / totalCategorySpend) * 100) : 0;
      lines.push(`${fmtCat(c.expType)},${fmtAmount(c.amountVnd, 'VND')},${pct}%`);
    }
    lines.push('');

    // Weekly spend
    lines.push(t('csvWeeklyHeader'));
    lines.push(`${t('colWeek')},` + expTypes.map((typ) => fmtCat(typ)).join(','));
    for (const w of weeklySpend) {
      const vals = expTypes.map((typ) => {
        const v = w[typ] as number;
        return v > 0 ? v.toFixed(2) : '0';
      });
      lines.push(`${w.week},${vals.join(',')}`);
    }
    lines.push('');

    // Vehicle utilization
    lines.push(t('csvUtilHeader'));
    if (utilization.vehicles.length > 0) {
      lines.push(`${t('colWeek')},` + utilization.vehicles.map((v) => v.plate).join(','));
      for (const w of utilization.data) {
        const vals = utilization.vehicles.map((v) => String(w[v.plate] ?? 0));
        lines.push(`${w.week},${vals.join(',')}`);
      }
    } else {
      lines.push(t('noVehicleData'));
    }

    const csv = '﻿' + lines.join('\r\n');
    const filename = `reports-${dateStr}.csv`;
    const encodedFilename = encodeURIComponent(filename);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // Excel format - multi-sheet
  if (format === 'xlsx') {
    const sheets: ExcelSheetData[] = [];

    // Sheet 1: KPI Summary
    const kpiColumns: ExcelColumn[] = [
      { header: t('colMetric'), key: 'metric', width: 25 },
      { header: t('colValue'), key: 'value', width: 20 },
      { header: t('colDelta'), key: 'delta', width: 15 },
    ];
    sheets.push({
      name: t('sheetOverview'),
      columns: kpiColumns,
      rows: [
        { metric: t('kTotalTrips'), value: kpis.totalTrips, delta: `${kpis.delta.tripsPct}%` },
        { metric: t('kTotalSpend'), value: formatVndShort(kpis.totalSpendVnd), delta: `${kpis.delta.spendPct}%` },
        { metric: t('kAvgCost'), value: formatVndShort(kpis.avgCostVnd), delta: `${kpis.delta.avgCostPct}%` },
        { metric: t('kUtil'), value: `${kpis.utilizationPct}%`, delta: `${kpis.delta.utilizationPts} pts` },
      ],
    });

    // Sheet 2: Spend by Category
    const catColumns: ExcelColumn[] = [
      { header: t('colType'), key: 'type', width: 20 },
      { header: t('colAmount'), key: 'amount', width: 20 },
      { header: t('colPct'), key: 'pct', width: 12 },
    ];
    const catRows = categorySpend.map((c) => {
      const pct = totalCategorySpend > 0 ? Math.round((c.amountVnd / totalCategorySpend) * 100) : 0;
      return {
        type: fmtCat(c.expType),
        amount: fmtAmount(c.amountVnd, 'VND'),
        pct: `${pct}%`,
      };
    });
    catRows.push({
      type: t('summaryTotal'),
      amount: fmtAmount(totalCategorySpend, 'VND'),
      pct: '100%',
    });
    sheets.push({
      name: t('sheetByCategory'),
      columns: catColumns,
      rows: catRows,
    });

    // Sheet 3: Weekly Spend
    const weekColumns: ExcelColumn[] = [
      { header: t('colWeek'), key: 'week', width: 8 },
      ...expTypes.map((typ) => ({
        header: fmtCat(typ),
        key: typ,
        width: 12,
      })),
    ];
    const weekRows = weeklySpend.map((w) => {
      const row: Record<string, unknown> = { week: w.week };
      for (const typ of expTypes) {
        const v = w[typ] as number;
        row[typ] = v > 0 ? `${v.toFixed(2)}M` : '';
      }
      return row;
    });
    sheets.push({
      name: t('sheetByWeek'),
      columns: weekColumns,
      rows: weekRows,
    });

    // Sheet 4: Vehicle Utilization
    if (utilization.vehicles.length > 0) {
      const utilColumns: ExcelColumn[] = [
        { header: t('colWeek'), key: 'week', width: 8 },
        ...utilization.vehicles.map((v) => ({
          header: v.plate,
          key: v.plate,
          width: 12,
        })),
      ];
      const utilRows = utilization.data.map((w) => {
        const row: Record<string, unknown> = { week: w.week };
        for (const v of utilization.vehicles) {
          row[v.plate] = `${w[v.plate] ?? 0}%`;
        }
        return row;
      });
      sheets.push({
        name: t('sheetUtilization'),
        columns: utilColumns,
        rows: utilRows,
      });
    }

    const buffer = buildMultiSheetExcel(sheets);
    return excelResponse(buffer, `reports-${dateStr}.xlsx`);
  }

  // PDF format - multi-section report
  if (format === 'pdf') {
    const sections: PdfSection[] = [];

    // Section 1: KPI Summary
    const kpiPdfColumns: PdfColumn[] = [
      { header: t('colMetric'), key: 'metric', width: '*' },
      { header: t('colValue'), key: 'value', width: 120, alignment: 'right' },
      { header: t('colDelta'), key: 'delta', width: 80, alignment: 'right' },
    ];
    sections.push({
      title: t('sectionKpi'),
      content: buildTableContent(kpiPdfColumns, [
        { metric: t('kTotalTrips'), value: String(kpis.totalTrips), delta: `${kpis.delta.tripsPct}%` },
        { metric: t('kTotalSpend'), value: formatVndShort(kpis.totalSpendVnd), delta: `${kpis.delta.spendPct}%` },
        { metric: t('kAvgCost'), value: formatVndShort(kpis.avgCostVnd), delta: `${kpis.delta.avgCostPct}%` },
        { metric: t('kUtil'), value: `${kpis.utilizationPct}%`, delta: `${kpis.delta.utilizationPts} pts` },
      ]),
    });

    // Section 2: Spend by Category
    const catPdfColumns: PdfColumn[] = [
      { header: t('colType'), key: 'type', width: '*' },
      { header: t('colAmount'), key: 'amount', width: 120, alignment: 'right' },
      { header: t('colPct'), key: 'pct', width: 60, alignment: 'right' },
    ];
    const catPdfRows = categorySpend.map((c) => {
      const pct = totalCategorySpend > 0 ? Math.round((c.amountVnd / totalCategorySpend) * 100) : 0;
      return {
        type: fmtCat(c.expType),
        amount: fmtAmount(c.amountVnd, 'VND'),
        pct: `${pct}%`,
      };
    });
    sections.push({
      title: t('sectionCategory'),
      content: buildTableContent(catPdfColumns, catPdfRows, {
        summaryRow: {
          type: t('summaryTotal'),
          amount: fmtAmount(totalCategorySpend, 'VND'),
          pct: '100%',
        },
      }),
    });

    // Section 3: Vehicle Utilization (if vehicles exist)
    if (utilization.vehicles.length > 0) {
      const utilPdfColumns: PdfColumn[] = [
        { header: t('colWeek'), key: 'week', width: 40 },
        ...utilization.vehicles.slice(0, 6).map((v) => ({
          header: v.plate,
          key: v.plate,
          width: '*' as const,
          alignment: 'center' as const,
        })),
      ];
      const utilPdfRows = utilization.data.map((w) => {
        const row: Record<string, unknown> = { week: w.week };
        for (const v of utilization.vehicles.slice(0, 6)) {
          row[v.plate] = `${w[v.plate] ?? 0}%`;
        }
        return row;
      });
      sections.push({
        title: t('sectionUtil'),
        content: buildTableContent(utilPdfColumns, utilPdfRows),
      });
    }

    const buffer = await buildReportPdf({
      title: t('title'),
      subtitle: t('subtitle', { weeks, date: dateStr }),
      sections,
    });

    return pdfResponse(buffer, `reports-${dateStr}.pdf`);
  }

  // Fallback
  return NextResponse.json(
    { success: false, error: 'Unsupported format. Use csv, xlsx, or pdf.' },
    { status: 400 },
  );
}
