#!/usr/bin/env node
/**
 * upgrade-lang-switch.mjs — rewrite the simple <a>VI</a><a>KO</a> pills in
 * every user-guide page into structured pills with a flag emoji + language
 * name. CSS handles desktop/mobile show-hide of the .lang-name span.
 *
 * Idempotent — checks for the new structure first and skips already-upgraded
 * pages.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDE_ROOT = resolve(__dirname, '..', 'apps/web/public/docs/user-guide');

const NEW_VI_LABEL = '<span class="lang-flag">🇻🇳</span><span class="lang-name">Tiếng Việt</span><span class="lang-code">VI</span>';
const NEW_KO_LABEL = '<span class="lang-flag">🇰🇷</span><span class="lang-name">한국어</span><span class="lang-code">KO</span>';

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

  if (html.includes('lang-flag')) {
    skipped++;
    continue;
  }

  // Pattern: <a ... data-lang="vi">VI</a> — replace inner with structured spans.
  // Handles class="is-active" optional + various href values.
  let updated = html
    .replace(/(<a [^>]*data-lang="vi"[^>]*>)VI(<\/a>)/g, `$1${NEW_VI_LABEL}$2`)
    .replace(/(<a [^>]*data-lang="ko"[^>]*>)KO(<\/a>)/g, `$1${NEW_KO_LABEL}$2`);

  if (updated === html) {
    skipped++;
    continue;
  }

  writeFileSync(file, updated, 'utf8');
  touched++;
}

console.log(`✓ Upgraded lang-switch in ${touched} files (${skipped} skipped — already upgraded or no match)`);
