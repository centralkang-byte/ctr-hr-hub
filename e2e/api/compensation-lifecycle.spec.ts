// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Lifecycle E2E Tests
// Salary bands, simulation API, total rewards, benefits
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile, assertPageLoads } from '../helpers/auth'
import { waitForLoading, waitForPageReady } from '../helpers/wait-helpers'

// ─── HR_ADMIN tests ──────────────────────────────────────

test.describe('Compensation: HR_ADMIN', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('can view compensation page', async ({ page }) => {
    await assertPageLoads(page, '/compensation')
    await waitForLoading(page)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
  })

  test('can view compensation analytics', async ({ page }) => {
    await assertPageLoads(page, '/analytics/compensation')
    await waitForPageReady(page)
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('can view gender pay gap analysis', async ({ page }) => {
    await assertPageLoads(page, '/analytics/gender-pay-gap')
    await waitForPageReady(page)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
  })

  test('can view benefits page', async ({ page }) => {
    await assertPageLoads(page, '/benefits')
    await waitForLoading(page)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
  })
})

// ─── API tests: Salary Bands ─────────────────────────────

test.describe('Compensation API: Salary Bands', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET salary-bands returns array', async ({ request }) => {
    const res = await request.get('/api/v1/compensation/salary-bands')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(Array.isArray(body.data)).toBe(true)
  })
})

// ─── API tests: Simulation ───────────────────────────────

test.describe('Compensation API: Simulation', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('POST simulation SINGLE mode returns results', async ({ request }) => {
    const res = await request.post('/api/v1/payroll/simulation', {
      data: {
        mode: 'SINGLE',
        employeeId: '', // empty = skip, but API should handle gracefully
        companyId: '',
        adjustmentPct: 5,
      },
    })
    // Should not crash — may return 400 for missing params or 200 with data
    expect([200, 400]).toContain(res.status())
  })

  test('GET simulation scenarios returns list', async ({ request }) => {
    const res = await request.get('/api/v1/payroll/simulation/scenarios')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })
})

// ─── API tests: Compa-Ratio ──────────────────────────────

test.describe('Compensation API: Compa-Ratio', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET compa-ratio analysis returns distribution', async ({ request }) => {
    const res = await request.get('/api/v1/analytics/payroll/compa-ratio')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })
})

// ─── API tests: Benefits ─────────────────────────────────

test.describe('Benefits API', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('GET benefit policies returns list', async ({ request }) => {
    const res = await request.get('/api/v1/benefits/policies')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })

  test('GET benefit claims returns list', async ({ request }) => {
    const res = await request.get('/api/v1/benefit-claims')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })

  test('GET benefit budgets returns data', async ({ request }) => {
    const res = await request.get('/api/v1/benefit-budgets')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })
})

// ─── EMPLOYEE tests ──────────────────────────────────────

test.describe('Compensation: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('can view own payslips', async ({ page }) => {
    await assertPageLoads(page, '/payroll/me')
    await waitForLoading(page)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
  })

  test('can view total rewards page', async ({ page }) => {
    await assertPageLoads(page, '/my/total-rewards')
    await waitForPageReady(page)
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
  })

  test('GET total rewards API returns data', async ({ request }) => {
    const res = await request.get('/api/v1/employees/me/total-rewards')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(typeof body.data.baseSalary).toBe('number')
    expect(typeof body.data.total).toBe('number')
    expect(body.data.currency).toBeDefined()
    expect(Array.isArray(body.data.yearlyBreakdown)).toBe(true)
  })

  test('EMPLOYEE blocked from compensation admin page', async ({ page }) => {
    await page.goto('/compensation')
    // Should redirect to home or show forbidden
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url.includes('/compensation')).toBe(false)
  })
})

// ─── RBAC: EMPLOYEE blocked from HR endpoints ────────────

test.describe('Compensation RBAC', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('EMPLOYEE blocked from salary-bands API', async ({ request }) => {
    const res = await request.get('/api/v1/compensation/salary-bands')
    expect([403, 401]).toContain(res.status())
  })

  test('EMPLOYEE blocked from compensation analytics API', async ({ request }) => {
    const res = await request.get('/api/v1/analytics/compensation')
    expect([403, 401]).toContain(res.status())
  })
})
