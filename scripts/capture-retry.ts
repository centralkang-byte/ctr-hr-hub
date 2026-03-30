/**
 * 타임아웃으로 스킵된 페이지 재시도 (30초 타임아웃)
 */
import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'

const BASE_URL = 'http://localhost:3002'
const OUTPUT_DIR = path.join(__dirname, '../docs/screenshots/stitch')

const RETRY_PAGES: [string, string][] = [
  ['02-myspace_leave.png', '/leave'],
  ['02-myspace_performance.png', '/performance'],
  ['03-team_manager-hub.png', '/manager-hub'],
  ['03-team_performance_team-goals.png', '/performance/team-goals'],
  ['03-team_performance_one-on-one.png', '/performance/one-on-one'],
  ['04-hr_employees.png', '/employees'],
  ['04-hr_employees_new.png', '/employees/new'],
  ['04-hr_org.png', '/org'],
  ['04-hr_org-studio.png', '/org-studio'],
  ['04-hr_directory.png', '/directory'],
  ['04-hr_hr_bulk-movements.png', '/hr/bulk-movements'],
  ['04-hr_attendance_shift-calendar.png', '/attendance/shift-calendar'],
  ['06-performance_compensation.png', '/compensation'],
  ['06-performance_benefits.png', '/benefits'],
  ['07-payroll_payroll_adjustments.png', '/payroll/adjustments'],
  ['08-insights_analytics.png', '/analytics'],
  ['08-insights_analytics_workforce.png', '/analytics/workforce'],
  ['08-insights_analytics_payroll.png', '/analytics/payroll'],
  ['08-insights_analytics_performance.png', '/analytics/performance'],
  ['08-insights_analytics_predictive.png', '/analytics/predictive'],
  ['08-insights_analytics_ai-report.png', '/analytics/ai-report'],
]

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
  })
  const page = await context.newPage()

  // 로그인
  console.log('🔐 Logging in...')
  await page.goto(`${BASE_URL}/login`)
  const csrfRes = await page.evaluate(async () => {
    const res = await fetch('/api/auth/csrf')
    return res.json()
  })
  await page.evaluate(async (csrfToken: string) => {
    await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, email: 'hr@ctr.co.kr', callbackUrl: '/home', json: 'true' }),
    })
  }, csrfRes.csrfToken)
  await page.goto(`${BASE_URL}/home`)
  await page.waitForTimeout(3000)
  console.log('✅ Logged in')

  let success = 0
  let failed = 0

  for (const [filename, pagePath] of RETRY_PAGES) {
    try {
      // 먼저 홈으로 갔다가 타겟으로 (세션 유지)
      await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(3000)
      await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false })
      console.log(`✅ ${filename}`)
      success++
    } catch (err) {
      // domcontentloaded 실패 시 load도 스킵하고 현재 상태 캡처
      try {
        await page.waitForTimeout(2000)
        await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false })
        console.log(`⚠️  ${filename} (partial)`)
        success++
      } catch {
        console.log(`❌ ${filename} — FAIL`)
        failed++
      }
    }
  }

  await browser.close()
  console.log(`\n✅ 재시도 완료: ${success}장 성공, ${failed}장 실패`)
}

main().catch(console.error)
