import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // 플랫폼 Nginx에서 /app-hscode/* 로 라우팅 (VITE base = build 시점 인라인)
  base: '/app-hscode/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5202,
    proxy: {
      // /app-hscode/api/v1/* → BFF /api/v1/* (프로덕션 nginx 라우팅과 동일 형태)
      '/app-hscode/api': {
        target: 'http://localhost:3102',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/app-hscode/, ''),
      },
    },
  },
});
