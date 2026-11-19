import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  reporter: [['html', {outputFolder: 'reports/playwright', open: 'never'}], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {name: 'chrome', use: {...devices['Desktop Chrome'], channel: 'chrome'}},
    {name: 'edge', use: {...devices['Desktop Edge'], channel: 'msedge'}},
  ],
});
