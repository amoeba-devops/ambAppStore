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
import { listVehicles, type VehicleListItem } from '@/server/queries/vehicles.queries';

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

/**
 * Resolve a `?vehicles=` (CSV) search param into the set of TRUCKs the actor may
 * actually report on (REQ-20260814). This is the region ACL pushed down to the
 * vehicle level: the candidate set is every live TRUCK in the actor's permitted
 * regions, and any id outside it is dropped SILENTLY — same forgiving behaviour
 * the single-value `?vehicle=` filter already had on the pages.
 *
 * `vehicleIds === undefined` means "no extra filter" — i.e. every truck in
 * `trucks`. Callers pass it straight to the queries, which then fall back to
 * their region scope. Selecting every truck normalizes to that same state so a
 * fully-ticked picker and an untouched one produce the same URL and the same SQL.
 *
 * Used by BOTH the pages and the export route handlers. The handlers bypass the
 * `/truck` layout guard, so this is the only thing standing between a crafted
 * `?vehicles=` and another region's data — never skip it there.
 */
export async function resolveVehicleScope(
  actor: AuthContext,
  raw: string | undefined,
): Promise<{
  /** Trucks the actor may see — render the picker from this. */
  trucks: VehicleListItem[];
  /** Selected subset, or undefined for "all of `trucks`". */
  vehicleIds: string[] | undefined;
  isAll: boolean;
}> {
  const permitted = await allowedRegions(actor);
  const all = await listVehicles(actor.entId, 'active', 'TRUCK');
  /* A truck with no region is invisible to a narrowed user: there is no region
   * to grant, so it can only belong to the unrestricted view. */
  const trucks =
    permitted.length < TRUCK_REGIONS.length
      ? all.filter((v) => v.cvhRegion !== null && (permitted as readonly string[]).includes(v.cvhRegion))
      : all;

  const wanted = new Set(
    (raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  /* Iterate `trucks` (not `wanted`) so the result is de-duplicated and ordered
   * by plate, matching the picker. */
  const selected = trucks.filter((v) => wanted.has(v.cvhId)).map((v) => v.cvhId);

  /* Nothing valid asked for, or everything asked for → "all" (drops the param). */
  const isAll = selected.length === 0 || selected.length === trucks.length;
  return { trucks, vehicleIds: isAll ? undefined : selected, isAll };
}

/**
 * Resolve the vehicle scope for GENERATING an official report on ONE region
 * (REQ-20260817, Phase A0) — distinct from `resolveVehicleScope` above, which
 * serves the ad-hoc export screens and lets a selection span several regions.
 * A chốt-sổ report always freezes numbers for exactly one region at a time, so
 * this locks the candidate set to that region and re-derives it FRESH from the
 * DB (live `cvh_deleted_at` / `cvh_region`) every call — the wizard's step 2.5
 * only renders a snapshot; the action that actually generates the report calls
 * this AGAIN so a vehicle removed/moved/deleted between opening the wizard and
 * confirming can never sneak into the frozen numbers.
 *
 * Unlike `resolveVehicleScope`'s "garbage in → falls back to all", an empty
 * result here after a non-empty request is a HARD error (CAR-E0001): silently
 * reinterpreting "every id you asked for is invalid" as "generate for the
 * whole region anyway" would freeze numbers for vehicles the caller never
 * intended to include in this chốt-sổ run.
 */
export async function resolveReportVehicleScope(
  actor: AuthContext,
  region: string,
  rawIds: readonly string[] | undefined,
): Promise<{
  /** Every live TRUCK in this region — render the step-2.5 picker from this. */
  vehicles: VehicleListItem[];
  /** Selected subset, or undefined for "all of `vehicles`". */
  vehicleIds: string[] | undefined;
}> {
  await requireRegion(actor, region);
  const all = await listVehicles(actor.entId, 'active', 'TRUCK');
  const vehicles = all.filter((v) => v.cvhRegion === region);

  if (!rawIds || rawIds.length === 0) return { vehicles, vehicleIds: undefined };

  const wanted = new Set(rawIds);
  /* Iterate `vehicles` (not `rawIds`) so the result is de-duplicated, ordered
   * by plate, and can never contain an id outside this region/ACL/live set —
   * a vehicle from another region, another tenant, or since soft-deleted is
   * dropped SILENTLY here (matches the picker's own candidate list), but see
   * below: if that leaves NOTHING, the caller must not proceed anyway. */
  const selected = vehicles.filter((v) => wanted.has(v.cvhId)).map((v) => v.cvhId);
  if (selected.length === 0) {
    throw new CarError(
      'CAR-E0001',
      400,
      'None of the requested vehicles are valid for this region — refusing to silently report the whole region instead',
    );
  }
  const isAll = selected.length === vehicles.length;
  return { vehicles, vehicleIds: isAll ? undefined : selected };
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
