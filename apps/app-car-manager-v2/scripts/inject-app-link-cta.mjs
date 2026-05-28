#!/usr/bin/env node
/**
 * Inject the "Open in app →" CTA + load assets/js/app-link.js into every guide
 * page that documents an app route. Idempotent — re-runs are safe (skips a
 * file if the CTA marker already exists).
 *
 * Usage: node scripts/inject-app-link-cta.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDE_ROOT = resolve(__dirname, '..', 'apps', 'web', 'public', 'docs', 'user-guide');

/* Page → app route map. Pages NOT in this map (overviews, glossary, PWA
 * setup, etc.) are intentionally skipped — they don't document a single
 * app endpoint, so a CTA would be misleading. Same map mirrors VI + KO. */
const PAGE_TO_ROUTE = {
  // Admin
  'admin/01-dashboard.html': '/dashboard',
  'admin/02-quan-ly-xe.html': '/vehicles',
  'admin/03-quan-ly-tai-xe.html': '/drivers',
  'admin/04-quan-ly-nguoi-dung.html': '/users',
  'admin/05-quan-ly-chuyen-di.html': '/trips',
  'admin/06-quan-ly-chi-phi.html': '/costs',
  'admin/07-canh-bao-bao-duong.html': '/vehicles',
  'admin/08-bao-cao.html': '/reports',
  'admin/09-cau-hinh-he-thong.html': '/settings',
  'admin/10-audit-log.html': '/audit',
  // Manager
  'manager/01-dashboard.html': '/dashboard',
  'manager/02-dat-xe.html': '/trips/new',
  'manager/03-theo-doi-chuyen-di.html': '/trips',
  'manager/04-ghi-chi-phi.html': '/expenses/new',
  'manager/05-so-chi-phi.html': '/costs',
  'manager/06-bao-cao-ca-nhan.html': '/reports',
  // Driver
  'driver/02-today-screen.html': '/today',
  'driver/03-xac-nhan-chuyen.html': '/today',
  'driver/04-bat-dau-ket-thuc-chuyen.html': '/today',
  'driver/05-ghi-chi-phi.html': '/expenses/new',
  'driver/06-canh-bao-bao-duong.html': '/inbox',
  // Common (cross-role)
  'common/03-ngon-ngu.html': '/settings/me',
  'common/04-thong-bao.html': '/inbox',
};

const LOCALES = ['vi', 'ko'];

const LABEL = {
  vi: 'Mở trang trong app',
  ko: '앱에서 이 페이지 열기',
};

const MARKER = '<!-- APP_LINK_CTA -->';

function buildCta(route, locale) {
  const label = LABEL[locale] ?? LABEL.vi;
  return [
    MARKER,
    `<p class="app-link-cta-row">`,
    `  <a class="app-link-cta" href="${route}" target="_top" rel="noopener">`,
    `    <span>${label}</span>`,
    `    <span class="app-link-cta__route">${route}</span>`,
    `    <span aria-hidden="true">→</span>`,
    `  </a>`,
    `</p>`,
  ].join('\n        ');
}

const SCRIPT_TAG_LINE = '  <script src="../../assets/js/app-link.js"></script>';
const SCRIPT_MARKER = 'assets/js/app-link.js';

async function processOne(locale, page) {
  const route = PAGE_TO_ROUTE[page];
  const fullPath = resolve(GUIDE_ROOT, locale, page);
  let html;
  try {
    html = await readFile(fullPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.warn(`[skip-missing] ${locale}/${page}`);
      return { skipped: true };
    }
    throw err;
  }

  let changed = false;

  /* 1. Insert script tag once. Place it next to the other sibling scripts
   *    so the runtime order is unchanged for other handlers. */
  if (!html.includes(SCRIPT_MARKER)) {
    const anchor = '<script src="../../assets/js/search.js"></script>';
    if (html.includes(anchor)) {
      html = html.replace(anchor, `${anchor}\n${SCRIPT_TAG_LINE}`);
      changed = true;
    } else {
      console.warn(`[no-search-script-anchor] ${locale}/${page} — falling back to </body> insertion`);
      html = html.replace('</body>', `${SCRIPT_TAG_LINE}\n</body>`);
      changed = true;
    }
  }

  /* 2. Insert CTA <p> right AFTER the <h1>...</h1> line. Skip if marker
   *    already present (idempotent rerun). */
  if (!html.includes(MARKER)) {
    /* The closing </h1> always sits on a single line in these files. We anchor
     * on the first occurrence — every page has exactly one <h1>. */
    const h1Match = html.match(/<h1[^>]*>[^<]*<\/h1>/);
    if (!h1Match) {
      console.warn(`[no-h1] ${locale}/${page}`);
      return { changed, error: 'no h1' };
    }
    const insertAfter = h1Match[0];
    const insertion = `${insertAfter}\n        ${buildCta(route, locale)}`;
    html = html.replace(insertAfter, insertion);
    changed = true;
  }

  if (changed) {
    await writeFile(fullPath, html, 'utf8');
    return { changed };
  }
  return { skipped: true };
}

async function main() {
  let total = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const locale of LOCALES) {
    for (const page of Object.keys(PAGE_TO_ROUTE)) {
      total++;
      try {
        const res = await processOne(locale, page);
        if (res.changed) {
          updated++;
          console.log(`[ok] ${locale}/${page} → ${PAGE_TO_ROUTE[page]}`);
        } else {
          skipped++;
        }
      } catch (err) {
        errors.push({ locale, page, err: err && err.message ? err.message : String(err) });
      }
    }
  }

  console.log('---');
  console.log(`Total: ${total} · Updated: ${updated} · Skipped (already done): ${skipped} · Errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`  FAIL ${e.locale}/${e.page}: ${e.err}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('script failed:', err);
  process.exit(1);
});
