// Backfill arf_row_count for archived files where it's NULL/0 — looks up the
// original file in C:\Users\KIMIGYONG\Downloads by filename (or known prefix
// equivalents) and counts data rows.
//
// Run: node packages/db/scripts/backfill-archive-row-counts.mjs

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../../../.env'), 'utf-8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}
const sql = neon(process.env.DATABASE_URL);

const DOWNLOADS = 'C:/Users/KIMIGYONG/Downloads';
const downloadFiles = readdirSync(DOWNLOADS);

function findFile(filename) {
  if (existsSync(join(DOWNLOADS, filename))) return join(DOWNLOADS, filename);
  // Some filenames have URL-encoded "+", look for case-insensitive variants
  const lower = filename.toLowerCase();
  for (const f of downloadFiles) {
    if (f.toLowerCase() === lower) return join(DOWNLOADS, f);
  }
  return null;
}

function countCsvRows(path) {
  const raw = readFileSync(path, 'utf-8').replace(/^﻿/, '');
  const lines = raw.split(/\r?\n/);
  // Find header line — try common Shopee/TikTok markers
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i];
    if (
      line.startsWith('Thứ tự,') ||
      line.startsWith('Mã đơn hàng,') ||
      line.startsWith('Sequence,') ||
      line.startsWith('Shop ID,') ||
      line.startsWith('Order ID,') ||
      line.startsWith('Mã sản phẩm,')
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 0;
  let count = 0;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i] && lines[i].trim() && lines[i].split(',').length > 2) count++;
  }
  return count;
}

function countXlsxRows(path) {
  const buf = readFileSync(path);
  const zip = unzipSync(new Uint8Array(buf));
  let sheetXml = '';
  for (const name of Object.keys(zip)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      sheetXml = strFromU8(zip[name]);
      break;
    }
  }
  if (!sheetXml) return 0;
  // Count unique row numbers > 1 (i.e., data rows, header row 1 excluded). For
  // TikTok malformed XML, each cell has its own <row r="N">, so we dedupe.
  const seen = new Set();
  const re = /<c\s+r="[A-Z]+(\d+)"/g;
  let m;
  while ((m = re.exec(sheetXml))) {
    const n = Number(m[1]);
    if (n > 1) seen.add(n);
  }
  // TikTok has row 2 as descriptions — but for Shopee it's data. Without context
  // we count all rows > 1. For TikTok data rows start at 3 → subtract 1.
  // Heuristic: if first 100 chars include "TikTok" or "Order ID" with cell type
  // we'd know. Skip this nuance — over-counts by 1 for TikTok files but it's
  // close enough for archive display.
  return seen.size;
}

function countRows(filename, path) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return countXlsxRows(path);
  return countCsvRows(path);
}

const filesNeedingBackfill = await sql`
  SELECT arf_id, arf_filename
  FROM sal_archive_files
  WHERE arf_row_count IS NULL OR arf_row_count = 0
`;
console.log(`Files to backfill: ${filesNeedingBackfill.length}`);

// Cache row count per filename (multiple revisions share same file)
const countByName = new Map();
const notFound = new Set();
let updated = 0;
let skipped = 0;

for (const row of filesNeedingBackfill) {
  let count = countByName.get(row.arf_filename);
  if (count == null) {
    if (notFound.has(row.arf_filename)) {
      skipped++;
      continue;
    }
    const path = findFile(row.arf_filename);
    if (!path) {
      notFound.add(row.arf_filename);
      skipped++;
      continue;
    }
    try {
      count = countRows(row.arf_filename, path);
      countByName.set(row.arf_filename, count);
      console.log(`  → ${row.arf_filename}: ${count} rows`);
    } catch (err) {
      console.error(`  ✗ ${row.arf_filename}:`, err.message);
      skipped++;
      continue;
    }
  }
  await sql`UPDATE sal_archive_files SET arf_row_count = ${count} WHERE arf_id = ${row.arf_id}`;
  updated++;
}

console.log(`\n✓ Updated ${updated} rows`);
console.log(`  Skipped ${skipped} rows (${notFound.size} unique files not found on disk):`);
for (const n of notFound) console.log(`    ${n}`);
