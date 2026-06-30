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
  // --- Phase 1: TikTok Platform Fee Rate ---
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

  // --- Phase 2: numeric constants documented in Formula Config but not yet
  //     consumed by calculator. Editable in UI now so Admin can pre-stage
  //     values; calculator wiring follows in a later sub-task once business
  //     confirms how each affects CM. ---
  hq_margin_pct: {
    key: 'hq_margin_pct',
    displayName: 'HQ Margin %',
    description:
      'Headquarters margin percentage applied to Net GMV. Currently documentation-only — calculator integration deferred pending business confirmation.',
    valueType: 'percentage',
    unit: '%',
    defaultValue: '5',
    section: 'aggregated',
  },
  vat_rate_pct: {
    key: 'vat_rate_pct',
    displayName: 'VAT Rate',
    description:
      'Value-added tax rate. Currently documentation-only — calculator integration deferred.',
    valueType: 'percentage',
    unit: '%',
    defaultValue: '10',
    section: 'aggregated',
  },
  fulfillment_fee_vnd: {
    key: 'fulfillment_fee_vnd',
    displayName: 'Fulfillment Fee (per unit)',
    description:
      'Per-unit fulfillment fee in VND. Currently documentation-only — calculator integration deferred.',
    valueType: 'currency',
    unit: 'VND',
    defaultValue: '14000',
    section: 'aggregated',
  },

  // --- Phase 2: categorical/enum settings. Currently hardcoded in parsers /
  //     calculators; UI exposure lets Admin see the active config + plan
  //     future changes. Code-side wiring deferred — flipping these here
  //     today does NOT change behavior (display-only). ---
  excluded_order_statuses: {
    key: 'excluded_order_statuses',
    displayName: 'Excluded Order Statuses',
    description:
      'Comma-separated order statuses excluded from sales aggregations. Currently hardcoded; UI exposure is read-the-current-config only.',
    valueType: 'enum',
    enumOptions: [
      'CANCELLED, RETURNED, REFUNDED',
      'CANCELLED, RETURNED',
      'CANCELLED only',
    ],
    defaultValue: 'CANCELLED, RETURNED, REFUNDED',
    section: 'general',
  },
  free_gift_detection_prefix: {
    key: 'free_gift_detection_prefix',
    displayName: 'Free Gift Detection Prefix',
    description:
      'String prefix on product name that flags a row as a Free Gift (revenue excluded, prime cost counted in Total Free Gift). Currently hardcoded as "[GIFT]".',
    valueType: 'enum',
    enumOptions: ['[GIFT]', '[FREE]', '[KM]'],
    defaultValue: '[GIFT]',
    section: 'general',
  },
  affiliate_booking_split_basis: {
    key: 'affiliate_booking_split_basis',
    displayName: 'Affiliate Booking Fee Split Basis',
    description:
      'How the cross-platform Affiliate Booking Fee (manual input) is split between Shopee and TikTok. "GMV" = proportional to each platform\'s total GMV.',
    valueType: 'enum',
    enumOptions: ['GMV', 'NMV', 'Net GMV', 'Equal split'],
    defaultValue: 'GMV',
    section: 'aggregated',
  },
  week_definition: {
    key: 'week_definition',
    displayName: 'Week Definition',
    description:
      'Calendar boundary for weekly reports. "Friday → Thursday" matches the FIRGI client spec. Changing this would invalidate all historical weekly reports — handle with care.',
    valueType: 'enum',
    enumOptions: ['Friday → Thursday', 'Monday → Sunday', 'Sunday → Saturday'],
    defaultValue: 'Friday → Thursday',
    section: 'general',
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
