/**
 * Export the formula config catalog plus the user's current local edits.
 * Triggers a browser download — no server roundtrip.
 */

import { FORMULA_SECTIONS } from './formula-config-data';
import { getVersionHistory, getVersionCount } from './formula-version-mock';
import { appendActionLog } from './action-log-mock';
import { downloadCsv } from './csv';

export function exportFormulaConfig(
  format: 'json' | 'csv',
  values: Record<string, string>,
  sources: Record<string, string[]>,
): void {
  if (typeof window === 'undefined') return;

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename =
    format === 'json'
      ? `formula-config-${ts}.json`
      : `formula-config-${ts}.csv`;

  const content = format === 'json' ? buildJson(values, sources) : buildCsv(values, sources);
  if (format === 'csv') {
    downloadCsv(content, filename);
  } else {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const totalMetrics = FORMULA_SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  appendActionLog({
    username: 'dev@amoeba.group',
    userRole: 'ADMIN',
    category: 'EXPORT',
    verb: 'EXPORT',
    targetType: 'formula-config',
    targetLabel: `Formula Config (${format.toUpperCase()})`,
    summary: `Exported ${totalMetrics} metrics across ${FORMULA_SECTIONS.length} sections as ${format.toUpperCase()}`,
    metadata: { format, filename, metrics: totalMetrics },
  });
}

function buildJson(
  values: Record<string, string>,
  sources: Record<string, string[]>,
): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    sections: FORMULA_SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      items: s.items.map((item) => ({
        metric: item.metric,
        description: item.description ?? null,
        dataSources: sources[item.metric] ?? item.dataSources,
        seedFormula: item.formula,
        currentFormula: values[item.metric] ?? item.formula,
        unit: item.unit ?? null,
        versionCount: getVersionCount(item.metric),
        history: getVersionHistory(item.metric),
      })),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

function buildCsv(
  values: Record<string, string>,
  sources: Record<string, string[]>,
): string {
  const header = [
    'section_id',
    'section_title',
    'metric',
    'data_sources',
    'seed_formula',
    'current_formula',
    'unit',
    'version_count',
    'is_dirty',
  ];
  const rows: string[][] = [header];
  for (const section of FORMULA_SECTIONS) {
    for (const item of section.items) {
      const cur = values[item.metric] ?? item.formula;
      rows.push([
        section.id,
        section.title,
        item.metric,
        (sources[item.metric] ?? item.dataSources).join('; '),
        item.formula,
        cur,
        item.unit ?? '',
        String(getVersionCount(item.metric)),
        cur !== item.formula ? 'yes' : 'no',
      ]);
    }
  }
  return rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');
}

function escapeCsv(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
