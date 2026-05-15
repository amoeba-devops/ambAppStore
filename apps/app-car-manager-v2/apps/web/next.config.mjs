import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const amaOrigin = process.env.NEXT_PUBLIC_AMA_ORIGIN ?? 'https://*.amoeba.site';

const basePath = process.env.BASE_PATH || undefined;

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
    ];
  },
};

export default withNextIntl(nextConfig);
