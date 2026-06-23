'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUsers, carDrivers, carUserFleetAccess } from '@car-v2/db/schema';
import { CarError, type ActionResult } from '@car-v2/shared/errors';
import { DEV_ENT_ID, DEV_PERSONAS, localRoleFor } from '@/lib/dev/test-personas';
import { runAction } from '../_helpers';

/**
 * Seed the dev test personas (managers per dept, drivers per dept) so they can
 * be logged into via `/dev-login`. Idempotent — only inserts what's missing.
 * Dev-only: refuses unless DEMO_AUTO_LOGIN=true (same gate as /dev-login), so it
 * can never run on staging/prod.
 */
export async function seedDevAccountsAction(): Promise<ActionResult<{ seeded: number }>> {
  return runAction(async () => {
    if (process.env.DEMO_AUTO_LOGIN !== 'true') {
      throw new CarError('CAR-E0403', 403, 'Dev account seeding is disabled');
    }

    let seeded = 0;
    for (const p of DEV_PERSONAS) {
      if (!p.sub) continue; // OWNER uses the default identity — auto-provisioned on login

      /* car_users — usr_id = sub (mirrors ensureCarUser convention). */
      const user = await db
        .select({ id: carUsers.usrId })
        .from(carUsers)
        .where(and(eq(carUsers.entId, DEV_ENT_ID), eq(carUsers.usrAmaUserId, p.sub)))
        .limit(1);
      if (user.length === 0) {
        await db.insert(carUsers).values({
          usrId: p.sub,
          entId: DEV_ENT_ID,
          usrAmaUserId: p.sub,
          usrName: p.name,
          usrLocalRole: localRoleFor(p),
          usrAmaRoleSnapshot: p.loginRole,
        });
        seeded++;
      }

      /* car_drivers — required for the driver completion/ownership checks. */
      if (p.driver) {
        const drv = await db
          .select({ id: carDrivers.drvId })
          .from(carDrivers)
          .where(
            and(
              eq(carDrivers.entId, DEV_ENT_ID),
              eq(carDrivers.drvUserId, p.sub),
              isNull(carDrivers.drvDeletedAt),
            ),
          )
          .limit(1);
        if (drv.length === 0) {
          await db.insert(carDrivers).values({
            drvId: p.driver.drvId,
            entId: DEV_ENT_ID,
            drvUserId: p.sub,
            drvLicenseNumber: p.driver.license,
            drvLicenseClass: 'B2',
            drvLicenseExpiry: '2030-12-31',
            drvStatus: 'AVAILABLE',
          });
        }
      }

      /* car_user_fleet_access — one live row per (user, dept). */
      for (const dept of p.depts) {
        const mem = await db
          .select({ id: carUserFleetAccess.ufaId })
          .from(carUserFleetAccess)
          .where(
            and(
              eq(carUserFleetAccess.entId, DEV_ENT_ID),
              eq(carUserFleetAccess.usrId, p.sub),
              eq(carUserFleetAccess.ufaVehicleType, dept),
              isNull(carUserFleetAccess.ufaDeletedAt),
            ),
          )
          .limit(1);
        if (mem.length === 0) {
          await db.insert(carUserFleetAccess).values({
            ufaId: randomUUID(),
            entId: DEV_ENT_ID,
            usrId: p.sub,
            ufaVehicleType: dept,
          });
        }
      }
    }

    return { seeded };
  });
}
