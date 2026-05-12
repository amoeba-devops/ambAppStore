import type { NextConfig } from 'next';

const amaOrigin = process.env.NEXT_PUBLIC_AMA_ORIGIN ?? 'https://*.amoeba.site';

const nextConfig: NextConfig = {
  transpilePackages: ['@v2/db', '@v2/shared', '@v2/ui'],
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

export default nextConfig;
