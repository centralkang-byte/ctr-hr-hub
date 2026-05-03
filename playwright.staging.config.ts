// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Playwright Staging Smoke Config
// 외부 Vercel staging deployment 대상으로 smoke spec만 실행.
// 기존 playwright.config.ts와 격리 — globalSetup/webServer 미사용.
// 실행: npx playwright test --config=playwright.staging.config.ts
// 사전: .env.local에 BASE_URL + VERCEL_AUTOMATION_BYPASS_SECRET 설정
// ═══════════════════════════════════════════════════════════

import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Next.js 컨벤션 따라 .env.local 우선 로드. fallback .env.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const BASE_URL = process.env.BASE_URL
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

if (!BASE_URL) {
  throw new Error('BASE_URL env required (예: https://ctr-hr-hub-staging.vercel.app)')
}
if (!BYPASS) {
  throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET env required')
}

export default defineConfig({
  testDir: './e2e/staging',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 45_000,
    extraHTTPHeaders: {
      'x-vercel-protection-bypass': BYPASS,
      'x-vercel-set-bypass-cookie': 'samesitenone',
    },
  },
  projects: [
    {
      name: 'staging-browser',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
