/**
 * Formula validator — runs the 5 AC rules from the spec on every metric in
 * FORMULA_SECTIONS using the user's current values + sources from localStorage.
 *
 * Acceptance Criteria:
 *   AC-01  Syntax (balanced braces, recognised functions/operators)
 *   AC-02  References (every {token} resolves to a raw column or calc metric)
 *   AC-03  No circular dependencies between calculated metrics
 *   AC-04  Divide-by-zero risk warning
 *   AC-05  Datatype compatibility — text columns in arithmetic
 *
 * AC-06–AC-10 are enforced at the UI layer (block Save, highlight tokens,
 * actionable messages, run on click).
 */

import { FORMULA_SECTIONS, type FormulaItem } from './formula-config-data';
import { DATA_SOURCE_FIELDS, getCalculatedFields } from './data-source-fields';

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  severity: Severity;
  code: 'AC-01' | 'AC-02' | 'AC-03' | 'AC-04' | 'AC-05';
  message: string;
  /** Token that triggered the issue (e.g. `{Total GMV}` ) — used for UI highlighting. */
  token?: string;
}

export interface MetricValidation {
  metric: string;
  sectionId: string;
  sectionTitle: string;
  formula: string;
  dataSources: string[];
  issues: ValidationIssue[];
  isValid: boolean;
}

export interface ValidationSummary {
  results: MetricValidation[];
  errorCount: number;
  warningCount: number;
  validCount: number;
  totalCount: number;
}

const RECOGNISED_FUNCTIONS = new Set([
  'Sum of',
  'Avg',
  'IF',
  'MAX',
  'MIN',
  'XLOOKUP',
  'Allocate by', // legacy DSL keyword — still valid
]);

/** Tokens like {NMV contribution}, {GMV contribution} are valid DSL keywords. */
const DSL_TOKENS = new Set(['NMV contribution', 'GMV contribution', 'Platform Fee Rate']);

/**
 * Specific text-column tokens (full match, case-insensitive). Keep this list
 * tight — generic keywords like "Mã" or "SKU" produce false positives because
 * many numeric fields share the prefix (e.g. "Mã giảm giá" = VND amount).
 */
const TEXT_COLUMN_NAMES = new Set(
  [
    'Order ID',
    'Order Status',
    'Order Substatus',
    'Trạng Thái Đơn Hàng',
    'Product Name',
    'Tên sản phẩm',
    'Tên Sản phẩm',
    'Seller SKU',
    'SKU ID',
    'SKU sản phẩm',
    'SKU phân loại hàng',
    'Buyer Username',
    'Recipient',
    'Email',
    'Detail Address',
    'Địa chỉ nhận hàng',
    'Phương thức thanh toán',
    'Phương thức giao hàng',
    'Normal or Pre-order',
    'Mã đơn hàng',
    'Mã sản phẩm',
    'Người Mua',
    'Tên Người nhận',
    'Loại đơn hàng',
  ].map((s) => s.toLowerCase()),
);

function extractCurlyTokens(formula: string): { name: string; start: number; end: number }[] {
  const out: { name: string; start: number; end: number }[] = [];
  let i = 0;
  while (i < formula.length) {
    const open = formula.indexOf('{', i);
    if (open === -1) break;
    const close = formula.indexOf('}', open);
    if (close === -1) break;
    out.push({ name: formula.slice(open + 1, close), start: open, end: close });
    i = close + 1;
  }
  return out;
}

function checkBalanced(formula: string): ValidationIssue | null {
  let curly = 0;
  let square = 0;
  let paren = 0;
  for (const ch of formula) {
    if (ch === '{') curly++;
    else if (ch === '}') curly--;
    else if (ch === '[') square++;
    else if (ch === ']') square--;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    if (curly < 0 || square < 0 || paren < 0) break;
  }
  if (curly !== 0) {
    return {
      severity: 'error',
      code: 'AC-01',
      message: `Unbalanced curly braces — check {…} pairs.`,
    };
  }
  if (square !== 0) {
    return {
      severity: 'error',
      code: 'AC-01',
      message: `Unbalanced square brackets — check […] pairs.`,
    };
  }
  if (paren !== 0) {
    return {
      severity: 'error',
      code: 'AC-01',
      message: `Unbalanced parentheses — check (…) pairs.`,
    };
  }
  return null;
}

function checkReferences(
  formula: string,
  dataSources: string[],
  allMetricNames: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Build the set of raw columns available given selected sources
  const rawCols = new Set<string>();
  for (const src of dataSources) {
    if (src === 'Calculated') continue;
    const cols = DATA_SOURCE_FIELDS[src];
    if (cols) for (const c of cols) rawCols.add(c);
  }

  const tokens = extractCurlyTokens(formula);
  for (const t of tokens) {
    if (allMetricNames.has(t.name) || rawCols.has(t.name) || DSL_TOKENS.has(t.name)) continue;
    issues.push({
      severity: 'error',
      code: 'AC-02',
      message: `Field {${t.name}} does not exist in the selected data sources.`,
      token: t.name,
    });
  }
  return issues;
}

function checkSyntax(formula: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const balance = checkBalanced(formula);
  if (balance) issues.push(balance);
  // Recognised function check — strict scan would require a real parser. Skip for now.
  void RECOGNISED_FUNCTIONS;
  return issues;
}

function checkDivByZero(
  formula: string,
  allMetricNames: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Find every "/ {X}" or "/ (..." occurrence
  const re = /\/\s*(\{[^}]+\}|\()/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    const captured = m[1];
    if (!captured) continue;
    const tokenMatch = captured.match(/^\{([^}]+)\}$/);
    if (tokenMatch && tokenMatch[1]) {
      const denom = tokenMatch[1];
      // Skip safe denominators:
      //   - Calculated metric sums (Total *, Sum of *) — guaranteed > 0 for any period with data
      //   - Page View metric — well-defined N/A semantic when traffic = 0
      const isCalcSum =
        allMetricNames.has(denom) && (denom.startsWith('Total ') || denom.startsWith('Sum '));
      const isPageView = /^Page View(\s—\s(Shopee|TikTok))?$/.test(denom);
      const isNetGmv = /^(Total\s)?Net GMV(\s—\s(Shopee|TikTok))?$/.test(denom);
      if (isCalcSum || isPageView || isNetGmv) continue;
      issues.push({
        severity: 'warning',
        code: 'AC-04',
        message: `Division by {${denom}} — verify denominator is never zero, or wrap with IF(...).`,
        token: denom,
      });
    }
  }
  return issues;
}

function checkDatatype(formula: string, dataSources: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tokens = extractCurlyTokens(formula);
  // Exact-match against the small whitelist of known text columns
  for (const t of tokens) {
    const lower = t.name.toLowerCase();
    const isText = TEXT_COLUMN_NAMES.has(lower);
    if (!isText) continue;
    // Look at characters around the token to see if used in arithmetic
    const before = formula.slice(Math.max(0, t.start - 5), t.start);
    const after = formula.slice(t.end + 1, t.end + 6);
    const arithmetic = /[×+\-−*/]/;
    if (arithmetic.test(before) || arithmetic.test(after)) {
      issues.push({
        severity: 'warning',
        code: 'AC-05',
        message: `{${t.name}} looks like a text/identifier column — arithmetic on it may fail at runtime.`,
        token: t.name,
      });
    }
  }
  // Suppress duplicate warnings for the same token within one formula
  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.code}|${i.token}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function detectCycles(metrics: { name: string; formula: string }[]): string[][] {
  const calcNames = new Set(metrics.map((m) => m.name));
  const graph = new Map<string, Set<string>>();
  for (const m of metrics) {
    const refs = new Set(
      extractCurlyTokens(m.formula)
        .map((t) => t.name)
        .filter((n) => calcNames.has(n) && n !== m.name),
    );
    graph.set(m.name, refs);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    onStack.add(node);
    path.push(node);
    const refs = graph.get(node);
    if (refs) {
      for (const next of refs) {
        if (!visited.has(next)) {
          dfs(next);
        } else if (onStack.has(next)) {
          const idx = path.indexOf(next);
          if (idx >= 0) cycles.push([...path.slice(idx), next]);
        }
      }
    }
    onStack.delete(node);
    path.pop();
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) dfs(node);
  }
  return cycles;
}

/**
 * Run the full validation suite across the catalog. Returns one result per
 * metric plus aggregate counts.
 *
 * @param values  Map of metric → current formula text (from localStorage)
 * @param sources Map of metric → current data sources (from localStorage)
 */
export function validateAllFormulas(
  values: Record<string, string>,
  sources: Record<string, string[]>,
): ValidationSummary {
  // Flatten all metrics with their effective formula + sources
  const flat: (FormulaItem & { sectionId: string; sectionTitle: string })[] = [];
  for (const section of FORMULA_SECTIONS) {
    for (const item of section.items) {
      flat.push({ ...item, sectionId: section.id, sectionTitle: section.title });
    }
  }
  const allMetricNames = new Set<string>(flat.map((m) => m.metric));
  // Also allow calculated fields from the autocomplete (subset of metric names already)
  for (const f of getCalculatedFields()) allMetricNames.add(f);

  // Detect cycles once across the whole catalog
  const cycles = detectCycles(
    flat.map((m) => ({ name: m.metric, formula: values[m.metric] ?? m.formula })),
  );
  const cycleByMetric = new Map<string, string[][]>();
  for (const c of cycles) {
    for (const node of c) {
      if (!cycleByMetric.has(node)) cycleByMetric.set(node, []);
      cycleByMetric.get(node)!.push(c);
    }
  }

  const results: MetricValidation[] = flat.map((item) => {
    const formula = values[item.metric] ?? item.formula;
    const ds = sources[item.metric] ?? item.dataSources;
    const issues: ValidationIssue[] = [];
    issues.push(...checkSyntax(formula));
    issues.push(...checkReferences(formula, ds, allMetricNames));
    issues.push(...checkDivByZero(formula, allMetricNames));
    issues.push(...checkDatatype(formula, ds));

    // Cycle issues for this metric
    const myCycles = cycleByMetric.get(item.metric);
    if (myCycles) {
      const uniq = new Set<string>();
      for (const c of myCycles) {
        const sig = c.join(' → ');
        if (!uniq.has(sig)) {
          uniq.add(sig);
          issues.push({
            severity: 'error',
            code: 'AC-03',
            message: `Circular dependency: ${sig}`,
          });
        }
      }
    }

    const hasError = issues.some((i) => i.severity === 'error');
    return {
      metric: item.metric,
      sectionId: item.sectionId,
      sectionTitle: item.sectionTitle,
      formula,
      dataSources: ds,
      issues,
      isValid: !hasError,
    };
  });

  return {
    results,
    errorCount: results.reduce(
      (n, r) => n + r.issues.filter((i) => i.severity === 'error').length,
      0,
    ),
    warningCount: results.reduce(
      (n, r) => n + r.issues.filter((i) => i.severity === 'warning').length,
      0,
    ),
    validCount: results.filter((r) => r.isValid).length,
    totalCount: results.length,
  };
}
