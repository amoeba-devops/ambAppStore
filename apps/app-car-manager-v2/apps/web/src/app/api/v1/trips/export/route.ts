import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { listTrips } from '@/server/queries/trips.queries';
import type { CarTripStatus } from '@car-v2/db/schema';
import { buildCsv, fmtDateTime, fmtDuration } from '@/server/lib/csv';
import { buildExcel, excelResponse, type ExcelColumn } from '@/server/lib/excel';
import { buildTablePdf, pdfResponse, type PdfColumn } from '@/server/lib/pdf';

/* Trip list export — ent-scoped (listTrips filter by entId).
 * ADMIN + MANAGER only. Driver export would have a different shape (own trips)
 * and isn't requested by PRD MVP, redirect via 403.
 *
 * Query params: status, q, date (giống /trips page), format (csv|xlsx|pdf), locale.
 * Max rows: hard-cap 1000 để tránh giật memory trên Render starter plan.
 */
export async function GET(req: NextRequest) {
  const actor = await getCurrentUser();
  requireRole(actor.role, ['ADMIN', 'MANAGER']);

  const sp = req.nextUrl.searchParams;
  const status = (sp.get('status') ?? 'all') as
    | CarTripStatus | 'all' | 'pending' | 'active' | 'completed';
  const q = sp.get('q')?.trim() || undefined;
  const dateRange = (sp.get('date') ?? 'all') as
    | 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'past';
  const format = (sp.get('format') ?? 'csv') as 'csv' | 'xlsx' | 'pdf';
  const locale = sp.get('locale') ?? 'vi';

  // Load translations for export content
  const t = await getTranslations({ locale, namespace: 'exportContent.trips' });
  const tStatus = await getTranslations({ locale, namespace: 'exportContent.status' });

  // Helper to translate status - cast needed for dynamic i18n key
  const fmtStatus = (s: string) => {
    try {
      return tStatus(s as Parameters<typeof tStatus>[0]);
    } catch {
      return s;
    }
  };

  /* listTrips đã enforce ent_id + role visibility (Admin tất cả, Manager own). */
  const { items } = await listTrips({
    entId: actor.entId,
    role: actor.role,
    userId: actor.userId,
    status,
    q,
    dateRange,
    page: 1,
    /* Export của /trips = chuyến điều xe. Chuyến xe tải xuất qua
     * /truck/reports (mẫu Excel riêng, có doanh thu + chi phí chuyến). */
    kind: 'DISPATCH',
  });
  /* Re-fetch up to N pages to bypass per-call limit if needed — MVP simple. */
  const MAX_ROWS = 1000;
  const rows = items.slice(0, MAX_ROWS);

  const dateStr = new Date().toISOString().slice(0, 10);

  // CSV format (backwards compatible)
  if (format === 'csv') {
    const header = [
      t('colRef'),
      t('colStatus'),
      t('colScheduledAt'),
      t('colPassenger'),
      t('colDriver'),
      t('colVehicle'),
      t('colPickup'),
      t('colDropoff'),
      t('colDuration'),
      t('colPurpose'),
      t('colCreatedAt'),
    ];
    const data = rows.map((row) => [
      row.trpRef,
      fmtStatus(row.trpStatus),
      fmtDateTime(row.trpScheduledAt),
      row.passengerName ?? '',
      row.driverName ?? '',
      row.vehiclePlate ?? '',
      row.trpPickupAddress,
      row.trpDropoffAddress,
      fmtDuration(row.trpDurationMinutes),
      row.trpPurpose ?? '',
      fmtDateTime(row.trpCreatedAt),
    ]);
    const csv = buildCsv(header, data);
    const filename = `trips-${dateStr}.csv`;
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

  // Excel format
  if (format === 'xlsx') {
    const columns: ExcelColumn[] = [
      { header: t('colRef'), key: 'ref', width: 12 },
      { header: t('colStatus'), key: 'status', width: 18 },
      { header: t('colScheduledAt'), key: 'scheduledAt', width: 18 },
      { header: t('colPassenger'), key: 'passenger', width: 20 },
      { header: t('colDriver'), key: 'driver', width: 18 },
      { header: t('colVehicle'), key: 'vehicle', width: 12 },
      { header: t('colPickup'), key: 'pickup', width: 30 },
      { header: t('colDropoff'), key: 'dropoff', width: 30 },
      { header: t('colDuration'), key: 'duration', width: 10 },
      { header: t('colPurpose'), key: 'purpose', width: 25 },
      { header: t('colCreatedAt'), key: 'createdAt', width: 18 },
    ];

    const excelRows = rows.map((row) => ({
      ref: row.trpRef,
      status: fmtStatus(row.trpStatus),
      scheduledAt: fmtDateTime(row.trpScheduledAt),
      passenger: row.passengerName ?? '',
      driver: row.driverName ?? '',
      vehicle: row.vehiclePlate ?? '',
      pickup: row.trpPickupAddress,
      dropoff: row.trpDropoffAddress,
      duration: fmtDuration(row.trpDurationMinutes),
      purpose: row.trpPurpose ?? '',
      createdAt: fmtDateTime(row.trpCreatedAt),
    }));

    const buffer = buildExcel(t('sheetName'), columns, excelRows);
    return excelResponse(buffer, `trips-${dateStr}.xlsx`);
  }

  // PDF format
  if (format === 'pdf') {
    try {
      const pdfColumns: PdfColumn[] = [
        { header: t('colRef'), key: 'ref', width: 45 },
        { header: t('colStatus'), key: 'status', width: 70 },
        { header: t('colScheduledAt'), key: 'scheduledAt', width: 70 },
        { header: t('colPassenger'), key: 'passenger', width: 80 },
        { header: t('colDriver'), key: 'driver', width: 70 },
        { header: t('colVehicle'), key: 'vehicle', width: 50 },
        { header: t('colPickup'), key: 'pickup', width: '*' },
      ];

      const pdfRows = rows.map((row) => ({
        ref: row.trpRef,
        status: fmtStatus(row.trpStatus),
        scheduledAt: fmtDateTime(row.trpScheduledAt),
        passenger: row.passengerName ?? '',
        driver: row.driverName ?? '',
        vehicle: row.vehiclePlate ?? '',
        pickup: row.trpPickupAddress,
      }));

      const buffer = await buildTablePdf({
        title: t('title'),
        subtitle: t('subtitle', { date: dateStr, count: rows.length }),
        columns: pdfColumns,
        rows: pdfRows,
      });

      return pdfResponse(buffer, `trips-${dateStr}.pdf`);
    } catch (error) {
      console.error('[trips/export] PDF generation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'PDF generation failed',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  }

  // Fallback - unsupported format
  return NextResponse.json(
    { success: false, error: 'Unsupported format. Use csv, xlsx, or pdf.' },
    { status: 400 },
  );
}
