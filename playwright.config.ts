// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Playwright Configuration
// Uses globalSetup for role-based storageState (session reuse)
// ═══════════════════════════════════════════════════════════

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,    // Run sequentially (tests may share state)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 2,   // Step 1: conservative parallelization (was 1)
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  timeout: 90000,           // 90s per test
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 45000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // CI: auto-start production server. Local: use existing dev server.
  webServer: {
    command: 'npm run start -- -p 3002',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
