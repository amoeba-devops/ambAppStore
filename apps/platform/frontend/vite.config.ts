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
      '/app-car-manager-v2': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
        // Tell v2 the user-facing origin (so server-side redirects and
        // absoluteUrl() stay on :5200 instead of jumping cross-origin to :3001,
        // which would drop the amb_session cookie that's bound to :5200).
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const host = req.headers.host;
            if (host) proxyReq.setHeader('x-forwarded-host', host);
            proxyReq.setHeader('x-forwarded-proto', 'http');
          });
        },
      },
    },
  },
});
