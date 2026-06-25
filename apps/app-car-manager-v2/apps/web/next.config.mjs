import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import createNextIntlPlugin from 'next-intl/plugin';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* Load the canonical Turborepo-root `.env` (apps/app-car-manager-v2/.env) BEFORE
 * Next.js reads any env var. Necessary because:
 *   - The repo keeps ONE .env at the Turborepo root, not at apps/web/.
 *   - Next.js's auto-loader only scans the Next project root (apps/web/).
 *   - The npm script wraps next dev in `dotenv-cli`, which works for `npm run
 *     dev` but NOT for ad-hoc invocations (`next build` from apps/web, IDE
 *     "run Next" actions, Render's buildCommand, etc.).
 *   - NEXT_PUBLIC_* values referenced server-side from Server Components are
 *     read here; if the env file isn't loaded, `process.env.NEXT_PUBLIC_X` is
 *     undefined at render time and the value never reaches the RSC payload.
 *
 * `override: false` lets explicit shell exports (CI/Render) win over the file. */
loadDotenv({ path: resolve(__dirname, '../../.env'), override: false });

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const amaOrigin = process.env.NEXT_PUBLIC_AMA_ORIGIN ?? 'https://*.amoeba.site';

const basePath = process.env.BASE_PATH || undefined;

/* Mirror BASE_PATH onto a NEXT_PUBLIC_ prefix so the client bundle can read it
 * at runtime (Service Worker registration path, manifest links built in JS).
 * BASE_PATH itself is server-only by Next convention. */
process.env.NEXT_PUBLIC_BASE_PATH = basePath ?? '';

/* Explicit inline of every NEXT_PUBLIC_* we depend on. Next.js's webpack
 * DefinePlugin already auto-inlines NEXT_PUBLIC_* it sees, but it scans for
 * `.env*` files at the Next project root (apps/web/) — our canonical .env
 * lives one dir up, so without this block the DefinePlugin wouldn't know
 * to ship these. Routing the read through `process.env` (already populated
 * by the dotenv preamble above) makes the substitution deterministic.
 *
 * Add new NEXT_PUBLIC_* keys here when introducing them. */
const publicEnv = {
  NEXT_PUBLIC_APP_CODE: process.env.NEXT_PUBLIC_APP_CODE ?? 'car-manager-v2',
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'vi',
  NEXT_PUBLIC_AMA_ORIGIN: process.env.NEXT_PUBLIC_AMA_ORIGIN ?? '',
  NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ?? '',
  NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC: process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC ?? '',
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  env: publicEnv,
  transpilePackages: ['@car-v2/db', '@car-v2/shared', '@car-v2/ui'],
  outputFileTracingRoot: __dirname,
  /* pdfmake must run as a native Node module (not bundled by webpack) because
   * it relies on its own virtual font system and binary handling. Without this,
   * the bundled version may hang or produce errors. */
  serverExternalPackages: ['pdfmake'],
  /* Per-page bundles only pull the symbols they actually use from these
   * barrel packages instead of the whole module graph. Biggest win is
   * `@car-v2/ui`, whose barrel re-exports recharts (~280KB) via the chart
   * components — without this, any page importing `@car-v2/ui` risks pulling
   * recharts into its shared chunk even when it only needs a Button. Also
   * trims lucide-react (icon-per-file) and date-fns to the used members. */
  experimental: {
    optimizePackageImports: ['lucide-react', '@car-v2/ui', 'date-fns'],
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors 'self' ${amaOrigin};`,
          },
        ],
      },
      {
        /* SW must NOT be cached by intermediaries — otherwise users get
         * stuck on a buggy version until the cache expires. */
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          /* Allow the SW to claim the full origin scope (default is the
           * directory of sw.js, which is fine here, but explicit is clearer
           * if we ever move it). */
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
