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
  workers: 1,              // Single worker for smoke tests
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

  // Don't auto-start dev server — assume it's already running
  // webServer: { command: 'npm run dev', url: 'http://localhost:3002' },
})
