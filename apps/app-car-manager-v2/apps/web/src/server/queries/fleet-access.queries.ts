import 'server-only';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carUsers,
  carUserFleetAccess,
  carFleetAccessRequests,
  type CarUserLocalRole,
} from '@car-v2/db/schema';
import type { FleetDept } from '@/components/layout/nav-items';

export interface FleetMemberRow {
  usrId: string;
  name: string | null;
  email: string | null;
  localRole: CarUserLocalRole;
  /** Departments the user can enter. ADMIN gets both implicitly. */
  depts: FleetDept[];
  /** True when access is implicit (ADMIN) — no per-dept grant/revoke needed. */
  implicit: boolean;
}

/**
 * All live members + the fleet departments each can enter (REQ-20260617).
 * ADMIN users resolve to both departments implicitly (no membership rows),
 * mirroring resolveFleetAccess in lib/auth/fleet-access.ts.
 */
export async function listFleetMembers(entId: string): Promise<FleetMemberRow[]> {
  const [users, memberships] = await Promise.all([
    db
      .select({
        usrId: carUsers.usrId,
        name: carUsers.usrName,
        email: carUsers.usrEmail,
        localRole: carUsers.usrLocalRole,
      })
      .from(carUsers)
      .where(and(eq(carUsers.entId, entId), isNull(carUsers.usrDeletedAt))),
    db
      .select({ usrId: carUserFleetAccess.usrId, type: carUserFleetAccess.ufaVehicleType })
      .from(carUserFleetAccess)
      .where(and(eq(carUserFleetAccess.entId, entId), isNull(carUserFleetAccess.ufaDeletedAt))),
  ]);

  const byUser = new Map<string, FleetDept[]>();
  for (const m of memberships) {
    const list = byUser.get(m.usrId) ?? [];
    list.push(m.type);
    byUser.set(m.usrId, list);
  }

  const order: FleetDept[] = ['CAR', 'TRUCK'];
  return users.map((u) => {
    const implicit = u.localRole === 'ADMIN';
    const depts = implicit ? [...order] : order.filter((d) => byUser.get(u.usrId)?.includes(d));
    return { ...u, depts, implicit };
  });
}

export interface FleetRequestRow {
  farId: string;
  usrId: string;
  requesterName: string | null;
  requesterEmail: string | null;
  vehicleType: FleetDept;
  reason: string | null;
  requestedAt: Date;
}

/** Pending fleet-access requests awaiting an admin decision. */
export async function listPendingFleetRequests(entId: string): Promise<FleetRequestRow[]> {
  const rows = await db
    .select({
      farId: carFleetAccessRequests.farId,
      usrId: carFleetAccessRequests.usrId,
      requesterName: carUsers.usrName,
      requesterEmail: carUsers.usrEmail,
      vehicleType: carFleetAccessRequests.farVehicleType,
      reason: carFleetAccessRequests.farReason,
      requestedAt: carFleetAccessRequests.farRequestedAt,
    })
    .from(carFleetAccessRequests)
    .leftJoin(carUsers, eq(carUsers.usrId, carFleetAccessRequests.usrId))
    .where(
      and(
        eq(carFleetAccessRequests.entId, entId),
        eq(carFleetAccessRequests.farStatus, 'PENDING'),
      ),
    )
    .orderBy(desc(carFleetAccessRequests.farRequestedAt));

  return rows.map((r) => ({
    farId: r.farId,
    usrId: r.usrId,
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    vehicleType: r.vehicleType,
    reason: r.reason,
    requestedAt: r.requestedAt,
  }));
}
