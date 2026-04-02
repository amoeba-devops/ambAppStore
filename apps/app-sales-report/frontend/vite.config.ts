import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/app-sales-report',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5203,
    proxy: {
      '/api': {
        target: 'http://localhost:3103',
        changeOrigin: true,
      },
    },
  },
});
