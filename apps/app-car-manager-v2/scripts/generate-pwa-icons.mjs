#!/usr/bin/env node
/**
 * Generate placeholder PWA icons (4 PNGs) using `sharp`.
 *
 * Run once (or whenever brand changes):
 *   npx --yes --package=sharp@latest -- node scripts/generate-pwa-icons.mjs
 *
 * Output:
 *   apps/web/public/icons/icon-192.png             (192x192, any)
 *   apps/web/public/icons/icon-512.png             (512x512, any)
 *   apps/web/public/icons/icon-maskable-512.png    (512x512, maskable — safe zone center 80%)
 *   apps/web/public/icons/apple-touch-icon-180.png (180x180, iOS home screen)
 *
 * Design:
 *   - Background: Toss blue (#3182f6)
 *   - Foreground: white letter "F" centered, Pretendard-ish weight
 *   - Maskable: same letter shrunk to ~60% of canvas so it survives Android
 *     adaptive-icon masks (safe zone = inner 80% per W3C spec)
 *
 * This is a TEMPORARY brand — swap PNGs when the designer provides a logo.
 * The SVG strings here are inline so this script has no other dependencies.
 */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../apps/web/public/icons');

await mkdir(outDir, { recursive: true });

const BG = '#3182f6';
const FG = '#ffffff';

/** Build an SVG canvas with a centered "F" glyph occupying `scale` of the box. */
function svg(size, scale) {
  const fontSize = Math.round(size * scale);
  /* Adjust the visual centre — letters render with a baseline, so nudge up a
   * touch using `dominant-baseline=central` + a small y offset proportional
   * to font size. */
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="100%" height="100%" fill="${BG}"/>
    <text
      x="50%" y="50%"
      dy="0.04em"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
      font-weight="800"
      font-size="${fontSize}"
      fill="${FG}">F</text>
  </svg>`;
}

const targets = [
  { name: 'icon-192.png', size: 192, scale: 0.72 },
  { name: 'icon-512.png', size: 512, scale: 0.72 },
  /* Maskable: foreground occupies the inner ~60% so the adaptive-icon mask
   * (which can crop up to 10% on each edge) never clips the glyph. */
  { name: 'icon-maskable-512.png', size: 512, scale: 0.50 },
  { name: 'apple-touch-icon-180.png', size: 180, scale: 0.72 },
];

for (const t of targets) {
  const buffer = Buffer.from(svg(t.size, t.scale));
  await sharp(buffer)
    .png({ compressionLevel: 9, palette: false })
    .toFile(resolve(outDir, t.name));
  // eslint-disable-next-line no-console
  console.log(`✓ ${t.name}`);
}

// eslint-disable-next-line no-console
console.log(`\nWrote 4 icons to ${outDir}`);
