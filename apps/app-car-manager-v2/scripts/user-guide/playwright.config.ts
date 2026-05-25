import { defineConfig, devices } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './shots',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: APP_URL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },

  projects: [
    {
      name: 'vi-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        locale: 'vi-VN',
      },
      metadata: { uiLocale: 'vi', device: 'desktop' },
    },
    {
      name: 'ko-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        locale: 'ko-KR',
      },
      metadata: { uiLocale: 'ko', device: 'desktop' },
    },
    {
      name: 'vi-mobile',
      use: {
        ...devices['iPhone 14'],
        locale: 'vi-VN',
      },
      metadata: { uiLocale: 'vi', device: 'mobile' },
    },
    {
      name: 'ko-mobile',
      use: {
        ...devices['iPhone 14'],
        locale: 'ko-KR',
      },
      metadata: { uiLocale: 'ko', device: 'mobile' },
    },
  ],
});
