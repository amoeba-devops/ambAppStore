#!/usr/bin/env node
/**
 * fix-mobile-brand-nesting.mjs — repair the buggy output of the previous
 * upgrade-mobile-brand.mjs run. That script's regex matched only up to the
 * first </span> (the inner brand-sub close) and pasted the new brand-mobile
 * sibling INSIDE the brand-desktop wrapper. CSS show/hide between siblings
 * relies on them actually being siblings, so the swap never fires.
 *
 * Before (broken):
 *   <span class="brand-desktop">
 *     ...
 *     <span class="brand-sub">· Hướng dẫn</span>
 *     <span class="brand-mobile">Hướng dẫn</span>   ← nested inside desktop
 *   </span>
 *
 * After (fixed):
 *   <span class="brand-desktop">
 *     ...
 *     <span class="brand-sub">· Hướng dẫn</span>
 *   </span>
 *   <span class="brand-mobile">Hướng dẫn</span>     ← now a sibling
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDE_ROOT = resolve(__dirname, '..', 'apps/web/public/docs/user-guide');

// Match: brand-sub closing </span>, then immediately a nested brand-mobile,
// then the outer </span>. Move brand-mobile to AFTER the outer </span>.
const BUGGY = /(<span class="header__brand-sub">[^<]+<\/span>)<span class="header__brand-mobile">([^<]+)<\/span><\/span>/g;

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
  const html = readFileSync(file, 'utf8');
  const fixed = html.replace(BUGGY, (_match, subSpan, mobileLabel) => {
    return `${subSpan}</span><span class="header__brand-mobile">${mobileLabel}</span>`;
  });
  if (fixed === html) { skipped++; continue; }
  writeFileSync(file, fixed, 'utf8');
  touched++;
}
console.log(`✓ Fixed nesting in ${touched} files (${skipped} skipped — already correct or no header)`);
