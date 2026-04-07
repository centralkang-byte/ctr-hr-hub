/**
 * Google Stitch용 전체 페이지 스크린샷 캡처
 * Usage: npx playwright test scripts/capture-screenshots.ts --headed
 *   or:  npx tsx scripts/capture-screenshots.ts
 */

import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'

const BASE_URL = 'http://localhost:3002'
const OUTPUT_DIR = path.join(__dirname, '../docs/screenshots/stitch')

// 카테고리별 페이지 목록
const PAGES: Record<string, string[]> = {
  '01-home': [
    '/home',
    '/notifications',
    '/my/tasks?tab=approvals',
  ],
  '02-myspace': [
    '/attendance',
    '/leave',
    '/leave-of-absence',
    '/payroll/me',
    '/my/benefits',
    '/performance',
    '/my/skills',
    '/my/training',
    '/performance/recognition',
    '/my/documents',
    '/my/profile',
    '/my/settings',
  ],
  '03-team': [
    '/manager-hub',
    '/attendance/team',
    '/performance/team-goals',
    '/performance/team-results',
    '/performance/one-on-one',
  ],
  '04-hr': [
    '/employees',
    '/employees/new',
    '/org',
    '/org-studio',
    '/directory',
    '/hr/bulk-movements',
    '/attendance/admin',
    '/attendance/shift-calendar',
    '/attendance/shift-roster',
    '/leave/admin',
    '/onboarding',
    '/offboarding',
    '/discipline',
    '/discipline/rewards',
  ],
  '05-recruitment': [
    '/recruitment',
    '/recruitment/new',
    '/recruitment/board',
    '/recruitment/dashboard',
    '/recruitment/requisitions',
    '/recruitment/talent-pool',
    '/recruitment/cost-analysis',
  ],
  '06-performance': [
    '/performance/admin',
    '/performance/calibration',
    '/performance/cycles',
    '/performance/goals',
    '/performance/manager-evaluation',
    '/performance/my-evaluation',
    '/performance/my-goals',
    '/performance/results',
    '/performance/self-eval',
    '/performance/peer-review',
    '/performance/pulse',
    '/compensation',
    '/benefits',
  ],
  '07-payroll': [
    '/payroll',
    '/payroll/simulation',
    '/payroll/global',
    '/payroll/bank-transfers',
    '/payroll/anomalies',
    '/payroll/adjustments',
    '/payroll/close-attendance',
    '/payroll/import',
  ],
  '08-insights': [
    '/analytics',
    '/analytics/workforce',
    '/analytics/payroll',
    '/analytics/performance',
    '/analytics/attendance',
    '/analytics/turnover',
    '/analytics/predictive',
    '/analytics/team-health',
    '/analytics/ai-report',
    '/analytics/compensation',
  ],
  '09-settings': [
    '/settings',
    '/settings/attendance',
    '/settings/organization',
    '/settings/payroll',
    '/settings/performance',
    '/settings/recruitment',
    '/settings/system',
    '/compliance',
    '/compliance/gdpr',
    '/compliance/kr',
    '/compliance/cn',
    '/compliance/data-retention',
  ],
  '10-misc': [
    '/talent/succession',
    '/training',
    '/organization/skill-matrix',
  ],
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
  })
  const page = await context.newPage()

  // 로그인: CSRF 토큰 가져오기 → credentials callback
  console.log('🔐 Logging in as hr@ctr.co.kr...')
  await page.goto(`${BASE_URL}/login`)

  const csrfRes = await page.evaluate(async () => {
    const res = await fetch('/api/auth/csrf')
    return res.json()
  })

  await page.evaluate(async (csrfToken: string) => {
    await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        csrfToken,
        email: 'hr@ctr.co.kr',
        callbackUrl: '/home',
        json: 'true',
      }),
    })
  }, csrfRes.csrfToken)

  // 세션 쿠키 확인
  await page.goto(`${BASE_URL}/home`)
  await page.waitForTimeout(3000)

  const title = await page.title()
  if (title.includes('로그인') || title.includes('login')) {
    console.error('❌ Login failed!')
    await browser.close()
    process.exit(1)
  }
  console.log('✅ Logged in successfully')

  // 로그인 페이지 캡처 (별도)
  const loginPage = await context.newPage()
  await loginPage.goto(`${BASE_URL}/login`)
  await loginPage.waitForTimeout(2000)
  await loginPage.screenshot({ path: path.join(OUTPUT_DIR, '00-login.png'), fullPage: false })
  await loginPage.close()
  console.log('📸 00-login.png')

  // 전체 페이지 순회
  let total = 0
  let errors = 0

  for (const [category, paths] of Object.entries(PAGES)) {
    console.log(`\n📂 ${category}`)
    for (const pagePath of paths) {
      const filename = `${category}_${pagePath.replace(/\//g, '_').replace(/^_/, '')}.png`
      try {
        await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'networkidle', timeout: 15000 })
        await page.waitForTimeout(1500) // UI 안정화 대기
        await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false })
        console.log(`  📸 ${filename}`)
        total++
      } catch (err) {
        console.log(`  ⚠️  ${filename} — SKIP (${(err as Error).message.substring(0, 60)})`)
        errors++
        // 에러 시에도 스크린샷 시도
        try {
          await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false })
          total++
        } catch {
          // 무시
        }
      }
    }
  }

  // 동적 라우트 — 첫 번째 직원 상세 페이지
  try {
    await page.goto(`${BASE_URL}/employees`, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(2000)
    const firstLink = await page.$('a[href*="/employees/"]')
    if (firstLink) {
      await firstLink.click()
      await page.waitForTimeout(3000)
      await page.screenshot({ path: path.join(OUTPUT_DIR, '04-hr_employees_detail.png'), fullPage: false })
      console.log('  📸 04-hr_employees_detail.png')
      total++
    }
  } catch {
    console.log('  ⚠️  Employee detail — SKIP')
  }

  await browser.close()

  console.log(`\n✅ 완료: ${total}장 캡처, ${errors}건 스킵`)
  console.log(`📁 저장 위치: ${OUTPUT_DIR}`)
}

main().catch(console.error)
