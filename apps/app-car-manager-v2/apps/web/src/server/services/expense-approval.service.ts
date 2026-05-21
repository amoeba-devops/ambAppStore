import 'server-only';
import type { CarExpenseStatus, CarExpenseType } from '@car-v2/db/schema';

/* Admin approval flow was removed per updated user-flow §3.2 — every
 * submitted expense lands in AUTO_APPROVED. The `car_approval_rules` table
 * and the policy DEFAULTS that used to seed per-tenant thresholds are dormant
 * now (kept in the schema to preserve history, but no read path reaches them).
 *
 * Keep `decideInitialStatus()` as the single hook used by `submitExpenseAction`
 * so the call-site need not change. Returning `ruleId: null` was tempting but
 * would force every downstream consumer to handle the new shape — instead we
 * return an empty string for `ruleId` since no consumer reads it post-removal.
 *
 * If admin approval ever comes back, restore the old policy-table read here
 * and update the caller to surface PENDING again. */
export function decideInitialStatus(
  _entId: string,
  _type: CarExpenseType,
  _amount: number,
): { status: CarExpenseStatus; ruleId: string } {
  return { status: 'AUTO_APPROVED', ruleId: '' };
}
