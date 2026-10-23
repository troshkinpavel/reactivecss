import { defineConfig, devices } from '@playwright/test';

const PORT = 4400;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // Tests run against the production build, served statically.
  webServer: { command: `npx astro preview --port ${PORT} --ignore-lock`, port: PORT, reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
