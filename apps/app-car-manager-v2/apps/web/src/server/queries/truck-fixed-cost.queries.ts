import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carTruckFixedCosts } from '@car-v2/db/schema';
import { parseAmount } from '@car-v2/core/truck';

export interface TruckFixedCostValues {
  salary: number;
  depreciation: number;
  insurance: number;
}

/** Fixed costs for a given month, keyed by vehicle id (for the settings form). */
export async function getTruckFixedCostsByMonth(
  entId: string,
  month: string,
): Promise<Map<string, TruckFixedCostValues>> {
  const rows = await db
    .select()
    .from(carTruckFixedCosts)
    .where(and(eq(carTruckFixedCosts.entId, entId), eq(carTruckFixedCosts.tfcMonth, month)));

  const map = new Map<string, TruckFixedCostValues>();
  for (const r of rows) {
    map.set(r.cvhId, {
      salary: parseAmount(r.tfcSalary),
      depreciation: parseAmount(r.tfcDepreciation),
      insurance: parseAmount(r.tfcInsurance),
    });
  }
  return map;
}
