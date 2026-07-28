import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUsers, carDrivers, carUserFleetAccess } from '@car-v2/db/schema';
import { DEV_ENT_ID, DEV_PERSONAS, localRoleFor } from './test-personas';

/**
 * Dev-only: make a /dev-login persona self-sufficient by ensuring its
 * car_users + car_drivers + car_user_fleet_access rows exist. This replaces the
 * old "seed" button — a manager persona (e.g. QT Xe tải) needs a live TRUCK row
 * in car_user_fleet_access or `resolveFleetAccess` returns [] and the truck
 * layout bounces them to /dashboard.
 *
 * Idempotent (only inserts what's missing) and best-effort (never throws into
 * the login flow). No-op unless DEMO_AUTO_LOGIN=true, the sub matches a known
 * persona, and the login targets the dev entity. ADMIN/OWNER needs no rows —
 * `resolveFleetAccess` grants both fleets implicitly.
 */
export async function provisionDevPersona(sub: string, entId: string): Promise<void> {
  if (process.env.DEMO_AUTO_LOGIN !== 'true') return;
  if (entId !== DEV_ENT_ID) return;
  const p = DEV_PERSONAS.find((x) => x.sub === sub);
  if (!p) return;

  try {
    /* car_users — usr_id = sub (mirrors ensureCarUser convention). The
     * fleet-access + driver rows FK onto this, so it must exist first. */
    const user = await db
      .select({ id: carUsers.usrId })
      .from(carUsers)
      .where(and(eq(carUsers.entId, DEV_ENT_ID), eq(carUsers.usrAmaUserId, sub)))
      .limit(1);
    if (user.length === 0) {
      await db.insert(carUsers).values({
        usrId: sub,
        entId: DEV_ENT_ID,
        usrAmaUserId: sub,
        usrName: p.name,
        usrLocalRole: localRoleFor(p),
        usrAmaRoleSnapshot: p.loginRole,
      });
    }

    /* car_drivers — required for the driver completion/ownership checks. */
    if (p.driver) {
      const drv = await db
        .select({ id: carDrivers.drvId })
        .from(carDrivers)
        .where(
          and(
            eq(carDrivers.entId, DEV_ENT_ID),
            eq(carDrivers.drvUserId, sub),
            isNull(carDrivers.drvDeletedAt),
          ),
        )
        .limit(1);
      if (drv.length === 0) {
        await db.insert(carDrivers).values({
          drvId: p.driver.drvId,
          entId: DEV_ENT_ID,
          drvUserId: sub,
          drvLicenseNumber: p.driver.license,
          drvLicenseClass: 'B2',
          drvLicenseExpiry: '2030-12-31',
          drvStatus: 'AVAILABLE',
        });
      }
    }

    /* car_user_fleet_access — one live row per (user, dept).
     *
     * A DRIVER belongs to exactly ONE department (same invariant enforced by
     * grantFleetAccessAction and createDriverAction). This helper only ever
     * INSERTS, so when a driver's real membership has since moved to the other
     * department, granting `p.depts` on top would leave them holding BOTH —
     * visible in both rosters, assignable in neither. That is a bootstrap
     * helper silently re-creating a bug the app now prevents.
     *
     * So for a driver persona, `depts` is a seed default, not an assertion:
     * grant it only when the user has NO live membership at all. Whatever a
     * real admin (or a data fix) set afterwards wins. Managers/admins keep the
     * additive behaviour — holding two departments is legitimate for them, and
     * "QL 2 phòng" needs both rows to exist. */
    if (localRoleFor(p) === 'DRIVER') {
      const any = await db
        .select({ id: carUserFleetAccess.ufaId })
        .from(carUserFleetAccess)
        .where(
          and(
            eq(carUserFleetAccess.entId, DEV_ENT_ID),
            eq(carUserFleetAccess.usrId, sub),
            isNull(carUserFleetAccess.ufaDeletedAt),
          ),
        )
        .limit(1);
      if (any.length > 0) return;
    }

    for (const dept of p.depts) {
      const mem = await db
        .select({ id: carUserFleetAccess.ufaId })
        .from(carUserFleetAccess)
        .where(
          and(
            eq(carUserFleetAccess.entId, DEV_ENT_ID),
            eq(carUserFleetAccess.usrId, sub),
            eq(carUserFleetAccess.ufaVehicleType, dept),
            isNull(carUserFleetAccess.ufaDeletedAt),
          ),
        )
        .limit(1);
      if (mem.length === 0) {
        await db.insert(carUserFleetAccess).values({
          ufaId: randomUUID(),
          entId: DEV_ENT_ID,
          usrId: sub,
          ufaVehicleType: dept,
        });
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[provisionDevPersona] failed (dev only):', (e as Error).message);
  }
}
