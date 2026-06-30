/**
 * Registry of all editable formula parameters. Single source of truth for:
 *   - validation on write (server rejects unknown keys, wrong value types)
 *   - UI rendering (auto-render Formula Config rows from this registry)
 *   - default fallback (when DB has no rows for a key)
 *   - i18n key derivation (`{section}.{key}.label`)
 *
 * Adding a new editable param = add an entry here + seed a default row in the
 * next migration. The UI auto-renders and the loader auto-loads — no per-key
 * boilerplate.
 *
 * See REQ-20260630-formula-config-persist.
 */

export type FormulaValueType =
  | 'numeric' // raw integer/float, e.g. 14000 (Fulfillment Fee VND)
  | 'percentage' // numeric stored as integer (e.g. 26 = 26%); parsed as `value / 100` when applied
  | 'currency' // numeric value with unit (VND, KRW)
  | 'date' // ISO date string 'YYYY-MM-DD'
  | 'enum'; // value must be in `enumOptions`

export interface FormulaParamSpec {
  /** snake_case DB key. e.g. 'tiktok_platform_fee_rate_pct'. Stable forever once published. */
  key: string;
  /** Human-readable label (English) — i18n keys read `formulaConfig.params.{key}.label`. */
  displayName: string;
  /** Short description shown under the input in the Edit row. */
  description: string;
  /** Type discriminator — drives input control + server validation + parser. */
  valueType: FormulaValueType;
  /** Optional unit label rendered next to the input. */
  unit?: string;
  /** When valueType='enum', the allowed string values. */
  enumOptions?: readonly string[];
  /** Default value used when DB has no row for this key. Must match `valueType`. */
  defaultValue: string;
  /** Section ID for UI grouping (matches `formula-config-data.ts` section IDs). */
  section: 'platform-tiktok' | 'platform-shopee' | 'aggregated' | 'cost-master' | 'general';
}

/** All registered params. Adding here makes the UI + loader immediately aware. */
export const FORMULA_PARAM_REGISTRY: Record<string, FormulaParamSpec> = {
  tiktok_platform_fee_rate_pct: {
    key: 'tiktok_platform_fee_rate_pct',
    displayName: 'Platform Fee Rate — TikTok',
    description:
      'Per-row platform fee = (GMV − Seller Discount) × this rate. TikTok Shop policy update raised it from 24% to 26% effective 2026-05-09. Add a new version row to schedule a future rate.',
    valueType: 'percentage',
    unit: '%',
    defaultValue: '26',
    section: 'platform-tiktok',
  },
} as const;

export type FormulaParamKey = keyof typeof FORMULA_PARAM_REGISTRY;

/** Map of `{ key: value }` resolved at a specific point in time. */
export interface FormulaConfigSnapshot {
  [key: string]: {
    value: string;
    valueType: FormulaValueType;
    effectiveFrom: string; // ISO timestamp
  };
}

/** Validate a raw string value against the registry spec. Returns parsed value or throws. */
export function validateFormulaValue(spec: FormulaParamSpec, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${spec.key}: value must not be empty`);
  switch (spec.valueType) {
    case 'numeric':
    case 'percentage':
    case 'currency': {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) throw new Error(`${spec.key}: expected numeric, got "${raw}"`);
      if (spec.valueType === 'percentage' && (n < 0 || n > 100)) {
        throw new Error(`${spec.key}: percentage must be 0..100, got ${n}`);
      }
      return String(n);
    }
    case 'date': {
      if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(trimmed)) {
        throw new Error(`${spec.key}: expected ISO date YYYY-MM-DD`);
      }
      return trimmed;
    }
    case 'enum': {
      if (!spec.enumOptions || !spec.enumOptions.includes(trimmed)) {
        throw new Error(
          `${spec.key}: value "${raw}" not in [${spec.enumOptions?.join(', ') ?? ''}]`,
        );
      }
      return trimmed;
    }
  }
}

/** Coerce a stored string into a typed value (number for numeric kinds, string for date/enum). */
export function parseFormulaValue(
  type: FormulaValueType,
  raw: string,
): number | string {
  switch (type) {
    case 'numeric':
    case 'percentage':
    case 'currency': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case 'date':
    case 'enum':
      return raw;
  }
}
