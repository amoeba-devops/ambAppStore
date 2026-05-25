#!/usr/bin/env node
/**
 * replace-flag-ko.mjs — upgrade the Korean flag SVG with a properly-drawn
 * Taegukgi (4 trigrams + correctly oriented taeguk). The earlier script
 * shipped a placeholder (taeguk only, simplified S-curve, no trigrams)
 * which read as a generic yin-yang rather than the Korean flag.
 *
 * Identifies the old KO flag by its unique signature (svg viewBox 0 0 30 20
 * containing the simplified circle+path taeguk) and replaces with the new
 * 150×100 taegukgi SVG that has the canonical taeguk + 4 trigrams.
 *
 * Idempotent — skips files that already have the new signature (viewBox
 * "0 0 150 100").
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDE_ROOT = resolve(__dirname, '..', 'apps/web/public/docs/user-guide');

const NEW_FLAG_KO = `<span class="lang-flag" aria-hidden="true"><svg viewBox="0 0 150 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="150" height="100" fill="#fff"/><g transform="translate(75,50) rotate(-56.31)"><circle r="25" fill="#C60C30"/><path d="M0,-25 A25,25 0 0,1 0,25 A12.5,12.5 0 0,1 0,0 A12.5,12.5 0 0,0 0,-25 Z" fill="#003478"/></g><g fill="#000"><g transform="translate(37.5,25) rotate(-56.31)"><rect x="-12" y="-9" width="24" height="3"/><rect x="-12" y="-1.5" width="24" height="3"/><rect x="-12" y="6" width="24" height="3"/></g><g transform="translate(112.5,25) rotate(56.31)"><rect x="-12" y="-9" width="10" height="3"/><rect x="2" y="-9" width="10" height="3"/><rect x="-12" y="-1.5" width="24" height="3"/><rect x="-12" y="6" width="10" height="3"/><rect x="2" y="6" width="10" height="3"/></g><g transform="translate(37.5,75) rotate(56.31)"><rect x="-12" y="-9" width="24" height="3"/><rect x="-12" y="-1.5" width="10" height="3"/><rect x="2" y="-1.5" width="10" height="3"/><rect x="-12" y="6" width="24" height="3"/></g><g transform="translate(112.5,75) rotate(-56.31)"><rect x="-12" y="-9" width="10" height="3"/><rect x="2" y="-9" width="10" height="3"/><rect x="-12" y="-1.5" width="10" height="3"/><rect x="2" y="-1.5" width="10" height="3"/><rect x="-12" y="6" width="10" height="3"/><rect x="2" y="6" width="10" height="3"/></g></g></svg></span>`;

// The OLD KO flag span — matches the simplified placeholder shipped in the
// previous commit. Whole-string match on the exact emitted markup.
const OLD_FLAG_KO_RE = /<span class="lang-flag" aria-hidden="true"><svg viewBox="0 0 30 20" xmlns="http:\/\/www\.w3\.org\/2000\/svg"><rect width="30" height="20" fill="#fff"\/><circle cx="15" cy="10" r="5" fill="#fff"\/><path d="M15,5 a5,5 0 0,1 0,10 a2\.5,2\.5 0 0,0 0,-5 a2\.5,2\.5 0 0,1 0,-5" fill="#003478"\/><path d="M15,5 a5,5 0 0,0 0,10 a2\.5,2\.5 0 0,1 0,-5 a2\.5,2\.5 0 0,0 0,-5" fill="#C60C30"\/><\/svg><\/span>/g;

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
  if (html.includes('viewBox="0 0 150 100"')) {
    skipped++;
    continue;
  }
  if (!OLD_FLAG_KO_RE.test(html)) {
    skipped++;
    continue;
  }
  html = html.replace(OLD_FLAG_KO_RE, NEW_FLAG_KO);
  writeFileSync(file, html, 'utf8');
  touched++;
}
console.log(`✓ Upgraded Korean flag SVG (with trigrams) in ${touched} files (${skipped} skipped)`);
