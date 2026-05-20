import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carApprovalRules,
  type CarApprovalRule,
  type CarExpenseStatus,
  type CarExpenseType,
} from '@car-v2/db/schema';

/* Default approval policy per CLAUDE.md §4.8 / PRD §6.2.2.
 *
 * Keep this table in sync with the seed comments — `apr_auto_threshold` is
 * the amount UNDER which auto-approve fires. `apr_requires_approval=false`
 * means "always auto" regardless of amount. */
const DEFAULTS: Record<CarExpenseType, { requiresApproval: boolean; autoThreshold: number | null }> = {
  FUEL:       { requiresApproval: false, autoThreshold: null },
  OIL:        { requiresApproval: false, autoThreshold: null },
  PARKING:    { requiresApproval: false, autoThreshold: null },
  TOLL:       { requiresApproval: false, autoThreshold: null },
  MEAL:       { requiresApproval: false, autoThreshold: null },        // warning if > 500k handled in UI later
  ACCIDENT:   { requiresApproval: true,  autoThreshold: null },        // always needs admin
  REPAIR:     { requiresApproval: true,  autoThreshold: 1_000_000 },   // auto if < 1M VND
  INSPECTION: { requiresApproval: false, autoThreshold: null },
};

/* Load tenant's approval rule for a given expense type; seed defaults on
 * first miss. The seed is idempotent — concurrent first writes from
 * different drivers race on the unique index but `ON CONFLICT DO NOTHING`
 * via the Drizzle `onConflictDoNothing` keeps it safe. */
async function getOrSeedRule(entId: string, type: CarExpenseType): Promise<CarApprovalRule> {
  const existing = await db
    .select()
    .from(carApprovalRules)
    .where(and(eq(carApprovalRules.entId, entId), eq(carApprovalRules.aprType, type)))
    .limit(1);
  if (existing[0]) return existing[0];

  const def = DEFAULTS[type];
  const inserted = await db
    .insert(carApprovalRules)
    .values({
      aprId: randomUUID(),
      entId,
      aprType: type,
      aprRequiresApproval: def.requiresApproval ? 1 : 0,
      aprAutoThreshold: def.autoThreshold === null ? null : def.autoThreshold.toFixed(2),
    })
    .onConflictDoNothing()
    .returning();

  /* If the conflict path was taken (another concurrent submit beat us),
   * re-select. */
  if (inserted[0]) return inserted[0];
  const refetched = await db
    .select()
    .from(carApprovalRules)
    .where(and(eq(carApprovalRules.entId, entId), eq(carApprovalRules.aprType, type)))
    .limit(1);
  if (!refetched[0]) throw new Error('approval rule disappeared after upsert');
  return refetched[0];
}

/* Determine the status a fresh expense submission should land in.
 *
 * Pure-ish — DB-touching only via `getOrSeedRule`. No mutations to the
 * expense table here; the caller composes the insert. */
export async function decideInitialStatus(
  entId: string,
  type: CarExpenseType,
  amount: number,
): Promise<{ status: CarExpenseStatus; ruleId: string }> {
  const rule = await getOrSeedRule(entId, type);

  if (rule.aprRequiresApproval === 0) {
    return { status: 'AUTO_APPROVED', ruleId: rule.aprId };
  }
  if (rule.aprAutoThreshold !== null && amount < Number(rule.aprAutoThreshold)) {
    return { status: 'AUTO_APPROVED', ruleId: rule.aprId };
  }
  return { status: 'PENDING', ruleId: rule.aprId };
}
