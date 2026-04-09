// ═══════════════════════════════════════════════════════════
// CTR HR Hub — RBAC Boundary E2E Tests
// Verifies that restricted pages block unauthorized roles.
// ═══════════════════════════════════════════════════════════

import { test } from '@playwright/test'
import { authFile, assertBlocked } from '../helpers/auth'

// ─── EMPLOYEE boundaries ────────────────────────────────

test.describe('RBAC Boundary: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('blocked from payroll admin', async ({ page }) => {
    await assertBlocked(page, '/payroll')
  })

  test('blocked from compensation', async ({ page }) => {
    await assertBlocked(page, '/compensation')
  })

  test('blocked from settings', async ({ page }) => {
    await assertBlocked(page, '/settings')
  })

  test('blocked from compliance', async ({ page }) => {
    await assertBlocked(page, '/compliance')
  })
})

// ─── MANAGER boundaries ────────────────────────────────

test.describe('RBAC Boundary: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('blocked from recruitment', async ({ page }) => {
    await assertBlocked(page, '/recruitment')
  })

  test('blocked from settings', async ({ page }) => {
    await assertBlocked(page, '/settings')
  })
})
