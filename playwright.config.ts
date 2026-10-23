import { defineConfig, devices } from '@playwright/test';

const PORT = 8181;
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: { command: `PORT=${PORT} node build.mjs --serve`, url: `http://localhost:${PORT}/dist/reactive-css.js`, reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
