// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Playwright Configuration
// Phase Q-5f: E2E Smoke Tests
// ═══════════════════════════════════════════════════════════

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,    // Run sequentially (tests may share state)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,              // Single worker for smoke tests
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
