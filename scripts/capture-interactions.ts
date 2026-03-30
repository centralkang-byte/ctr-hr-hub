/**
 * 인터랙션 상태 스크린샷 캡처 v3
 * - 버튼 클릭으로 열리는 다이얼로그/폼
 * - 동적 라우트 상세 페이지 (API로 첫 번째 ID 조회)
 * - 아직 캡처되지 않은 서브페이지
 */

import { chromium, type Page } from 'playwright'
import path from 'path'
import fs from 'fs'

const BASE_URL = 'http://localhost:3002'
const OUTPUT_DIR = path.join(__dirname, '../docs/screenshots/stitch')

// ─── Login ───────────────────────────────────────────────────────────────────

async function login(page: Page) {
  console.log('🔐 Logging in...')
  await page.goto(`${BASE_URL}/login`)
  const csrfRes = await page.evaluate(async () => {
    const r = await fetch('/api/auth/csrf')
    return r.json() as Promise<{ csrfToken: string }>
  })
  await page.evaluate(async (token: string) => {
    await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        csrfToken: token,
        email: 'hr@ctr.co.kr',
        callbackUrl: '/home',
        json: 'true',
      }),
    })
  }, csrfRes.csrfToken)
  await page.goto(`${BASE_URL}/home`)
  await page.waitForTimeout(3000)
  console.log('✅ Logged in')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function nav(page: Page, url: string, ms = 30000) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded', timeout: ms })
  await page.waitForTimeout(3000)
}

async function shot(page: Page, filename: string) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false })
  console.log(`  📸 ${filename}`)
}

async function capture(page: Page, filename: string, action: () => Promise<void>) {
  try {
    await action()
    await shot(page, filename)
    return true
  } catch (err) {
    console.log(`  ⚠️  ${filename} — SKIP (${(err as Error).message.substring(0, 90)})`)
    return false
  }
}

/** API로 첫 번째 항목 ID 조회 */
async function apiFirstId(page: Page, apiPath: string, idField = 'id'): Promise<string | null> {
  try {
    const result = await page.evaluate(async (url: string) => {
      const r = await fetch(url)
      if (!r.ok) return null
      return r.json()
    }, `/api/v1${apiPath}`)
    if (!result) return null
    const arr = Array.isArray(result) ? result
      : Array.isArray(result.data) ? result.data
      : Array.isArray(result.items) ? result.items
      : Array.isArray(result.content) ? result.content
      : null
    if (!arr || arr.length === 0) return null
    return String(arr[0]?.[idField] ?? '')
  } catch {
    return null
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await context.newPage()

  await login(page)

  let success = 0
  let failed = 0
  const run = async (f: string, a: () => Promise<void>) => {
    ;(await capture(page, f, a)) ? success++ : failed++
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 01 — Home / 결재
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📂 01-home')

  await run('01-home_approvals_attendance.png', async () => {
    await nav(page, '/approvals/attendance')
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 02 — My Space
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📂 02-myspace')

  await run('02-myspace_leave_request-dialog.png', async () => {
    await nav(page, '/leave')
    // 데이터 로드 완료 대기 후 버튼 클릭
    await page.waitForTimeout(2000)
    await page.locator('button:has-text("휴가 신청")').first().click({ timeout: 10000 })
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 })
    await page.waitForTimeout(800)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 04 — HR 관리
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📂 04-hr')

  // 직원 상세 + 하위 탭
  const empId = await apiFirstId(page, '/employees?page=1&pageSize=1')
  if (empId) {
    await run('04-hr_employees_detail.png', async () => {
      await nav(page, `/employees/${empId}`)
    })
    await run('04-hr_employees_detail_contracts.png', async () => {
      await nav(page, `/employees/${empId}/contracts`)
    })
    await run('04-hr_employees_detail_work-permits.png', async () => {
      await nav(page, `/employees/${empId}/work-permits`)
    })
  } else {
    console.log('  ⚠️  직원 ID 조회 실패 — 직원 상세 건너뜀')
    failed += 3
  }

  // 연차 일괄 부여 다이얼로그
  await run('04-hr_leave_admin_bulk-grant-dialog.png', async () => {
    await nav(page, '/leave/admin')
    await page.waitForTimeout(2000)
    await page.locator('button:has-text("일괄 부여")').first().click({ timeout: 10000 })
    // dialog 또는 모달로 열릴 때까지 대기
    await page.waitForTimeout(2000)
  })

  // 온보딩 상세
  const onboardingId = await apiFirstId(page, '/onboarding/instances?page=1&pageSize=1')
  if (onboardingId) {
    await run('04-hr_onboarding_detail.png', async () => {
      await nav(page, `/onboarding/${onboardingId}`)
    })
  } else {
    failed++
    console.log('  ⚠️  온보딩 ID 조회 실패')
  }

  // 오프보딩 상세
  const offboardingId = await apiFirstId(page, '/offboarding/instances?page=1&pageSize=1')
  if (offboardingId) {
    await run('04-hr_offboarding_detail.png', async () => {
      await nav(page, `/offboarding/${offboardingId}`)
    })
  } else {
    failed++
    console.log('  ⚠️  오프보딩 ID 조회 실패')
  }

  // 징계 새 폼 / 상세 (API: /api/v1/disciplinary)
  await run('04-hr_discipline_new.png', async () => {
    await nav(page, '/discipline/new')
  })
  await run('04-hr_discipline_rewards_new.png', async () => {
    await nav(page, '/discipline/rewards/new')
  })

  const disciplineId = await apiFirstId(page, '/disciplinary?page=1&limit=1')
  if (disciplineId) {
    await run('04-hr_discipline_detail.png', async () => {
      await nav(page, `/discipline/${disciplineId}`)
    })
  } else {
    failed++
    console.log('  ⚠️  징계 ID 조회 실패')
  }

  const rewardId = await apiFirstId(page, '/disciplinary/rewards?page=1&limit=1')
  if (rewardId) {
    await run('04-hr_discipline_rewards_detail.png', async () => {
      await nav(page, `/discipline/rewards/${rewardId}`)
    })
  } else {
    failed++
    console.log('  ⚠️  포상 ID 조회 실패')
  }

  // 일괄 인사이동 — 카드 선택 후 다음 단계
  await run('04-hr_hr_bulk-movements_upload-step.png', async () => {
    await nav(page, '/hr/bulk-movements')
    await page.waitForTimeout(1000)
    // 첫 번째 유형 카드 클릭 (승진, 전보 등)
    await page.locator('[class*="card"], [class*="Card"], div[role="button"]').first().click({ timeout: 5000 })
    await page.waitForTimeout(800)
    // '다음' 버튼 클릭
    await page.locator('button:has-text("다음")').first().click({ timeout: 5000 })
    await page.waitForTimeout(1500)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 05 — 채용
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📂 05-recruitment')

  const recruitId = await apiFirstId(page, '/recruitment/postings?page=1&pageSize=1')
  if (recruitId) {
    await run('05-recruitment_recruitment_detail.png', async () => {
      await nav(page, `/recruitment/${recruitId}`)
    })
    await run('05-recruitment_recruitment_detail_pipeline.png', async () => {
      await nav(page, `/recruitment/${recruitId}/pipeline`)
    })
    await run('05-recruitment_recruitment_detail_applicants.png', async () => {
      await nav(page, `/recruitment/${recruitId}/applicants`)
    })
    await run('05-recruitment_recruitment_detail_interviews.png', async () => {
      await nav(page, `/recruitment/${recruitId}/interviews`)
    })
  } else {
    console.log('  ⚠️  채용공고 ID 조회 실패')
    failed += 4
  }

  await run('05-recruitment_recruitment_requisitions_new.png', async () => {
    await nav(page, '/recruitment/requisitions/new')
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 06 — 성과/보상
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📂 06-performance')

  await run('06-performance_performance_goals_new.png', async () => {
    await nav(page, '/performance/goals/new')
  })

  const cycleId = await apiFirstId(page, '/performance/cycles?page=1&pageSize=1')
  if (cycleId) {
    await run('06-performance_performance_cycles_detail.png', async () => {
      await nav(page, `/performance/cycles/${cycleId}`)
    })
  } else {
    failed++
    console.log('  ⚠️  평가 주기 ID 조회 실패')
  }

  // 1:1 면담 상세 (API: /api/v1/cfr/one-on-ones)
  const oneOnOneId = await apiFirstId(page, '/cfr/one-on-ones?page=1&pageSize=1')
  if (oneOnOneId) {
    await run('06-performance_performance_one-on-one_detail.png', async () => {
      await nav(page, `/performance/one-on-one/${oneOnOneId}`)
    })
  } else {
    failed++
    console.log('  ⚠️  1:1 면담 ID 조회 실패')
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 07 — 급여
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📂 07-payroll')

  // 수동 조정: 정산 run 클릭 → 조정 추가 버튼
  await run('07-payroll_payroll_adjustments_add-form.png', async () => {
    await nav(page, '/payroll/adjustments')
    await page.waitForTimeout(1500)
    // 왼쪽 run 목록: 'w-full text-left' 버튼 또는 yearMonth 텍스트가 있는 버튼
    const runButtons = page.locator('button.w-full')
    const count = await runButtons.count()
    if (count === 0) throw new Error('No run buttons found')
    await runButtons.first().click({ timeout: 5000 })
    await page.waitForTimeout(2000)
    // 조정 추가 버튼
    await page.locator('button:has-text("조정 추가")').first().click({ timeout: 8000 })
    await page.waitForTimeout(1500)
  })

  // 급여 정산 상세
  const runId = await apiFirstId(page, '/payroll/runs?page=1&pageSize=1')
  if (runId) {
    await run('07-payroll_payroll_run-detail.png', async () => {
      await nav(page, `/payroll/${runId}/review`)
    })
  } else {
    failed++
    console.log('  ⚠️  급여 정산 ID 조회 실패')
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 08 — 인사이트
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n📂 08-insights')

  await run('08-insights_analytics_payroll.png', async () => {
    await nav(page, '/analytics/payroll', 45000)
  })

  if (empId) {
    await run('08-insights_analytics_predictive_employee-risk.png', async () => {
      await nav(page, `/analytics/predictive/${empId}`, 45000)
    })
  } else {
    failed++
    console.log('  ⚠️  직원 ID 없어 예측 분석 개인 페이지 건너뜀')
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 결과
  // ══════════════════════════════════════════════════════════════════════════
  await browser.close()
  console.log(`\n✅ 인터랙션 캡처 완료: ${success}장 성공, ${failed}장 실패`)
  console.log(`📁 저장 위치: ${OUTPUT_DIR}`)
}

main().catch(console.error)
