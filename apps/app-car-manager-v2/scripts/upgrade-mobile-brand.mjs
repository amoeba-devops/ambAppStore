#!/usr/bin/env node
/**
 * upgrade-mobile-brand.mjs — wrap each page's header brand text in a
 * .header__brand-desktop span and inject a short .header__brand-mobile
 * sibling so the full product name "Amoeba Car Manager v2 · Hướng dẫn"
 * collapses to just "Hướng dẫn" / "사용 안내서" on phones where the long
 * label dominates the bar.
 *
 * Idempotent — pages that already contain header__brand-mobile are skipped.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDE_ROOT = resolve(__dirname, '..', 'apps/web/public/docs/user-guide');

// The brand label currently looks like:
//   <span>Amoeba Car Manager v2 <span class="header__brand-sub">· Hướng dẫn</span></span>
// We rewrite it to:
//   <span class="header__brand-desktop">Amoeba Car Manager v2 <span class="header__brand-sub">· Hướng dẫn</span></span>
//   <span class="header__brand-mobile">Hướng dẫn</span>
// CSS handles the show/hide swap at the mobile breakpoint.

function transform(html, mobileLabel) {
  // Match the outer <span> containing the brand text (right after .header__brand-mark).
  // Pattern: <span class="header__brand-mark">A</span>\n        <span>... (entire span)
  const re = /(<span class="header__brand-mark">[^<]*<\/span>\s*)<span>([\s\S]*?)<\/span>/;
  const match = html.match(re);
  if (!match) return null;
  const inner = match[2]; // "Amoeba Car Manager v2 <span class=\"header__brand-sub\">· Hướng dẫn</span>"
  const replacement =
    `${match[1]}<span class="header__brand-desktop">${inner}</span>` +
    `<span class="header__brand-mobile">${mobileLabel}</span>`;
  return html.replace(re, replacement);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (name === 'assets') continue;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

let touched = 0;
let skipped = 0;

for (const file of walk(GUIDE_ROOT)) {
  let html = readFileSync(file, 'utf8');
  if (html.includes('header__brand-mobile')) {
    skipped++;
    continue;
  }
  // Pick label based on document language.
  const isKo = /<html\s+lang="ko">/i.test(html);
  const mobileLabel = isKo ? '사용 안내서' : 'Hướng dẫn';
  const updated = transform(html, mobileLabel);
  if (!updated) {
    skipped++;
    continue;
  }
  writeFileSync(file, updated, 'utf8');
  touched++;
}

console.log(`✓ Added mobile brand label to ${touched} files (${skipped} skipped — no header brand block or already done)`);
