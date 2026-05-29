/**
 * Format a combo SKU for compact display: 2 component SKUs per line.
 * Single or 2-component SKUs render as-is on one line.
 *   `A_B`        → "A_B"
 *   `A_B_C_D_E`  → "A_B\n_C_D\n_E"
 *
 * Pair with `whitespace-pre-line` on the rendering element so `\n` becomes
 * a visible line break.
 */
export function formatSkuMultiline(sku: string): string {
  const parts = sku.split('_');
  if (parts.length <= 2) return sku;
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const group = parts.slice(i, i + 2).join('_');
    lines.push(i === 0 ? group : '_' + group);
  }
  return lines.join('\n');
}
