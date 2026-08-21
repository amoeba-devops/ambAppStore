import { neon } from '@neondatabase/serverless';

/**
 * Isolated seed for the truck report-recalc/allocation E2E (PLAN-20260707).
 *
 * Everything lives in an otherwise-empty month (default 2026-11) on the DEV
 * entity so it never collides with the demo data in 2026-06/07. Fixed IDs →
 * seeding is delete-then-insert (idempotent) and teardown is exact.
 *
 * Two isolated scopes in that month:
 *   - DONG_NAI: 2 completed LOG trips (300 km) + 2 fuel invoices (100 L) →
 *     ALLOCATABLE. avg price = mean(25000,27000)=26000, consumption=100/300.
 *   - HCM: 2 completed LOG trips with their own liters×price, NO invoices →
 *     FALLBACK ("Tạm tính thủ công").
 */

export const DEV_ENT = '00000000-0000-4000-8000-000000000010';
export const CREATOR = '00000000-0000-4000-8000-000000000001'; // Demo OWNER
export const MONTH = '2026-11';

export const VEH_DONGNAI = '29ad0000-0000-4000-8000-000000000201'; // 60C-311.07
export const VEH_HCM = '511a3e37-e747-4fe5-917a-b010e2ecf211'; // 29C-99999

/* Fixed fixture IDs (hex, char(36)-safe). */
const T_DN_1 = 'a11d0000-0000-4000-8000-0000000000d1';
const T_DN_2 = 'a11d0000-0000-4000-8000-0000000000d2';
const T_DN_3 = 'a11d0000-0000-4000-8000-0000000000d3'; // added mid-test (alloc freeze)
const T_HCM_1 = 'a11f0000-0000-4000-8000-0000000000f1';
const T_HCM_2 = 'a11f0000-0000-4000-8000-0000000000f2';
const INV_1 = 'a11e0000-0000-4000-8000-0000000000e1';
const INV_2 = 'a11e0000-0000-4000-8000-0000000000e2';
const INV_3 = 'a11e0000-0000-4000-8000-0000000000e3'; // added mid-test (regenerate)
const TFC_DN = 'a11c0000-0000-4000-8000-0000000000c1'; // manual fixed cost (alloc freeze)

const ALL_TRIP_IDS = [T_DN_1, T_DN_2, T_DN_3, T_HCM_1, T_HCM_2];
const ALL_INV_IDS = [INV_1, INV_2, INV_3];

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set (e2e truck-seed)');
  return neon(url);
}

/** ISO timestamp on the 15th of MONTH so it sits squarely inside the month. */
function at(day: number, hour = 8): string {
  return `${MONTH}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

async function insertTrip(
  q: ReturnType<typeof sql>,
  o: {
    id: string;
    ref: string;
    vehicleId: string;
    day: number;
    startKm: number;
    endKm: number;
    revenue: number;
    toll: number;
    liters: number;
    price: number;
    customer: string;
  },
): Promise<void> {
  await q`
    INSERT INTO car_trips (
      trp_id, ent_id, trp_ref, trp_creator_id, trp_vehicle_id, trp_status, trp_kind,
      trp_pickup_address, trp_dropoff_address, trp_scheduled_at, trp_started_at, trp_ended_at,
      trp_start_odometer, trp_end_odometer, trp_customer,
      trp_fuel_liters, trp_fuel_price, trp_toll_fee, trp_revenue, trp_updated_at
    ) VALUES (
      ${o.id}, ${DEV_ENT}, ${o.ref}, ${CREATOR}, ${o.vehicleId}, 'COMPLETED', 'LOG',
      'Bãi DEV', ${o.customer}, ${at(o.day)}, ${at(o.day, 8)}, ${at(o.day, 12)},
      ${o.startKm}, ${o.endKm}, ${o.customer},
      ${String(o.liters)}, ${String(o.price)}, ${String(o.toll)}, ${String(o.revenue)},
      /* App-created COMPLETED trips always carry an updated_at (the completion
       * write sets it) — the report-coverage rule (changedAt vs trr_created_at)
       * reads it, so the fixture must look the same. now() = "logged just now",
       * i.e. NOT covered by any report generated earlier in the test. */
      now()
    )
  `;
}

async function insertInvoice(
  q: ReturnType<typeof sql>,
  o: { id: string; region: string; day: number; station: string; liters: number; price: number },
): Promise<void> {
  await q`
    INSERT INTO car_truck_fuel_invoices (
      tfi_id, ent_id, tfi_vehicle_type, tfi_month, tfi_region, tfi_date, tfi_station, tfi_liters, tfi_price
    ) VALUES (
      ${o.id}, ${DEV_ENT}, 'TRUCK', ${MONTH}, ${o.region}, ${`${MONTH}-${String(o.day).padStart(2, '0')}`},
      ${o.station}, ${String(o.liters)}, ${String(o.price)}
    )
  `;
}

/** Wipe + reseed the fixture. Safe to call repeatedly. */
export async function seedTruckAllocationFixture(): Promise<void> {
  const q = sql();
  await teardownTruckAllocationFixture();

  // DONG_NAI — allocatable (300 km, 100 L, avg 26000, consumption 0.3333)
  await insertTrip(q, { id: T_DN_1, ref: 'E2E-DN-1', vehicleId: VEH_DONGNAI, day: 5, startKm: 1000, endKm: 1100, revenue: 8_000_000, toll: 200_000, liters: 30, price: 24_000, customer: 'KH Đồng Nai A' });
  await insertTrip(q, { id: T_DN_2, ref: 'E2E-DN-2', vehicleId: VEH_DONGNAI, day: 12, startKm: 1100, endKm: 1300, revenue: 12_000_000, toll: 300_000, liters: 55, price: 24_500, customer: 'KH Đồng Nai B' });
  await insertInvoice(q, { id: INV_1, region: 'DONG_NAI', day: 3, station: 'Petrolimex Biên Hòa', liters: 60, price: 25_000 });
  await insertInvoice(q, { id: INV_2, region: 'DONG_NAI', day: 18, station: 'PVOil Long Thành', liters: 40, price: 27_000 });

  // HCM — fallback (no invoices)
  await insertTrip(q, { id: T_HCM_1, ref: 'E2E-HCM-1', vehicleId: VEH_HCM, day: 6, startKm: 500, endKm: 590, revenue: 6_000_000, toll: 150_000, liters: 25, price: 26_000, customer: 'KH Sài Gòn A' });
  await insertTrip(q, { id: T_HCM_2, ref: 'E2E-HCM-2', vehicleId: VEH_HCM, day: 20, startKm: 590, endKm: 700, revenue: 7_000_000, toll: 100_000, liters: 30, price: 26_500, customer: 'KH Sài Gòn B' });
}

/** Add a 3rd DONG_NAI invoice → shifts avg to 27333, consumption to 0.5. */
export async function addThirdDongNaiInvoice(): Promise<void> {
  const q = sql();
  await q`DELETE FROM car_truck_fuel_invoices WHERE tfi_id = ${INV_3}`;
  await insertInvoice(q, { id: INV_3, region: 'DONG_NAI', day: 25, station: 'Shell Nhơn Trạch', liters: 50, price: 30_000 });
}

/* ── Fixed-allocation freeze fixture (REQ-20260821) ─────────────────────── */

/** Manual fixed cost for (VEH_DONGNAI, MONTH) — the tier-1 source both the live
 * allocation and the report freeze read, self-contained (no rate history). */
export async function seedDongNaiFixedCost(salary: number, depreciation: number): Promise<void> {
  const q = sql();
  await q`DELETE FROM car_truck_fixed_costs WHERE tfc_id = ${TFC_DN}`;
  await q`
    INSERT INTO car_truck_fixed_costs (tfc_id, ent_id, cvh_id, tfc_month, tfc_salary, tfc_depreciation)
    VALUES (${TFC_DN}, ${DEV_ENT}, ${VEH_DONGNAI}, ${MONTH}, ${String(salary)}, ${String(depreciation)})
    ON CONFLICT (ent_id, cvh_id, tfc_month)
    DO UPDATE SET tfc_salary = ${String(salary)}, tfc_depreciation = ${String(depreciation)}
  `;
}

/** A 3rd DONG_NAI trip "logged after the report" (trp_updated_at = now()). */
export async function addThirdDongNaiTrip(): Promise<void> {
  const q = sql();
  await q`DELETE FROM car_trips WHERE trp_id = ${T_DN_3}`;
  await insertTrip(q, { id: T_DN_3, ref: 'E2E-DN-3', vehicleId: VEH_DONGNAI, day: 26, startKm: 1300, endKm: 1400, revenue: 9_000_000, toll: 0, liters: 20, price: 25_000, customer: 'KH Đồng Nai C' });
}

/** Soft-delete the 3rd trip — the app's delete path (trp_deleted_at). */
export async function softDeleteThirdDongNaiTrip(): Promise<void> {
  const q = sql();
  await q`UPDATE car_trips SET trp_deleted_at = now() WHERE trp_id = ${T_DN_3}`;
}

/** Frozen allocation basis rows of the latest live report for a region. */
export async function latestReportFixedAlloc(
  region: string,
): Promise<{ vehicleId: string; salary: number; depreciation: number; tripCount: number }[] | null> {
  const q = sql();
  const rows = await q`
    SELECT trr_fixed_alloc AS alloc
    FROM car_truck_reports
    WHERE ent_id = ${DEV_ENT} AND trr_month = ${MONTH} AND trr_region = ${region}
      AND trr_deleted_at IS NULL
    ORDER BY trr_created_at DESC
    LIMIT 1
  `;
  return (rows[0]?.alloc as { vehicleId: string; salary: number; depreciation: number; tripCount: number }[] | null) ?? null;
}

/** Simulate a pre-0029 report: wipe the frozen alloc → readers must fall back
 * to the live computation (grandfather path). */
export async function nullifyReportFixedAlloc(region: string): Promise<void> {
  const q = sql();
  await q`
    UPDATE car_truck_reports SET trr_fixed_alloc = NULL
    WHERE ent_id = ${DEV_ENT} AND trr_month = ${MONTH} AND trr_region = ${region}
  `;
}

/** Latest live report snapshot for a (month, region) — verifies persistence. */
export async function latestReportSnapshot(
  region: string,
): Promise<{ avgPrice: number; consumption: number; totalLiters: number; totalKm: number } | null> {
  const q = sql();
  const rows = await q`
    SELECT trr_avg_price AS avg_price, trr_consumption AS consumption,
           trr_total_liters AS total_liters, trr_total_km AS total_km
    FROM car_truck_reports
    WHERE ent_id = ${DEV_ENT} AND trr_month = ${MONTH} AND trr_region = ${region}
      AND trr_deleted_at IS NULL
    ORDER BY trr_created_at DESC
    LIMIT 1
  `;
  const r = rows[0];
  if (!r || r.avg_price == null) return null;
  return {
    avgPrice: Number(r.avg_price),
    consumption: Number(r.consumption),
    totalLiters: Number(r.total_liters),
    totalKm: Number(r.total_km),
  };
}

/** Count of live report rows for a (month, region) — used to confirm a
 * generation happened even when it froze no snapshot (fallback mode). */
export async function reportRowCount(region: string): Promise<number> {
  const q = sql();
  const rows = await q`
    SELECT COUNT(*)::int AS n
    FROM car_truck_reports
    WHERE ent_id = ${DEV_ENT} AND trr_month = ${MONTH} AND trr_region = ${region}
      AND trr_deleted_at IS NULL
  `;
  return Number(rows[0]?.n ?? 0);
}

/** Remove every fixture row incl. any reports generated during the run. */
export async function teardownTruckAllocationFixture(): Promise<void> {
  const q = sql();
  await q`DELETE FROM car_trip_extra_costs WHERE ent_id = ${DEV_ENT} AND trp_id = ANY(${ALL_TRIP_IDS})`;
  await q`DELETE FROM car_trips WHERE ent_id = ${DEV_ENT} AND trp_id = ANY(${ALL_TRIP_IDS})`;
  await q`DELETE FROM car_truck_fuel_invoices WHERE ent_id = ${DEV_ENT} AND tfi_id = ANY(${ALL_INV_IDS})`;
  await q`DELETE FROM car_truck_fixed_costs WHERE tfc_id = ${TFC_DN}`;
  await q`DELETE FROM car_truck_reports WHERE ent_id = ${DEV_ENT} AND trr_month = ${MONTH}`;
}
