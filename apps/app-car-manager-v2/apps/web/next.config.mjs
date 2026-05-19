import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const amaOrigin = process.env.NEXT_PUBLIC_AMA_ORIGIN ?? 'https://*.amoeba.site';

const basePath = process.env.BASE_PATH || undefined;

/* Mirror BASE_PATH onto a NEXT_PUBLIC_ prefix so the client bundle can read it
 * at runtime (Service Worker registration path, manifest links built in JS).
 * BASE_PATH itself is server-only by Next convention. */
process.env.NEXT_PUBLIC_BASE_PATH = basePath ?? '';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  transpilePackages: ['@car-v2/db', '@car-v2/shared', '@car-v2/ui'],
  outputFileTracingRoot: __dirname,
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
