import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

// `.mjs` (not `.ts`) on purpose: `next start` loads next.config at runtime, and
// the Docker runner stage runs `npm prune --omit=dev` which strips typescript —
// a `.ts` config then fails to load and the container crash-loops trying to
// auto-install typescript. Plain ESM needs no compiler at runtime.
const __dirname = dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const amaOrigin = process.env.NEXT_PUBLIC_AMA_ORIGIN ?? 'https://*.amoeba.site';

// When embedded under ambAppStore (e.g. `/app-sales-report-v2/*` routed via nginx
// or the platform Vite proxy), set BASE_PATH so Next emits matching asset URLs.
// Leave empty for standalone dev (http://localhost:3000/).
const basePath = process.env.BASE_PATH || undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  transpilePackages: ['@v2/db', '@v2/shared', '@v2/ui'],
  outputFileTracingRoot: __dirname,
  experimental: {
    serverActions: {
      // Shopee Sales xlsx exports can be ~5–10 MB at scale.
      bodySizeLimit: '15mb',
    },
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
    ];
  },
};

export default withNextIntl(nextConfig);
