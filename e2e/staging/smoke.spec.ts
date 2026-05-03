// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Phase 10 Staging Smoke
// 4역할 dev login → /home V2 렌더 + 핵심 CTA 링크 + 콘솔 에러 0건
// staging Vercel deployment 대상 (외부 URL).
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, type RoleType } from '../helpers/auth'

interface RoleSpec {
  role: RoleType
  expectedLinks: string[]
}

// 각 역할별 /home V2에 표시되어야 할 핵심 CTA href.
// Session 179에서 정정된 path 기준 (drift 방지 회귀 검증).
const ROLES: RoleSpec[] = [
  { role: 'SUPER_ADMIN', expectedLinks: ['/approvals/inbox', '/employees/new'] },
  { role: 'HR_ADMIN', expectedLinks: ['/approvals/inbox', '/employees/new'] },
  { role: 'MANAGER', expectedLinks: ['/approvals/inbox', '/performance/one-on-one'] },
  { role: 'EMPLOYEE', expectedLinks: ['/attendance', '/my/tasks'] },
]

for (const { role, expectedLinks } of ROLES) {
  test(`${role}: /home V2 — login + key CTA links present`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
    })

    await loginAs(page, role)
    expect(page.url()).toMatch(/\/home(\?|$)/)

    for (const href of expectedLinks) {
      const link = page.locator(`a[href="${href}"]`).first()
      await expect(link, `Expected CTA href=${href} for ${role}`).toBeVisible({
        timeout: 10_000,
      })
    }

    // 알려진 비차단 경고는 허용. 그 외 console error 0건.
    const fatalErrors = errors.filter(
      (e) =>
        !/hydration/i.test(e) &&
        !/MISSING_MESSAGE/.test(e) &&
        !/Image with src/.test(e) &&
        !/Failed to load resource.*404/.test(e),
    )
    expect(
      fatalErrors,
      `Unexpected console errors for ${role}:\n${fatalErrors.join('\n')}`,
    ).toHaveLength(0)
  })
}

test('HR_ADMIN: tracker row 클릭 → onboarding/offboarding detail (조건부)', async ({
  page,
}) => {
  await loginAs(page, 'HR_ADMIN')

  const trackerRow = page
    .locator('a[href^="/onboarding/"], a[href^="/offboarding/"]')
    .first()

  const count = await trackerRow.count()
  test.skip(count === 0, 'No tracker rows visible — staging seed에 진행 중인 record 없음')

  const href = await trackerRow.getAttribute('href')
  expect(href).toBeTruthy()

  await trackerRow.click()
  await page.waitForLoadState('domcontentloaded')
  expect(page.url()).toContain(href!)

  // OffboardingDetailClient 크래시 회귀 검증 (Session 182 fix).
  const errorBoundary = page.locator('text=페이지를 불러올 수 없습니다')
  await expect(errorBoundary).not.toBeVisible({ timeout: 5_000 })
})
