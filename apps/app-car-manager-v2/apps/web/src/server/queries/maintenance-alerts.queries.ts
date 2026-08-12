import 'server-only';
import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { type ListMaintenanceAlertsQuery } from '@car-v2/shared/zod';
import { db } from '@car-v2/db/client';
import {
  carMaintenanceAlerts,
  carUsers,
  carVehicles,
  type CarMaintenanceAlert,
} from '@car-v2/db/schema';

export interface MaintenanceAlertListItem {
  alert: CarMaintenanceAlert;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  acknowledgedByName: string | null;
}

/* Maintenance Alert is a car-workspace module (PRD Module 2 — oil interval +
 * đăng kiểm), and the evaluator only scans CAR vehicles. Joining on the type
 * keeps any legacy alert raised against a truck out of the car screens, so the
 * list can never disagree with what the cron now produces. */
const CAR_ONLY = eq(carVehicles.cvhType, 'CAR');

export async function listMaintenanceAlerts(
  entId: string,
  query: ListMaintenanceAlertsQuery,
): Promise<MaintenanceAlertListItem[]> {
  const filters: SQL[] = [eq(carMaintenanceAlerts.entId, entId), CAR_ONLY];

  if (query.status === 'UNRESOLVED') {
    filters.push(isNull(carMaintenanceAlerts.malResolvedAt));
  } else if (query.status === 'RESOLVED') {
    filters.push(sql`${carMaintenanceAlerts.malResolvedAt} IS NOT NULL`);
  } // 'ALL' → no filter

  if (query.vehicle_id) {
    filters.push(eq(carMaintenanceAlerts.malVehicleId, query.vehicle_id));
  }

  const rows = await db
    .select({
      alert: carMaintenanceAlerts,
      vehiclePlate: carVehicles.cvhPlateNumber,
      vehicleModel: carVehicles.cvhModel,
      acknowledgedByName: carUsers.usrName,
    })
    .from(carMaintenanceAlerts)
    /* inner: mal_vehicle_id is NOT NULL with an FK, so no row is lost — and the
     * CAR_ONLY predicate needs the join to be non-nullable to mean anything. */
    .innerJoin(carVehicles, eq(carMaintenanceAlerts.malVehicleId, carVehicles.cvhId))
    .leftJoin(carUsers, eq(carMaintenanceAlerts.malAcknowledgedBy, carUsers.usrId))
    .where(and(...filters))
    .orderBy(desc(carMaintenanceAlerts.malCreatedAt))
    .limit(query.limit);

  return rows.map((r) => ({
    alert: r.alert,
    vehiclePlate: r.vehiclePlate ?? null,
    vehicleModel: r.vehicleModel ?? null,
    acknowledgedByName: r.acknowledgedByName ?? null,
  }));
}

/** Critical alerts still nagging — feeds the sticky OilOverdueBanner.
 *
 * Excludes ACKNOWLEDGED as well as resolved. Nothing currently resolves an OIL
 * alert automatically (the `resolveOpenOilAlerts` hook the service docstring
 * refers to was never written), so filtering on `malResolvedAt` alone would pin
 * a red bar to every page forever — "Đã xử lý" in the list would dim the row
 * and change nothing. Acknowledging is the user saying they have seen it, which
 * is exactly when the banner should stop. The row stays in the list under the
 * "Chưa đóng" filter until it is genuinely resolved. */
export async function getCriticalUnresolvedAlerts(
  entId: string,
): Promise<MaintenanceAlertListItem[]> {
  const rows = await db
    .select({
      alert: carMaintenanceAlerts,
      vehiclePlate: carVehicles.cvhPlateNumber,
      vehicleModel: carVehicles.cvhModel,
      acknowledgedByName: carUsers.usrName,
    })
    .from(carMaintenanceAlerts)
    .innerJoin(carVehicles, eq(carMaintenanceAlerts.malVehicleId, carVehicles.cvhId))
    .leftJoin(carUsers, eq(carMaintenanceAlerts.malAcknowledgedBy, carUsers.usrId))
    .where(
      and(
        eq(carMaintenanceAlerts.entId, entId),
        CAR_ONLY,
        isNull(carMaintenanceAlerts.malResolvedAt),
        isNull(carMaintenanceAlerts.malAcknowledgedAt),
        eq(carMaintenanceAlerts.malSeverity, 'CRITICAL'),
      ),
    )
    .orderBy(desc(carMaintenanceAlerts.malCreatedAt))
    .limit(10);

  return rows.map((r) => ({
    alert: r.alert,
    vehiclePlate: r.vehiclePlate ?? null,
    vehicleModel: r.vehicleModel ?? null,
    acknowledgedByName: r.acknowledgedByName ?? null,
  }));
}

export async function countUnresolvedAlerts(entId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(carMaintenanceAlerts)
    .where(
      and(
        eq(carMaintenanceAlerts.entId, entId),
        isNull(carMaintenanceAlerts.malResolvedAt),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}
