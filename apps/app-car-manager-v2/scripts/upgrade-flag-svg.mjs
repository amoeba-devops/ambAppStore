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

/* Korean flag (Taegukgi) — properly drawn:
 *   • 3:2 ratio canvas (here 150x100 internal coords, rendered to 22x14px)
 *   • White background
 *   • Taeguk circle at center, radius 1/4 of flag width, rotated -56.31°
 *     so the dividing axis matches the official 1:2 slope spec
 *   • Red top (양 yang), Blue bottom (음 yin) divided by S-curve (two small
 *     half-circles of radius = taeguk/2 forming the yin-yang shape)
 *   • Four trigrams (괘) at the corners, oriented along the diagonal:
 *       Top-left  건 (Heaven, ☰) — 3 solid bars
 *       Top-right 감 (Water,  ☵) — broken-solid-broken
 *       Bot-left  리 (Fire,   ☲) — solid-broken-solid
 *       Bot-right 곤 (Earth,  ☷) — 3 broken bars
 */
const FLAG_KO = `<span class="lang-flag" aria-hidden="true"><svg viewBox="0 0 150 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="150" height="100" fill="#fff"/><g transform="translate(75,50) rotate(-56.31)"><circle r="25" fill="#C60C30"/><path d="M0,-25 A25,25 0 0,1 0,25 A12.5,12.5 0 0,1 0,0 A12.5,12.5 0 0,0 0,-25 Z" fill="#003478"/></g><g fill="#000"><g transform="translate(37.5,25) rotate(-56.31)"><rect x="-12" y="-9" width="24" height="3"/><rect x="-12" y="-1.5" width="24" height="3"/><rect x="-12" y="6" width="24" height="3"/></g><g transform="translate(112.5,25) rotate(56.31)"><rect x="-12" y="-9" width="10" height="3"/><rect x="2" y="-9" width="10" height="3"/><rect x="-12" y="-1.5" width="24" height="3"/><rect x="-12" y="6" width="10" height="3"/><rect x="2" y="6" width="10" height="3"/></g><g transform="translate(37.5,75) rotate(56.31)"><rect x="-12" y="-9" width="24" height="3"/><rect x="-12" y="-1.5" width="10" height="3"/><rect x="2" y="-1.5" width="10" height="3"/><rect x="-12" y="6" width="24" height="3"/></g><g transform="translate(112.5,75) rotate(-56.31)"><rect x="-12" y="-9" width="10" height="3"/><rect x="2" y="-9" width="10" height="3"/><rect x="-12" y="-1.5" width="10" height="3"/><rect x="2" y="-1.5" width="10" height="3"/><rect x="-12" y="6" width="10" height="3"/><rect x="2" y="6" width="10" height="3"/></g></g></svg></span>`;

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
