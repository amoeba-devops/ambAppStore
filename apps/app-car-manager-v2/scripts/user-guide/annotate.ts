#!/usr/bin/env tsx
/**
 * annotate.ts — apply YAML-defined annotations (arrows, step numbers, highlight
 * boxes) on top of raw Playwright screenshots, then write the annotated PNG to
 * its final published location.
 *
 * Usage:
 *   tsx annotate.ts <input.png> <output.png> [--spec <input.shot.yml>]
 *
 * If --spec is omitted, looks for `<input>.shot.yml` next to the input PNG.
 * If the spec file doesn't exist, the input is copied to the output unchanged
 * (so shots without annotations still flow through the pipeline).
 *
 * Spec format (YAML):
 *   annotations:
 *     - { type: arrow,  from: [x1, y1], to: [x2, y2], color: '#FF3B30' }
 *     - { type: number, at: [x, y], label: '1', color: '#3182F6' }
 *     - { type: box,    rect: [x, y, w, h], color: '#FF3B30' }
 *     - { type: label,  at: [x, y], text: 'Bấm đây', color: '#FF3B30' }
 */
import { readFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import yaml from 'js-yaml';

type Point = [number, number];
type Rect = [number, number, number, number];

type Annotation =
  | { type: 'arrow'; from: Point; to: Point; color?: string; width?: number }
  | { type: 'number'; at: Point; label: string; color?: string; radius?: number }
  | { type: 'box'; rect: Rect; color?: string; width?: number }
  | { type: 'label'; at: Point; text: string; color?: string; size?: number };

interface ShotSpec {
  annotations?: Annotation[];
  caption?: string;
}

const DEFAULT_RED = '#FF3B30';
const DEFAULT_BLUE = '#3182F6';

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function renderAnnotation(a: Annotation): string {
  switch (a.type) {
    case 'arrow': {
      const color = a.color ?? DEFAULT_RED;
      const w = a.width ?? 4;
      const [x1, y1] = a.from;
      const [x2, y2] = a.to;
      // Compute arrowhead — small triangle at the destination, rotated to the line angle.
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = 16;
      const hx1 = x2 - head * Math.cos(angle - Math.PI / 7);
      const hy1 = y2 - head * Math.sin(angle - Math.PI / 7);
      const hx2 = x2 - head * Math.cos(angle + Math.PI / 7);
      const hy2 = y2 - head * Math.sin(angle + Math.PI / 7);
      return `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
              stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>
        <polygon points="${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}" fill="${color}"/>
      `;
    }
    case 'number': {
      const color = a.color ?? DEFAULT_RED;
      const r = a.radius ?? 16;
      const [cx, cy] = a.at;
      return `
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="${cx}" y="${cy + 6}" font-family="Pretendard, Inter, sans-serif"
              font-size="18" font-weight="700" fill="white" text-anchor="middle">${escapeXml(a.label)}</text>
      `;
    }
    case 'box': {
      const color = a.color ?? DEFAULT_RED;
      const w = a.width ?? 3;
      const [x, y, bw, bh] = a.rect;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}"
                    fill="none" stroke="${color}" stroke-width="${w}" rx="6"/>`;
    }
    case 'label': {
      const color = a.color ?? DEFAULT_RED;
      const size = a.size ?? 16;
      const [x, y] = a.at;
      // Background pill for readability against any UI color.
      const padding = 8;
      const approxWidth = a.text.length * size * 0.6 + padding * 2;
      const height = size + padding * 2;
      return `
        <rect x="${x - padding}" y="${y - size}" width="${approxWidth}" height="${height}"
              fill="${color}" rx="4"/>
        <text x="${x}" y="${y + size * 0.4}" font-family="Pretendard, Inter, sans-serif"
              font-size="${size}" font-weight="600" fill="white">${escapeXml(a.text)}</text>
      `;
    }
  }
}

async function applyAnnotations(inputPng: string, spec: ShotSpec, outputPng: string) {
  const image = sharp(inputPng);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Cannot read dimensions of ${inputPng}`);
  }

  const annotations = spec.annotations ?? [];
  if (annotations.length === 0) {
    await mkdir(dirname(outputPng), { recursive: true });
    await copyFile(inputPng, outputPng);
    return;
  }

  const overlay = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"
     viewBox="0 0 ${meta.width} ${meta.height}">
  ${annotations.map(renderAnnotation).join('\n')}
</svg>`;

  await mkdir(dirname(outputPng), { recursive: true });
  await image
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPng);
}

async function loadSpec(specPath: string): Promise<ShotSpec> {
  try {
    await stat(specPath);
  } catch {
    return {};
  }
  const raw = await readFile(specPath, 'utf8');
  const parsed = yaml.load(raw) as ShotSpec | null;
  return parsed ?? {};
}

async function main() {
  const { values, positionals } = parseArgs({
    options: { spec: { type: 'string' } },
    allowPositionals: true,
  });

  const [input, output] = positionals;
  if (!input || !output) {
    console.error('Usage: tsx annotate.ts <input.png> <output.png> [--spec <input.shot.yml>]');
    process.exit(1);
  }

  const inputAbs = resolve(input);
  const outputAbs = resolve(output);
  const specPath = values.spec ? resolve(values.spec) : inputAbs.replace(/\.png$/, '.shot.yml');

  const spec = await loadSpec(specPath);
  await applyAnnotations(inputAbs, spec, outputAbs);

  console.log(`✓ ${basename(outputAbs)} (${spec.annotations?.length ?? 0} annotation${spec.annotations?.length === 1 ? '' : 's'})`);
}

// Only execute the CLI when the file is invoked directly (via `tsx annotate.ts ...`),
// not when imported by Playwright specs. Without this guard, Playwright's CLI flags
// (--project, --headed, etc.) flow into parseArgs() at import time and crash.
const isEntryPoint = (() => {
  try {
    const argvUrl = pathToFileURL(process.argv[1] ?? '').href;
    return import.meta.url === argvUrl;
  } catch {
    return false;
  }
})();

if (isEntryPoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { applyAnnotations, loadSpec };
export type { ShotSpec, Annotation };
