import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config. Pure-function tests under `src/lib/__tests__` run by default;
 * point at other globs as suites grow. We intentionally use the node
 * environment (jsdom not needed yet) — once we test React components or
 * hooks that touch the DOM, switch to `environment: 'jsdom'` or per-file
 * `// @vitest-environment jsdom` annotations.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // `server-only` throws at import in non-server contexts. Stub it for
      // unit tests so we can import pure functions out of server services.
      // Real Next.js builds still see the original module.
      'server-only': path.resolve(__dirname, 'src/test/server-only-stub.ts'),
    },
  },
});
