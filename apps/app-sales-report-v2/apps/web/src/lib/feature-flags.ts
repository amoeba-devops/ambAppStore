/**
 * Centralised feature flag readers. Each flag is a `NEXT_PUBLIC_*` env var so
 * it is inlined at build time and accessible from both Server + Client code.
 *
 * Default behaviour when unset is "off" so a missing env can never accidentally
 * enable a half-rolled feature in production.
 */

const ON = 'on';

function isOn(value: string | undefined): boolean {
  return value === ON;
}

/**
 * Phase 1 of versioned prime cost. When `on`, the master loader returns
 * `versions[]` per SKU and calculators look up cost by order date. When `off`,
 * loader synthesizes a single-version array from the flat `pcs_prime_cost_vnd`
 * column so calculator code stays uniform.
 */
export function isPrimeCostVersioningEnabled(): boolean {
  return isOn(process.env.NEXT_PUBLIC_PRIME_COST_VERSIONING);
}
