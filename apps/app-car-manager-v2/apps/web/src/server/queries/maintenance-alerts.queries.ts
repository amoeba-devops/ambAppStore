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

export async function listMaintenanceAlerts(
  entId: string,
  query: ListMaintenanceAlertsQuery,
): Promise<MaintenanceAlertListItem[]> {
  const filters: SQL[] = [eq(carMaintenanceAlerts.entId, entId)];

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
    .leftJoin(carVehicles, eq(carMaintenanceAlerts.malVehicleId, carVehicles.cvhId))
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

/** Critical-only unresolved alerts — used by the sticky OilOverdueBanner. */
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
    .leftJoin(carVehicles, eq(carMaintenanceAlerts.malVehicleId, carVehicles.cvhId))
    .leftJoin(carUsers, eq(carMaintenanceAlerts.malAcknowledgedBy, carUsers.usrId))
    .where(
      and(
        eq(carMaintenanceAlerts.entId, entId),
        isNull(carMaintenanceAlerts.malResolvedAt),
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
