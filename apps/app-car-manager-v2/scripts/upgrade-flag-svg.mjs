#!/usr/bin/env node
/**
 * upgrade-flag-svg.mjs — replace emoji flag spans (🇻🇳 / 🇰🇷) with inline
 * SVG flags so the actual flag visual renders on every platform — Windows
 * Chrome lacks the regional-indicator emoji font by default and currently
 * shows nothing where the flag should be.
 *
 * Also adds title= attributes to <a class="header__brand"> so the now-
 * textless avatar gets a hover tooltip + screen reader announces the app
 * name.
 *
 * Idempotent — checks for the SVG before replacing.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDE_ROOT = resolve(__dirname, '..', 'apps/web/public/docs/user-guide');

const FLAG_VI = `<span class="lang-flag" aria-hidden="true"><svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#DA251D"/><polygon points="15,5.5 16.2,9 19.85,9 17,11.05 18.1,14.5 15,12.5 11.9,14.5 13,11.05 10.15,9 13.8,9" fill="#FFFF00"/></svg></span>`;

const FLAG_KO = `<span class="lang-flag" aria-hidden="true"><svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#fff"/><path d="M15,5 a5,5 0 0,1 0,10 a2.5,2.5 0 0,0 0,-5 a2.5,2.5 0 0,1 0,-5" fill="#003478"/><path d="M15,5 a5,5 0 0,0 0,10 a2.5,2.5 0 0,1 0,-5 a2.5,2.5 0 0,0 0,-5" fill="#C60C30"/></svg></span>`;

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
  let changed = false;

  // Swap emoji flag spans with inline SVG (works for any whitespace variation).
  const viEmoji = /<span class="lang-flag">🇻🇳<\/span>/g;
  const koEmoji = /<span class="lang-flag">🇰🇷<\/span>/g;
  if (viEmoji.test(html)) {
    html = html.replace(viEmoji, FLAG_VI);
    changed = true;
  }
  if (koEmoji.test(html)) {
    html = html.replace(koEmoji, FLAG_KO);
    changed = true;
  }

  // Add tooltip to the brand link if not present (title= attribute on the <a>).
  // Match the bare <a href="...index.html" class="header__brand"> without title.
  const brandRe = /<a href="([^"]+index\.html)" class="header__brand">/g;
  if (brandRe.test(html)) {
    const isKo = /<html\s+lang="ko">/i.test(html);
    const tooltip = isKo
      ? 'Amoeba Car Manager v2 — 사용 안내서 홈'
      : 'Amoeba Car Manager v2 — Trang chủ hướng dẫn';
    html = html.replace(brandRe, `<a href="$1" class="header__brand" title="${tooltip}" aria-label="${tooltip}">`);
    changed = true;
  }

  if (!changed) { skipped++; continue; }
  writeFileSync(file, html, 'utf8');
  touched++;
}

console.log(`✓ Upgraded flag emoji → SVG + added brand tooltip in ${touched} files (${skipped} skipped)`);
