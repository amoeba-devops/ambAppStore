import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config cho E2E test app-car-manager-v2.
 *
 * Pre-requisites (caller phải đảm bảo trước khi run):
 *   1. Dev server :3000 đang chạy với DEMO_AUTO_LOGIN=true, JWT_SECRET sync với AMA
 *   2. ambManagement API :3019 đang chạy
 *   3. PostgreSQL db_amb có VN01 entity với 6 users (1 ADMIN_LEVEL)
 *   4. Neon dev DB reachable (car_users + car_tenant_settings có column tns_users_synced_at)
 *
 * Test KHÔNG auto-start servers — dùng `npm run dev` ở root v2 trước.
 */
export default defineConfig({
  testDir: './e2e',
  /* Tăng timeout 60s → 120s vì Next.js dev mode compile lần đầu các route nặng
   * (forms /vehicles/new, /users/new, /reports với map + recharts) take 30-90s.
   * Trade-off: failing test slower but reduce flake. CI nên dùng next build +
   * next start để loại bỏ on-demand compile. */
  timeout: 120_000,
  fullyParallel: false,
  workers: 1, // Tests share DB state — serial để tránh race
  /* Next.js dev compile route on-demand; goto đụng đúng lúc compile dở thỉnh
   * thoảng trả net::ERR_ABORTED. 1 retry hấp thụ flake này khi chạy local; CI
   * (next build + next start, không on-demand compile) hiếm cần nhưng để 2 cho
   * chắc. Root-fix: chạy e2e trên `next build && next start`. */
  retries: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    /* Default port 3001 — match README §0 + package.json dev script.
     * Port 3000 reserved cho app-sales-report-v2 (sibling app). E2E baseURL
     * configurable via E2E_BASE_URL env nếu chạy CI/staging. */
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  /* Warm-up project: hit các route nặng 1 lần để Next.js compile xong trước
   * khi test chính chạy. Giảm flake compile timeout. */
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
