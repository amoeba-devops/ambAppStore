import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/app-stock-management',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5204,
    proxy: {
      '/api': {
        target: 'http://localhost:3104',
        changeOrigin: true,
      },
    },
  },
});
