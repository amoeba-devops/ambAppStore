// One-off migration: shift monthIdx values stored under the old 1-indexed
// convention down to the project-wide 0-indexed convention (Jan=0..Dec=11).
//
// Background: `generateMonthsForYear` used to set `monthIdx: i + 1`, which
// stored 4 for April. But every consumer (`archive-files.service.monthLabel`,
// `MonthlyReportClient.realLabels`, JS Date) treats monthIdx as 0-indexed,
// so a stored value of 4 was read back as "May". Fixing the generator alone
// would orphan existing monthly snapshots and archive files. This script
// rewrites psp_month_idx / arf_month_idx so April actually means April.
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../../../.env'), 'utf-8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const sql = neon(process.env.DATABASE_URL);

console.log('=== Before ===');
const beforeSnap = await sql`
  SELECT psp_month_idx, psp_year, COUNT(*)::int AS n
  FROM sal_period_snapshots
  WHERE psp_granularity = 'MONTHLY'
  GROUP BY psp_month_idx, psp_year
  ORDER BY psp_year, psp_month_idx
`;
console.log('sal_period_snapshots (monthly):', beforeSnap);

const beforeArc = await sql`
  SELECT arf_month_idx, arf_year, COUNT(*)::int AS n
  FROM sal_archive_files
  WHERE arf_granularity = 'MONTHLY'
  GROUP BY arf_month_idx, arf_year
  ORDER BY arf_year, arf_month_idx
`;
console.log('sal_archive_files (monthly):', beforeArc);

console.log('\n=== Shifting monthIdx down by 1 ... ===');
const snapRes = await sql`
  UPDATE sal_period_snapshots
  SET psp_month_idx = psp_month_idx - 1
  WHERE psp_granularity = 'MONTHLY' AND psp_month_idx IS NOT NULL AND psp_month_idx > 0
`;
console.log('Updated sal_period_snapshots:', snapRes);

const arcRes = await sql`
  UPDATE sal_archive_files
  SET arf_month_idx = arf_month_idx - 1
  WHERE arf_granularity = 'MONTHLY' AND arf_month_idx IS NOT NULL AND arf_month_idx > 0
`;
console.log('Updated sal_archive_files:', arcRes);

console.log('\n=== After ===');
const afterSnap = await sql`
  SELECT psp_month_idx, psp_year, COUNT(*)::int AS n
  FROM sal_period_snapshots
  WHERE psp_granularity = 'MONTHLY'
  GROUP BY psp_month_idx, psp_year
  ORDER BY psp_year, psp_month_idx
`;
console.log('sal_period_snapshots (monthly):', afterSnap);

const afterArc = await sql`
  SELECT arf_month_idx, arf_year, COUNT(*)::int AS n
  FROM sal_archive_files
  WHERE arf_granularity = 'MONTHLY'
  GROUP BY arf_month_idx, arf_year
  ORDER BY arf_year, arf_month_idx
`;
console.log('sal_archive_files (monthly):', afterArc);

console.log('\n✓ Done. Monthly periods are now 0-indexed (Jan=0..Dec=11).');
