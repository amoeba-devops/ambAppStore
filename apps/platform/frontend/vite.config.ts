import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5200,
    proxy: {
      '/api': {
        target: 'http://localhost:3100',
        changeOrigin: true,
      },
      // v2 is built locally WITHOUT BASE_PATH (D2 — mirrors Render's clean URL).
      // Browser URL still keeps the /app-car-manager-v2/* prefix for consistency
      // with the staging nginx layout, so this proxy:
      //   1. Strips /app-car-manager-v2 on request (browser /app-car-manager-v2/foo
      //      → upstream /foo)
      //   2. Re-adds /app-car-manager-v2 in Location headers on the response
      //      (so server-side redirects from v2 land back under the prefix)
      //   3. Tells v2 the outer origin via x-forwarded-host (cookie domain =
      //      localhost:5200, not :3001)
      '/app-car-manager-v2': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/app-car-manager-v2/, '') || '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const host = req.headers.host;
            if (host) proxyReq.setHeader('x-forwarded-host', host);
            proxyReq.setHeader('x-forwarded-proto', 'http');
          });
          proxy.on('proxyRes', (proxyRes) => {
            const loc = proxyRes.headers.location;
            if (!loc || typeof loc !== 'string') return;
            const prefix = '/app-car-manager-v2';
            if (loc.startsWith('http')) {
              try {
                const url = new URL(loc);
                if (!url.pathname.startsWith(prefix)) {
                  url.pathname = prefix + url.pathname;
                  proxyRes.headers.location = url.toString();
                }
              } catch {
                /* leave malformed Location alone */
              }
            } else if (loc.startsWith('/') && !loc.startsWith(prefix)) {
              proxyRes.headers.location = prefix + loc;
            }
          });
        },
      },
      // v2's Next.js HMR + asset bundles live at /_next/* with no basePath now.
      // Forward them to v2 directly so embedded testing via :5200 keeps working.
      // Safe: platform (Vite) doesn't use this path.
      '/_next': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
