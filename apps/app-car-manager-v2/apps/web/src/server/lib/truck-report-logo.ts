import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Cargo Rush company logo for the Monthly Summary report (REQ-20260713).
 *
 * The artwork is the real brand asset kept as a file — `public/brand/` — not a
 * base64 blob in source. It used to be inlined (a low-res 185×70 extraction
 * from the client's own BaoCao_DoiXe_T5_2026_Report.xlsx); the file is the
 * better home: designers can drop in a new PNG without touching TypeScript,
 * and diffs stay readable. The current file is the brand export trimmed to the
 * artwork's bounding box with the white backdrop turned into alpha — keep both
 * properties when replacing it, or the logo floats inside its own padding.
 *
 * `public/` is the one directory Next.js guarantees on disk at runtime — it
 * serves static files from there, so `next start` always has it next to
 * `process.cwd()` (= apps/web, both under `npm run dev` and Render's
 * `npm start --workspace @car-v2/web`). If this app ever switches to
 * `output: 'standalone'`, remember Next does NOT copy `public/` into the
 * standalone bundle — the deploy step has to.
 *
 * If truck reports ever serve another tenant, swap this for a per-tenant
 * uploaded logo (tenant settings) rather than adding a second constant.
 */
const LOGO_PATH = path.join(process.cwd(), 'public', 'brand', 'cargo-rush-logo.png');

/** Intrinsic pixel size of the asset — the source of the aspect ratio below. */
const INTRINSIC = { width: 234, height: 161 } as const;

/**
 * Height of the logo slot in the report header. The sheet anchors the image at
 * the top of row 2 and the navy title band starts at row 7, which leaves 85px —
 * 72 keeps the same ~13px of air the client template had under its logo. Width
 * follows the artwork's own ratio, because a stretched logo is worse than a
 * small one: replace the PNG with a different shape and this still holds.
 */
const SLOT_HEIGHT = 72;

export const TRUCK_REPORT_LOGO_SIZE = {
  width: Math.round(SLOT_HEIGHT * (INTRINSIC.width / INTRINSIC.height)),
  height: SLOT_HEIGHT,
} as const;

/** Resolved once per process — the file never changes between requests. */
let cached: Promise<Buffer> | null = null;

/** Reads the logo, memoised. Rejects if the asset is missing; callers decide
 *  whether a logo-less report beats no report at all. */
export function loadTruckReportLogo(): Promise<Buffer> {
  /* Don't pin a rejection for the lifetime of the process — a transient read
   * error would otherwise cost every later report its logo. */
  cached ??= readFile(LOGO_PATH).catch((err: unknown) => {
    cached = null;
    throw err;
  });
  return cached;
}
