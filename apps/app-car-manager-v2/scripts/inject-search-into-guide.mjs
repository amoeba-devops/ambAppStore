#!/usr/bin/env node
/**
 * inject-search-into-guide.mjs — idempotent injector that adds the search
 * input to all user-guide HTML pages. Run once after editing the search UI;
 * future template changes can re-run this safely (skips already-injected files).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDE_ROOT = resolve(__dirname, '..', 'apps/web/public/docs/user-guide');

const SEARCH_HTML = `        <div class="search">
          <input id="guide-search-input" class="search__input" type="search" placeholder="Tìm trong hướng dẫn… (/)" aria-label="Tìm kiếm">
          <div id="guide-search-results" class="search__results"></div>
        </div>
        `;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'assets') continue;
      out.push(...walk(full));
    } else if (name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

let touched = 0;
let skipped = 0;

for (const file of walk(GUIDE_ROOT)) {
  let html = readFileSync(file, 'utf8');

  // Already injected?
  if (html.includes('guide-search-input')) {
    skipped++;
    continue;
  }

  // Inject search div before the <span class="lang-switch"> inside header__tools.
  const replaced = html.replace(
    /(<div class="header__tools">\s*)(<span class="lang-switch">)/,
    `$1${SEARCH_HTML}$2`,
  );

  if (replaced === html) {
    // No header__tools — probably the global landing or a stripped page. Skip.
    skipped++;
    continue;
  }

  writeFileSync(file, replaced, 'utf8');
  touched++;
  console.log(`  ✓ ${file.replace(GUIDE_ROOT + '\\', '').replace(GUIDE_ROOT + '/', '')}`);
}

console.log(`\nInjected into ${touched} files (${skipped} already had search or no header)`);
