// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment E2E Tests
// Covers HR_ADMIN access to all recruitment sub-pages
// (recruitment is HR_UP — HR_ADMIN only)
//
// Requires:
//   1. Dev server running (npm run dev)
//   2. NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
//   3. Seeded test accounts + recruitment data
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, assertPageLoads } from './helpers/auth'
import { waitForLoading, waitForPageReady, waitForTableRows } from './helpers/wait-helpers'

test.describe('Recruitment', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')
  })

  // ─── 1. Job Posting List ──────────────────────────────

  test('Can view job posting list', async ({ page }) => {
    await assertPageLoads(page, '/recruitment')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Page heading with Briefcase icon area should render
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 8000 })

    // Table must be present — list renders a <table> element
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 8000 })

    // Table header columns should be visible
    const thead = page.locator('thead').first()
    await expect(thead).toBeVisible({ timeout: 5000 })

    // New posting button should be rendered
    const newButton = page.locator('button').filter({ hasText: /등록|New|Register/i }).first()
    await expect(newButton).toBeVisible({ timeout: 5000 })
  })

  // ─── 2. New Posting Form ──────────────────────────────

  test('Can access new posting form', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/new')
    await waitForPageReady(page)
    await waitForLoading(page)

    // Form element must exist
    const form = page.locator('form').first()
    await expect(form).toBeVisible({ timeout: 8000 })

    // Title input field should be present
    const titleInput = page
      .locator('input[name="title"], input[placeholder*="제목"], input[placeholder*="Title"]')
      .first()
    await expect(titleInput).toBeVisible({ timeout: 8000 })

    // Employment type select should be rendered
    const employmentTypeSelect = page
      .locator('select, [role="combobox"]')
      .first()
    await expect(employmentTypeSelect).toBeVisible({ timeout: 8000 })

    // Submit / save button should be present
    const submitButton = page
      .locator('button[type="submit"], button:has-text("저장"), button:has-text("등록"), button:has-text("Save")')
      .first()
    await expect(submitButton).toBeVisible({ timeout: 8000 })
  })

  // ─── 3. Recruitment Pipeline / Kanban Board ───────────

  test('Can view recruitment pipeline kanban board', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/board')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Board renders swimlane stage column headers using Korean labels
    // STAGE_LABELS: 지원, 서류검토, 1차 면접, 2차 면접, 최종 면접, 오퍼, 채용 확정
    const stageLabel = page
      .locator('text=지원, text=서류검토, text=1차 면접, [class*="stage"], [class*="Stage"], [class*="lane"], [class*="Lane"]')
      .first()
    await expect(stageLabel).toBeVisible({ timeout: 10000 })

    // LayoutGrid icon area or kanban column structure should render
    const kanbanStructure = page
      .locator('[class*="grid"], [class*="flex"]')
      .first()
    await expect(kanbanStructure).toBeVisible({ timeout: 5000 })
  })

  // ─── 4. Applicant List (via Requisitions) ────────────

  test('Can view applicant list via requisitions', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/requisitions')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Page should render some content — heading, cards, or table
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 8000 })

    // Requisition list renders cards or a list structure
    // Look for the new requisition button or search input as proof of page load
    const pageContent = page
      .locator(
        'button:has-text("채용"), button:has-text("요청"), input[type="text"], input[type="search"], [class*="card"], [class*="Card"]',
      )
      .first()
    await expect(pageContent).toBeVisible({ timeout: 10000 })
  })

  // ─── 5. Interview Schedule ───────────────────────────

  test('Can view interview schedule page', async ({ page }) => {
    // Navigate to the recruitment list first to find a posting with interviews
    await assertPageLoads(page, '/recruitment')
    await waitForPageReady(page)
    await waitForLoading(page)

    // The board page exposes interview stages — use it as the interview schedule view
    await assertPageLoads(page, '/recruitment/board')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Interview-related stage labels should appear (1차 면접, 2차 면접, 최종 면접)
    const interviewLabel = page
      .locator('text=면접, text=Interview, text=인터뷰')
      .first()
    await expect(interviewLabel).toBeVisible({ timeout: 10000 })
  })

  // ─── 6. Recruitment Dashboard ────────────────────────

  test('Can view recruitment dashboard with stats', async ({ page }) => {
    await assertPageLoads(page, '/recruitment/dashboard')
    await waitForPageReady(page)
    await waitForLoading(page)

    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Dashboard renders KPI stat cards
    // KPI icons: UserPlus, Users, Clock, Target — wrapped in card elements
    const cards = page.locator('[class*="card"], [class*="Card"]')
    await expect(cards.first()).toBeVisible({ timeout: 10000 })

    // Funnel chart (Recharts BarChart) or generic SVG should render
    const chart = page.locator('svg.recharts-surface').first()
    const hasChart = await chart.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasChart) {
      // Fallback: any SVG (chart might use different class)
      const svg = page.locator('svg').first()
      const hasSvg = await svg.isVisible({ timeout: 3000 }).catch(() => false)
      if (!hasSvg) {
        // At minimum the recent postings table should render
        const table = page.locator('table').first()
        await expect(table).toBeVisible({ timeout: 8000 })
      }
    }

    // Dashboard should contain recruitment-related text
    await expect(main).toContainText(/채용|공고|Recruitment|Posting/i, { timeout: 8000 })
  })
})
