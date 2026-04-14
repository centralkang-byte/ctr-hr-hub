// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Playwright Configuration
// Uses globalSetup for role-based storageState (session reuse)
// ═══════════════════════════════════════════════════════════

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,     // Step 3: non-serial describes distribute tests across workers
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,   // Step 3: CI=2 (ubuntu 2vCPU/7GB), local=4
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
      name: 'api',
      testDir: './e2e/api',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'browser',
      testDir: './e2e/flows',
      use: { ...devices['Desktop Chrome'] },
    },
    // ─── Visual regression: 3 viewport sub-projects ─────
    {
      name: 'visual-desktop',
      testDir: './e2e/visual',
      retries: 0,
      timeout: 60_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      expect: {
        toHaveScreenshot: {
          maxDiffPixelRatio: 0.005,
          threshold: 0.2,
        },
      },
      snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
    },
    {
      name: 'visual-tablet',
      testDir: './e2e/visual',
      retries: 0,
      timeout: 60_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
      expect: {
        toHaveScreenshot: {
          maxDiffPixelRatio: 0.005,
          threshold: 0.2,
        },
      },
      snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
    },
    {
      name: 'visual-mobile',
      testDir: './e2e/visual',
      retries: 0,
      timeout: 60_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
      },
      expect: {
        toHaveScreenshot: {
          maxDiffPixelRatio: 0.005,
          threshold: 0.2,
        },
      },
      snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
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
