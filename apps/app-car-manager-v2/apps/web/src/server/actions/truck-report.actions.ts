'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@car-v2/db/client';
import { carTruckReports, carUsers, TRUCK_REPORT_TYPES } from '@car-v2/db/schema';
import type { ActionResult } from '@car-v2/shared/errors';
import { computeTruckPnl } from '@car-v2/core/truck';
import { TRUCK_REGIONS } from '@car-v2/shared/zod';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { requireFleet } from '@/lib/auth/fleet-access';
import { listVehicles } from '@/server/queries/vehicles.queries';
import { listTruckFinanceTrips } from '@/server/queries/truck-finance.queries';
import { buildExcel, type ExcelColumn } from '@/server/lib/excel';
import { putObject } from '@/lib/s3-client';
import { logAudit } from '@/server/services/audit-log.service';
import { runAction } from './_helpers';

const MONTH = /^\d{4}-\d{2}$/;

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

/* Report file content is Vietnamese (operational document for the VN company),
 * matching the existing truck Excel exports. The UI chrome is i18n'd separately. */
const REPORT_NAME: Record<string, string> = {
  PNL: 'Báo cáo chi phí & lợi nhuận',
  TRIP_LOG: 'Báo cáo nhật ký chuyến',
  VEHICLE: 'Báo cáo phương tiện',
};

/* Report-file scope suffix (VN, like the rest of this file's content). */
const REGION_LABEL: Record<string, string> = { HCM: 'HCM', DONG_NAI: 'Đồng Nai', BAIKSAN: 'Baiksan' };
function regionSuffix(region: string | null): string {
  return region ? `Khu vực ${REGION_LABEL[region] ?? region}` : 'Tất cả khu vực';
}

async function buildReportWorkbook(
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
  month: string,
  type: string,
  region: string | null,
): Promise<Buffer> {
  if (type === 'PNL') {
    const [row] = await computeTruckPnl(actor, { months: [month], region: region ?? undefined });
    const r = row ?? null;
    const cols: ExcelColumn[] = [
      { header: 'Hạng mục', key: 'k', width: 28 },
      { header: monthLabel(month), key: 'v', width: 20 },
    ];
    const line = (k: string, v: number) => ({ k, v });
    const rows = r
      ? [
          line('Doanh thu', r.revenue),
          line('Phí xăng dầu', r.fuelCost),
          line('Phí cầu đường', r.tollFee),
          line('Chi phí phát sinh', r.extraTotal),
          line('Chi phí biến đổi', r.variableCost),
          line('Lương (theo xe)', r.salary),
          line('Khấu hao', r.depreciation),
          line('Bảo hiểm', r.insurance),
          line('Lương tài xế', r.driverSalary),
          line('Chi phí cố định', r.fixedCost),
          line('Số chuyến', r.tripCount),
          line('Lợi nhuận ròng', r.netProfit),
        ]
      : [];
    return buildExcel('P&L', cols, rows);
  }

  if (type === 'TRIP_LOG') {
    const trips = await listTruckFinanceTrips(actor.entId, { month, region });
    const cols: ExcelColumn[] = [
      { header: 'Ngày', key: 'date', width: 12 },
      { header: 'Phương tiện', key: 'plate', width: 14 },
      { header: 'Tài xế', key: 'driver', width: 18 },
      { header: 'Khách hàng', key: 'customer', width: 18 },
      { header: 'Km', key: 'km', width: 8 },
      { header: 'Cầu đường', key: 'toll', width: 12 },
      { header: 'Phát sinh', key: 'extra', width: 12 },
      { header: 'Đơn giá', key: 'unitPrice', width: 12 },
      { header: 'Lít', key: 'liters', width: 8 },
      { header: 'Phí xăng', key: 'fuel', width: 12 },
      { header: 'Doanh thu', key: 'revenue', width: 14 },
      { header: 'Lợi nhuận', key: 'profit', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 12 },
    ];
    const rows = trips.map((t) => ({
      date: new Date(t.scheduledAt).toISOString().slice(0, 10),
      plate: t.plate ?? '',
      driver: t.driver ?? '',
      customer: t.customer ?? '',
      km: t.km,
      toll: t.toll,
      extra: t.extra,
      unitPrice: t.unitPrice,
      liters: Math.round(t.liters * 10) / 10,
      fuel: t.fuelCost,
      revenue: t.revenue,
      profit: t.profit,
      status: t.finalized ? 'Đã chốt' : 'Tạm tính',
    }));
    return buildExcel('Nhật ký chuyến', cols, rows);
  }

  // VEHICLE — per-truck month aggregates (scoped to the region when set).
  const allTrucks = await listVehicles(actor.entId, 'active', 'TRUCK');
  const trucks = region ? allTrucks.filter((v) => v.cvhRegion === region) : allTrucks;
  const cols: ExcelColumn[] = [
    { header: 'Biển số', key: 'plate', width: 14 },
    { header: 'Mô tả', key: 'model', width: 22 },
    { header: 'Số chuyến', key: 'trips', width: 10 },
    { header: 'Doanh thu', key: 'revenue', width: 14 },
    { header: 'Phí xăng', key: 'fuel', width: 12 },
    { header: 'Cầu đường', key: 'toll', width: 12 },
    { header: 'Phát sinh', key: 'extra', width: 12 },
    { header: 'Chi phí cố định', key: 'fixed', width: 14 },
    { header: 'Lợi nhuận ròng', key: 'net', width: 14 },
  ];
  const rows: Record<string, unknown>[] = [];
  for (const v of trucks) {
    const [pnl] = await computeTruckPnl(actor, { vehicleId: v.cvhId, months: [month] });
    rows.push({
      plate: v.cvhPlateNumber,
      model: v.cvhModel ?? '',
      trips: pnl?.tripCount ?? 0,
      revenue: pnl?.revenue ?? 0,
      fuel: pnl?.fuelCost ?? 0,
      toll: pnl?.tollFee ?? 0,
      extra: pnl?.extraTotal ?? 0,
      fixed: pnl?.fixedCost ?? 0,
      net: pnl?.netProfit ?? 0,
    });
  }
  return buildExcel('Phương tiện', cols, rows);
}

/** Generate one monthly report (PNL | TRIP_LOG | VEHICLE) → Excel → S3 → row. */
export async function generateTruckReportAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    const parsed = z
      .object({
        month: z.string().regex(MONTH),
        type: z.enum(TRUCK_REPORT_TYPES),
        /* Operating region scope; null/absent = all regions. */
        region: z.enum(TRUCK_REGIONS).nullable().optional(),
      })
      .parse(input);
    const { month, type } = parsed;
    const region = parsed.region ?? null;

    const buffer = await buildReportWorkbook(actor, month, type, region);
    const id = randomUUID();
    const key = `truck-reports/${actor.entId}/${month}/${type}-${region ?? 'all'}-${id}.xlsx`;
    await putObject(
      key,
      new Uint8Array(buffer),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    /* Report is scoped to the chosen operating region (or all regions) — name it
     * with that scope ("· Khu vực HCM" / "· Tất cả khu vực") so the list makes the
     * scope obvious; the list still groups by month. */
    const name = `${REPORT_NAME[type]} · ${regionSuffix(region)}`;
    await db.insert(carTruckReports).values({
      trrId: id,
      entId: actor.entId,
      trrVehicleType: 'TRUCK',
      trrMonth: month,
      trrType: type,
      trrFormat: 'EXCEL',
      trrS3Key: key,
      trrName: name,
      trrCreatedBy: actor.userId,
    });
    await logAudit({
      entId: actor.entId,
      userId: actor.userId,
      action: 'TRUCK_REPORT.GENERATED',
      entity: 'TruckReport',
      entityId: id,
      entityRef: name,
      after: { month, type, region },
    });
    revalidatePath('/truck/reports');
    return { id };
  });
}

/** Mark the truck-report list as seen for the current user → clears the nav
 * "Mới" badge on the next render. Intentionally does NOT revalidate the current
 * list, so the rows that were new still show their badge on this view. */
export async function markTruckReportsSeenAction(): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const actor = await getCurrentUser();
    requireRole(actor.role, ['ADMIN', 'MANAGER']);
    await requireFleet(actor, 'TRUCK');
    await db
      .update(carUsers)
      .set({ usrTruckReportsSeenAt: new Date() })
      .where(and(eq(carUsers.entId, actor.entId), eq(carUsers.usrId, actor.userId)));
    return { ok: true as const };
  });
}
