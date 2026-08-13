import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUserRegionAccess } from '@car-v2/db/schema';
import { CarError } from '@car-v2/shared/errors';
import { TRUCK_REGIONS, type TruckRegion } from '@car-v2/shared/zod';
import type { LocalRole } from '@car-v2/shared/auth';
import type { AuthContext } from './get-current-user';
import { requireFleet } from './fleet-access';

/**
 * `'ALL'` means unrestricted — either ADMIN, or a user with no grant rows.
 * Distinct from an empty array, which never occurs: no rows === unrestricted.
 */
export type RegionScope = 'ALL' | TruckRegion[];

const resolveRegionAccessCached = cache(
  async (entId: string, userId: string, role: LocalRole): Promise<RegionScope> => {
    if (role === 'ADMIN') return 'ALL';

    const rows = await db
      .select({ region: carUserRegionAccess.uraRegion })
      .from(carUserRegionAccess)
      .where(
        and(
          eq(carUserRegionAccess.entId, entId),
          eq(carUserRegionAccess.usrId, userId),
          isNull(carUserRegionAccess.uraDeletedAt),
        ),
      );

    /* No grants → unrestricted (pre-REQ-20260813 behaviour preserved). */
    if (rows.length === 0) return 'ALL';

    /* Filter through TRUCK_REGIONS so the order is canonical and any stale code
     * left in the table (a region removed from TRUCK_REGIONS) is dropped. */
    return TRUCK_REGIONS.filter((r) => rows.some((row) => row.region === r));
  },
);

export function resolveRegionAccess(actor: AuthContext): Promise<RegionScope> {
  return resolveRegionAccessCached(actor.entId, actor.userId, actor.role);
}

/** Regions to render in pickers/filters. Unrestricted → every region. */
export async function allowedRegions(actor: AuthContext): Promise<readonly TruckRegion[]> {
  const scope = await resolveRegionAccess(actor);
  return scope === 'ALL' ? TRUCK_REGIONS : scope;
}

export async function hasRegion(actor: AuthContext, region: string): Promise<boolean> {
  const scope = await resolveRegionAccess(actor);
  return scope === 'ALL'
    ? (TRUCK_REGIONS as readonly string[]).includes(region)
    : (scope as readonly string[]).includes(region);
}

/** Enforce access to one region. Throws CAR-E0403. Mirrors `requireFleet()`. */
export async function requireRegion(actor: AuthContext, region: string): Promise<void> {
  if (!(await hasRegion(actor, region))) {
    throw new CarError('CAR-E0403', 403, `Forbidden: no access to region ${region}`);
  }
}

/**
 * The two TRUCK gates in one call — fleet department first, then region. Prefer
 * this over calling `requireFleet` and `requireRegion` separately so a new truck
 * screen can't accidentally check one and forget the other.
 *
 * `region` is optional because "all regions" views have no region to check;
 * they must still scope their data via `allowedRegions()`.
 */
export async function requireTruckRegion(actor: AuthContext, region?: string): Promise<void> {
  await requireFleet(actor, 'TRUCK');
  if (region) await requireRegion(actor, region);
}

/**
 * Normalize a `?region=` search param against the actor's scope, for PAGES.
 *
 * - valid + permitted → that region
 * - absent/invalid    → `undefined` (caller shows "all", scoped by `regions`)
 * - valid but denied  → redirect to the same page with `region` dropped, plus
 *   `?region_denied=<code>` so the screen can explain why the filter reset
 *
 * Redirecting (rather than throwing) keeps a forbidden region from surfacing as
 * the generic "something went wrong" boundary, and matches how the rest of the
 * app handles an authorization miss on a page. Server Actions and Route
 * Handlers use `requireRegion` / `hasRegion` instead — there a 403 is correct.
 *
 * `regions` is the scope to apply when no single region is selected — pass it to
 * queries so an unrestricted-looking "all regions" view still respects limits.
 */
export async function resolveRegionFilter(
  actor: AuthContext,
  raw: string | undefined,
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<{ region: TruckRegion | undefined; regions: readonly TruckRegion[] }> {
  const permitted = await allowedRegions(actor);

  if (!raw || !(TRUCK_REGIONS as readonly string[]).includes(raw)) {
    return { region: undefined, regions: permitted };
  }
  const region = raw as TruckRegion;
  if (!permitted.includes(region)) {
    redirect(await deniedRegionHref(region, searchParams));
  }
  return { region, regions: permitted };
}

/** Same page, `region` swapped for `region_denied` so the UI can say why. */
async function deniedRegionHref(
  denied: string,
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<string> {
  const h = await headers();
  const pathname = h.get('x-pathname') ?? '/truck/dashboard';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (k === 'region' || k === 'region_denied' || v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) qs.append(k, one);
  }
  qs.set('region_denied', denied);
  return `${pathname}?${qs.toString()}`;
}
