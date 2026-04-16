/**
 * scripts/qa/capture-screenshots.ts
 *
 * Q-0 Layer 1+2: 152페이지 스크린샷 캡처
 *
 * Auth 방법:
 *   NextAuth JWT + CredentialsProvider (이메일만으로 로그인)
 *   POST /api/auth/callback/credentials { email, csrfToken }
 *
 * 실행:
 *   npx playwright test scripts/qa/capture-screenshots.ts --headed
 *   또는: node scripts/qa/run-capture.mjs
 */

import { chromium, type BrowserContext } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// ─── 설정 ─────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000'
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots')
const RESULTS_FILE = path.join(__dirname, 'layer1-2-results.json')

// 역할별 테스트 이메일 (DB에서 시드된 계정)
// 아래 값은 실제 DB 시드 이메일로 교체해야 합니다.
// get-test-emails.ts로 조회하거나 직접 지정하세요.
const TEST_ACCOUNTS: Record<string, string> = {
  EMPLOYEE: 'kr3001@ctr.co.kr',
  MANAGER: 'kr3017@ctr.co.kr',   // P9=MANAGER (persona)
  HR_ADMIN: 'kr3066@ctr.co.kr',  // HR 부서 P9
  SUPER_ADMIN: 'kr3066@ctr.co.kr', // HR Admin 계정 fallback
}

// ─── URL 목록 ─────────────────────────────────────────────────
type Role = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN' | 'SUPER_ADMIN'

interface UrlEntry {
  path: string
  role: Role
  group: string
}

// 동적 라우트 ID는 실제 DB 레코드로 교체 (run-capture.mjs에서 resolve)
const STATIC_URLS: UrlEntry[] = [
  // ── Auth ──
  { path: '/home', role: 'EMPLOYEE', group: 'home' },

  // ── My Space ──
  { path: '/my', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/tasks', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/profile', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/benefits', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/internal-jobs', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/leave', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/offboarding', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/skills', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/training', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/year-end', role: 'EMPLOYEE', group: 'my' },
  { path: '/my/settings/notifications', role: 'EMPLOYEE', group: 'my' },
  { path: '/employees/me', role: 'EMPLOYEE', group: 'my' },

  // ── Attendance ──
  { path: '/attendance', role: 'EMPLOYEE', group: 'attendance' },
  { path: '/leave', role: 'EMPLOYEE', group: 'leave' },
  { path: '/performance', role: 'EMPLOYEE', group: 'performance' },

  // ── Approvals ──
  { path: '/my/tasks?tab=approvals', role: 'MANAGER', group: 'approvals' },
  { path: '/approvals/attendance', role: 'MANAGER', group: 'approvals' },
  { path: '/manager-hub', role: 'MANAGER', group: 'manager' },
  { path: '/attendance/team', role: 'MANAGER', group: 'attendance' },
  { path: '/leave/team', role: 'MANAGER', group: 'leave' },
  { path: '/team/skills', role: 'MANAGER', group: 'team' },
  { path: '/delegation/settings', role: 'MANAGER', group: 'delegation' },

  // ── HR Management ──
  { path: '/employees', role: 'HR_ADMIN', group: 'employees' },
  { path: '/employees/new', role: 'HR_ADMIN', group: 'employees' },
  { path: '/directory', role: 'HR_ADMIN', group: 'employees' },
  { path: '/org', role: 'HR_ADMIN', group: 'org' },
  { path: '/org-studio', role: 'HR_ADMIN', group: 'org' },
  { path: '/organization/skill-matrix', role: 'HR_ADMIN', group: 'org' },
  { path: '/attendance/admin', role: 'HR_ADMIN', group: 'attendance' },
  { path: '/attendance/shift-calendar', role: 'HR_ADMIN', group: 'attendance' },
  { path: '/attendance/shift-roster', role: 'HR_ADMIN', group: 'attendance' },
  { path: '/leave/admin', role: 'HR_ADMIN', group: 'leave' },

  // ── Onboarding ──
  { path: '/onboarding', role: 'HR_ADMIN', group: 'onboarding' },
  { path: '/onboarding/checkin', role: 'EMPLOYEE', group: 'onboarding' },
  { path: '/onboarding/checkins', role: 'HR_ADMIN', group: 'onboarding' },
  { path: '/onboarding/me', role: 'EMPLOYEE', group: 'onboarding' },

  // ── Offboarding ──
  { path: '/offboarding', role: 'HR_ADMIN', group: 'offboarding' },
  { path: '/offboarding/exit-interviews', role: 'HR_ADMIN', group: 'offboarding' },

  // ── Discipline ──
  { path: '/discipline', role: 'HR_ADMIN', group: 'discipline' },
  { path: '/discipline/new', role: 'HR_ADMIN', group: 'discipline' },
  { path: '/discipline/rewards', role: 'HR_ADMIN', group: 'discipline' },
  { path: '/discipline/rewards/new', role: 'HR_ADMIN', group: 'discipline' },

  // ── Recruitment ──
  { path: '/recruitment', role: 'HR_ADMIN', group: 'recruitment' },
  { path: '/recruitment/new', role: 'HR_ADMIN', group: 'recruitment' },
  { path: '/recruitment/board', role: 'HR_ADMIN', group: 'recruitment' },
  { path: '/recruitment/dashboard', role: 'HR_ADMIN', group: 'recruitment' },
  { path: '/recruitment/cost-analysis', role: 'HR_ADMIN', group: 'recruitment' },
  { path: '/recruitment/requisitions', role: 'HR_ADMIN', group: 'recruitment' },
  { path: '/recruitment/requisitions/new', role: 'HR_ADMIN', group: 'recruitment' },
  { path: '/recruitment/talent-pool', role: 'HR_ADMIN', group: 'recruitment' },

  // ── Performance ──
  { path: '/performance/admin', role: 'HR_ADMIN', group: 'performance' },
  { path: '/performance/goals', role: 'HR_ADMIN', group: 'performance' },
  { path: '/performance/goals/new', role: 'EMPLOYEE', group: 'performance' },
  { path: '/performance/team-goals', role: 'MANAGER', group: 'performance' },
  { path: '/performance/team-results', role: 'MANAGER', group: 'performance' },
  { path: '/performance/results', role: 'HR_ADMIN', group: 'performance' },
  { path: '/performance/calibration', role: 'HR_ADMIN', group: 'performance' },
  { path: '/performance/cycles', role: 'HR_ADMIN', group: 'performance' },
  { path: '/performance/manager-eval', role: 'MANAGER', group: 'performance' },
  { path: '/performance/manager-evaluation', role: 'MANAGER', group: 'performance' },
  { path: '/performance/self-eval', role: 'EMPLOYEE', group: 'performance' },
  { path: '/performance/my-goals', role: 'EMPLOYEE', group: 'performance' },
  { path: '/performance/my-checkins', role: 'EMPLOYEE', group: 'performance' },
  { path: '/performance/my-evaluation', role: 'EMPLOYEE', group: 'performance' },
  { path: '/performance/my-peer-review', role: 'EMPLOYEE', group: 'performance' },
  { path: '/performance/my-result', role: 'EMPLOYEE', group: 'performance' },
  { path: '/performance/peer-review', role: 'HR_ADMIN', group: 'performance' },
  { path: '/performance/comp-review', role: 'HR_ADMIN', group: 'performance' },
  { path: '/performance/one-on-one', role: 'MANAGER', group: 'performance' },
  { path: '/performance/notifications', role: 'EMPLOYEE', group: 'performance' },
  { path: '/performance/pulse', role: 'HR_ADMIN', group: 'performance' },
  { path: '/performance/recognition', role: 'EMPLOYEE', group: 'performance' },

  // ── Payroll ──
  { path: '/payroll', role: 'HR_ADMIN', group: 'payroll' },
  { path: '/payroll/close-attendance', role: 'HR_ADMIN', group: 'payroll' },
  { path: '/payroll/adjustments', role: 'HR_ADMIN', group: 'payroll' },
  { path: '/payroll/anomalies', role: 'HR_ADMIN', group: 'payroll' },
  { path: '/payroll/simulation', role: 'HR_ADMIN', group: 'payroll' },
  { path: '/payroll/bank-transfers', role: 'HR_ADMIN', group: 'payroll' },
  { path: '/payroll/global', role: 'HR_ADMIN', group: 'payroll' },
  { path: '/payroll/import', role: 'HR_ADMIN', group: 'payroll' },
  { path: '/payroll/year-end', role: 'HR_ADMIN', group: 'payroll' },
  { path: '/payroll/me', role: 'EMPLOYEE', group: 'payroll' },

  // ── Analytics ──
  { path: '/analytics', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/workforce', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/payroll', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/performance', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/attendance', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/turnover', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/team-health', role: 'MANAGER', group: 'analytics' },
  { path: '/analytics/ai-report', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/attrition', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/compensation', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/gender-pay-gap', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/predictive', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/recruitment', role: 'HR_ADMIN', group: 'analytics' },
  { path: '/analytics/report', role: 'HR_ADMIN', group: 'analytics' },

  // ── Compensation ──
  { path: '/compensation', role: 'HR_ADMIN', group: 'compensation' },
  { path: '/benefits', role: 'HR_ADMIN', group: 'benefits' },
  { path: '/succession', role: 'HR_ADMIN', group: 'succession' },
  { path: '/talent/succession', role: 'HR_ADMIN', group: 'succession' },

  // ── Compliance ──
  { path: '/compliance', role: 'HR_ADMIN', group: 'compliance' },
  { path: '/compliance/gdpr', role: 'HR_ADMIN', group: 'compliance' },
  { path: '/compliance/data-retention', role: 'HR_ADMIN', group: 'compliance' },
  { path: '/compliance/dpia', role: 'HR_ADMIN', group: 'compliance' },
  { path: '/compliance/pii-audit', role: 'HR_ADMIN', group: 'compliance' },
  { path: '/compliance/kr', role: 'HR_ADMIN', group: 'compliance' },
  { path: '/compliance/cn', role: 'HR_ADMIN', group: 'compliance' },
  { path: '/compliance/ru', role: 'HR_ADMIN', group: 'compliance' },

  // ── Training ──
  { path: '/training', role: 'HR_ADMIN', group: 'training' },
  { path: '/training/enrollments', role: 'HR_ADMIN', group: 'training' },

  // ── Settings ──
  { path: '/settings', role: 'HR_ADMIN', group: 'settings' },
  { path: '/settings/organization', role: 'HR_ADMIN', group: 'settings' },
  { path: '/settings/attendance', role: 'HR_ADMIN', group: 'settings' },
  { path: '/settings/payroll', role: 'HR_ADMIN', group: 'settings' },
  { path: '/settings/performance', role: 'HR_ADMIN', group: 'settings' },
  { path: '/settings/recruitment', role: 'HR_ADMIN', group: 'settings' },
  { path: '/settings/system', role: 'HR_ADMIN', group: 'settings' },

  // ── Misc ──
  { path: '/notifications', role: 'EMPLOYEE', group: 'misc' },
  { path: '/dashboard', role: 'EMPLOYEE', group: 'misc' },
  { path: '/dashboard/compare', role: 'MANAGER', group: 'misc' },
  { path: '/403', role: 'EMPLOYEE', group: 'misc' },
  { path: '/offline', role: 'EMPLOYEE', group: 'misc' },
]

// ─── 헬퍼 ─────────────────────────────────────────────────────
function pathToFilename(p: string): string {
  return (p.replace(/\//g, '--').replace(/^--/, '') || 'home') + '.png'
}

interface ScanResult {
  path: string
  role: string
  status: number
  title: string
  screenshot: string
  renderStatus: 'OK' | 'BLANK' | 'ERROR' | 'AUTH_FAIL' | 'TIMEOUT'
  redirectedTo?: string
  consoleErrors: string[]
}

// ─── NextAuth 로그인 ───────────────────────────────────────────
async function loginWithCredentials(
  context: BrowserContext,
  email: string,
): Promise<boolean> {
  const page = await context.newPage()
  try {
    // 1. Get CSRF token from NextAuth
    const csrfRes = await page.request.get(`${BASE_URL}/api/auth/csrf`)
    const { csrfToken } = await csrfRes.json() as { csrfToken: string }

    // 2. POST to credentials provider
    const loginRes = await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
      form: {
        email,
        csrfToken,
        callbackUrl: `${BASE_URL}/home`,
        json: 'true',
      },
    })

    // 3. Follow redirect by navigating to home
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 15000 })
    const title = await page.title()
    const isLoggedIn = !title.toLowerCase().includes('login') && !page.url().includes('/login')

    if (!isLoggedIn) {
      console.warn(`  ⚠️ Login failed for ${email} (still on login page)`)
    }

    void loginRes // suppress unused warning
    return isLoggedIn
  } catch (err) {
    console.error(`  ❌ Login error for ${email}:`, err)
    return false
  } finally {
    await page.close()
  }
}

// ─── 메인 ─────────────────────────────────────────────────────
async function captureAll() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const results: ScanResult[] = []

  // Load dynamic URLs if they exist (from build-urls.ts output)
  let urls: UrlEntry[] = STATIC_URLS
  const dynamicUrlsFile = path.join(__dirname, 'dynamic-urls.json')
  if (fs.existsSync(dynamicUrlsFile)) {
    const dynamic = JSON.parse(fs.readFileSync(dynamicUrlsFile, 'utf-8')) as UrlEntry[]
    urls = [...STATIC_URLS, ...dynamic]
    console.log(`📋 Loaded ${dynamic.length} dynamic URLs, total: ${urls.length}`)
  }

  // Group by role
  const byRole = new Map<Role, UrlEntry[]>()
  for (const entry of urls) {
    if (!byRole.has(entry.role)) byRole.set(entry.role, [])
    byRole.get(entry.role)!.push(entry)
  }

  for (const [role, roleUrls] of byRole) {
    const email = TEST_ACCOUNTS[role]
    if (!email) {
      console.warn(`⚠️ No test account for role ${role}, skipping ${roleUrls.length} URLs`)
      continue
    }

    console.log(`\n📸 [${role}] ${email} — ${roleUrls.length} pages`)

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })

    const loggedIn = await loginWithCredentials(context, email)
    if (!loggedIn) {
      console.warn(`  ⛔ Skipping ${roleUrls.length} pages (login failed for ${email})`)
      await context.close()
      continue
    }

    let count = 0
    for (const { path: urlPath } of roleUrls) {
      const page = await context.newPage()
      const consoleErrors: string[] = []
      page.on('console', (msg: any) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200))
      })

      const filename = pathToFilename(urlPath)
      const result: ScanResult = {
        path: urlPath, role, status: 0, title: '',
        screenshot: filename, renderStatus: 'ERROR', consoleErrors,
      }

      try {
        const response = await page.goto(`${BASE_URL}${urlPath}`, {
          waitUntil: 'networkidle',
          timeout: 20000,
        })

        result.status = response?.status() ?? 0
        result.title = await page.title()
        const finalUrl = page.url()
        if (finalUrl !== `${BASE_URL}${urlPath}`) {
          result.redirectedTo = finalUrl
        }

        // Auth drop check
        const isAuthFail = result.title.toLowerCase().includes('login')
          || finalUrl.includes('/login')
          || finalUrl.includes('/auth/signin')

        if (isAuthFail) {
          result.renderStatus = 'AUTH_FAIL'
          console.log(`  🔒 [${count + 1}/${roleUrls.length}] ${urlPath} → AUTH_FAIL`)
        } else {
          // Wait for charts/lazy content
          await page.waitForTimeout(2000)

          await page.screenshot({
            path: path.join(SCREENSHOTS_DIR, filename),
            fullPage: true,
          }).catch(() => { /* ignore screenshot errors */ })

          // Blank detection
          try {
            const stat = fs.statSync(path.join(SCREENSHOTS_DIR, filename))
            if (stat.size < 15000) {
              result.renderStatus = 'BLANK'
            } else if (result.status >= 500) {
              result.renderStatus = 'ERROR'
            } else {
              result.renderStatus = 'OK'
            }
          } catch {
            result.renderStatus = 'BLANK'
          }

          const icon = result.renderStatus === 'OK' ? '✅' : result.renderStatus === 'BLANK' ? '⬜' : '❌'
          console.log(`  ${icon} [${count + 1}/${roleUrls.length}] ${urlPath} → ${result.status} (${result.renderStatus})`)
        }
      } catch (err) {
        result.status = 0
        result.renderStatus = 'TIMEOUT'
        result.consoleErrors.push(String(err).slice(0, 200))
        console.log(`  ⏱ [${count + 1}/${roleUrls.length}] ${urlPath} → TIMEOUT`)

        // Capture whatever is on screen
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, filename),
          fullPage: true,
        }).catch(() => { /* ignore */ })
      }

      results.push(result)
      count++
      await page.close()
    }

    await context.close()
  }

  await browser.close()

  // ─── 결과 저장 ───────────────────────────────────────────
  const summary = {
    ok: results.filter(r => r.renderStatus === 'OK').length,
    blank: results.filter(r => r.renderStatus === 'BLANK').length,
    error: results.filter(r => r.renderStatus === 'ERROR').length,
    auth_fail: results.filter(r => r.renderStatus === 'AUTH_FAIL').length,
    timeout: results.filter(r => r.renderStatus === 'TIMEOUT').length,
  }

  fs.writeFileSync(RESULTS_FILE, JSON.stringify({
    scan_date: new Date().toISOString(),
    total: results.length,
    summary,
    results,
  }, null, 2))

  console.log('\n=== 스캔 완료 ===')
  console.log(`총: ${results.length}`)
  console.log(`✅ OK:        ${summary.ok}`)
  console.log(`⬜ BLANK:     ${summary.blank}`)
  console.log(`❌ ERROR:     ${summary.error}`)
  console.log(`🔒 AUTH_FAIL: ${summary.auth_fail}`)
  console.log(`⏱ TIMEOUT:  ${summary.timeout}`)
  console.log(`\n📁 스크린샷: ${SCREENSHOTS_DIR}`)
  console.log(`📄 결과: ${RESULTS_FILE}`)
}

captureAll().catch(console.error)
