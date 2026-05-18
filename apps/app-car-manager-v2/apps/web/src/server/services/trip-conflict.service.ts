import 'server-only';
import { and, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTrips } from '@car-v2/db/schema';

/**
 * Schedule conflict detection (PRD §9.3 R-1, R-2 — R3 soft-warning).
 *
 * Quét trips active (`PENDING_DRIVER_CONFIRMATION`, `CONFIRMED`, `IN_PROGRESS`)
 * cùng `ent_id` để phát hiện overlap về xe HOẶC tài xế. Mode soft-warning:
 * caller chỉ hiển thị banner, không block save. Bypass được audit log
 * bằng action `TRIP.CONFLICT_OVERRIDDEN`.
 *
 * Pure service — không import `next/*`. Khi `duration_minutes` không có,
 * default 60 phút để compute end (đồng nhất với UI). Overlap dùng nửa-mở
 * `[start, end)` để 2 chuyến nối tiếp khít (end-A == start-B) KHÔNG tính là conflict.
 */

/** Các status được coi là "active" — chiếm xe/tài xế trong cửa sổ thời gian. */
const ACTIVE_STATUSES: Array<'PENDING_DRIVER_CONFIRMATION' | 'CONFIRMED' | 'IN_PROGRESS'> = [
  'PENDING_DRIVER_CONFIRMATION',
  'CONFIRMED',
  'IN_PROGRESS',
];

/** Default duration khi trip không nhập (giữ đồng bộ với MVP UI). */
export const DEFAULT_DURATION_MINUTES = 60;

export interface ConflictRef {
  trpId: string;
  trpRef: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  pickupAddress: string;
  dropoffAddress: string;
  status: 'PENDING_DRIVER_CONFIRMATION' | 'CONFIRMED' | 'IN_PROGRESS';
}

export interface ConflictResult {
  vehicle: ConflictRef[];
  driver: ConflictRef[];
}

export interface FindConflictsParams {
  entId: string;
  vehicleId?: string | null;
  driverId?: string | null;
  scheduledAt: Date;
  durationMinutes?: number | null;
  /** Khi edit trip — exclude chính trip này khỏi kết quả. */
  excludeTripId?: string;
}

export async function findTripConflicts(params: FindConflictsParams): Promise<ConflictResult> {
  const { entId, vehicleId, driverId, scheduledAt, durationMinutes, excludeTripId } = params;

  /* Chỉ check khi có ít nhất 1 trong 2 (vehicle hoặc driver) — không có thì không thể conflict. */
  if (!vehicleId && !driverId) {
    return { vehicle: [], driver: [] };
  }

  const duration = durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const endAt = new Date(scheduledAt.getTime() + duration * 60_000);

  /* Postgres half-open interval overlap:
   *   candidate_start < endAt
   *   AND candidate_start + (candidate_duration_or_60 minutes) > scheduledAt
   *
   * Drizzle không có expressive helper cho "+ interval N minutes" với column,
   * nên dùng raw sql cho phần end-time của candidate.
   */
  const candidateEndExpr = sql<Date>`(
    ${carTrips.trpScheduledAt}
    + (COALESCE(${carTrips.trpDurationMinutes}, ${DEFAULT_DURATION_MINUTES}) * INTERVAL '1 minute')
  )`;

  const baseConditions = [
    eq(carTrips.entId, entId),
    isNull(carTrips.trpDeletedAt),
    inArray(carTrips.trpStatus, ACTIVE_STATUSES),
    lt(carTrips.trpScheduledAt, endAt),
    sql`${candidateEndExpr} > ${scheduledAt}`,
  ];
  if (excludeTripId) {
    baseConditions.push(ne(carTrips.trpId, excludeTripId));
  }

  const [vehicleRows, driverRows] = await Promise.all([
    vehicleId
      ? db.query.carTrips.findMany({
          where: and(...baseConditions, eq(carTrips.trpVehicleId, vehicleId)),
          columns: {
            trpId: true,
            trpRef: true,
            trpScheduledAt: true,
            trpDurationMinutes: true,
            trpPickupAddress: true,
            trpDropoffAddress: true,
            trpStatus: true,
          },
          orderBy: (t, { asc }) => asc(t.trpScheduledAt),
          limit: 10,
        })
      : Promise.resolve([]),
    driverId
      ? db.query.carTrips.findMany({
          where: and(...baseConditions, eq(carTrips.trpDriverId, driverId)),
          columns: {
            trpId: true,
            trpRef: true,
            trpScheduledAt: true,
            trpDurationMinutes: true,
            trpPickupAddress: true,
            trpDropoffAddress: true,
            trpStatus: true,
          },
          orderBy: (t, { asc }) => asc(t.trpScheduledAt),
          limit: 10,
        })
      : Promise.resolve([]),
  ]);

  const toRef = (r: typeof vehicleRows[number]): ConflictRef => ({
    trpId: r.trpId,
    trpRef: r.trpRef,
    scheduledAt: r.trpScheduledAt.toISOString(),
    durationMinutes: r.trpDurationMinutes ?? DEFAULT_DURATION_MINUTES,
    pickupAddress: r.trpPickupAddress,
    dropoffAddress: r.trpDropoffAddress,
    status: r.trpStatus as (typeof ACTIVE_STATUSES)[number],
  });

  return {
    vehicle: vehicleRows.map(toRef),
    driver: driverRows.map(toRef),
  };
}

/** Convenience để caller kiểm tra có conflict không mà không cần check 2 array. */
export function hasAnyConflict(r: ConflictResult): boolean {
  return r.vehicle.length > 0 || r.driver.length > 0;
}

/** Trả về tập trpId xuất hiện ít nhất 1 lần — dùng cho audit override payload. */
export function collectConflictIds(r: ConflictResult): string[] {
  const set = new Set<string>();
  for (const c of r.vehicle) set.add(c.trpId);
  for (const c of r.driver) set.add(c.trpId);
  return Array.from(set);
}
