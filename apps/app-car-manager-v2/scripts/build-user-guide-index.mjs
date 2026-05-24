#!/usr/bin/env node
/**
 * build-user-guide-index.mjs — Scan all user-guide HTML pages and emit a
 * client-side searchable JSON index.
 *
 * Output: apps/web/public/docs/user-guide/assets/search-index.json
 *   [
 *     {
 *       url: "vi/admin/05-quan-ly-chuyen-di.html",
 *       title: "Quản lý chuyến đi (Trips)",
 *       section: "Quản trị viên",
 *       locale: "vi",
 *       headings: ["Tạo chuyến mới", "Gán tài xế + xe", ...],
 *       body: "first ~300 chars of body text for snippet"
 *     }
 *   ]
 *
 * Usage:  node scripts/build-user-guide-index.mjs
 *
 * Why a tiny custom JSON instead of lunr.js: 33 pages, < 50KB total. Client
 * doesn't need stemming or BM25 — substring + token-AND matching is faster
 * to ship and more predictable for Vietnamese (no stemmer breakage).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GUIDE_ROOT = resolve(ROOT, 'apps/web/public/docs/user-guide');
const OUT_FILE = resolve(GUIDE_ROOT, 'assets/search-index.json');

function walkHtml(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'assets') continue; // skip CSS/JS/img tree
      out.push(...walkHtml(full));
    } else if (name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

const SECTION_LABEL = {
  common: 'Phần Chung',
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  driver: 'Tài xế',
};

/** Strip HTML tags + collapse whitespace. */
function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extract(html) {
  // <html lang="vi"> | "ko"
  const localeMatch = html.match(/<html[^>]*\blang="([^"]+)"/i);
  const locale = localeMatch ? localeMatch[1] : 'vi';

  // <title>...</title>
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const titleRaw = titleMatch ? titleMatch[1] : '';
  // Strip " — Amoeba Car Manager v2" boilerplate.
  const title = titleRaw.replace(/\s*[—-]\s*Amoeba.*$/, '').trim();

  // Pick H1 if title is empty.
  let pageTitle = title;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!pageTitle && h1) pageTitle = stripTags(h1[1]);

  // All H2 + H3 headings (anchor-able sections).
  const headings = [];
  const headingRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = headingRe.exec(html))) {
    headings.push(stripTags(m[2]));
  }

  // First ~400 chars of body text (after H1) as snippet.
  const bodyStart = html.search(/<\/h1>/i);
  const bodyHtml = bodyStart >= 0 ? html.slice(bodyStart) : html;
  // Also drop sidebar/footer/header before extracting body.
  const mainOnly = bodyHtml
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');
  const bodyText = stripTags(mainOnly);
  const snippet = bodyText.slice(0, 400);

  return { locale, title: pageTitle, headings, snippet };
}

function sectionFromPath(relPath) {
  // vi/driver/02-today-screen.html → 'driver'
  const parts = relPath.replace(/\\/g, '/').split('/');
  if (parts.length >= 3 && SECTION_LABEL[parts[1]]) return SECTION_LABEL[parts[1]];
  if (parts.length === 2 && parts[1] === 'index.html') return 'Trang chủ';
  if (parts.length === 1 && parts[0] === 'index.html') return 'Trang chủ chung';
  return parts[1] ?? 'Khác';
}

const files = walkHtml(GUIDE_ROOT);
const entries = [];
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const rel = relative(GUIDE_ROOT, file).replace(/\\/g, '/');
  const meta = extract(html);
  if (!meta.title) continue; // landing pages w/o real title — skip
  entries.push({
    url: rel,
    locale: meta.locale,
    section: sectionFromPath(rel),
    title: meta.title,
    headings: meta.headings,
    snippet: meta.snippet,
  });
}

entries.sort((a, b) => a.url.localeCompare(b.url));

writeFileSync(OUT_FILE, JSON.stringify(entries, null, 2), 'utf8');

const byLocale = entries.reduce((acc, e) => {
  acc[e.locale] = (acc[e.locale] ?? 0) + 1;
  return acc;
}, {});
const bytes = Buffer.byteLength(JSON.stringify(entries));

console.log(`✓ Indexed ${entries.length} pages → ${relative(ROOT, OUT_FILE)}`);
console.log(`  Locales: ${JSON.stringify(byLocale)}  ·  Size: ${(bytes / 1024).toFixed(1)} KB`);
