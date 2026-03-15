// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Golden Path E2E Smoke Tests
// Phase Q-5f: 5 critical user flows
//
// These tests verify that core pages load without crashing.
// They do NOT test full business logic — just navigation + render.
// Requires:
//   1. Dev server running (npm run dev)
//   2. NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
//   3. Seeded test accounts (admin/hr/manager/employee @ctr.co.kr)
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { loginAs, assertPageLoads } from './helpers/auth'

// ─── GP1: Employee Self-Service ──────────────────────────

test.describe('Golden Path 1: Employee Self-Service', () => {
  test('Employee can view dashboard and leave page', async ({ page }) => {
    await loginAs(page, 'EMPLOYEE')

    // Dashboard / home loads
    await assertPageLoads(page, '/home')

    // My page (profile)
    await assertPageLoads(page, '/my/profile')

    // Leave page
    await assertPageLoads(page, '/leave')
  })
})

// ─── GP2: Manager Team View ─────────────────────────────

test.describe('Golden Path 2: Manager Team View', () => {
  test('Manager can view team and approval pages', async ({ page }) => {
    await loginAs(page, 'MANAGER')

    // Home
    await assertPageLoads(page, '/home')

    // Approval inbox
    await assertPageLoads(page, '/approvals/inbox')

    // Team leave
    await assertPageLoads(page, '/leave/team')

    // Performance team results
    await assertPageLoads(page, '/performance/team-results')
  })
})

// ─── GP3: HR Admin Operations ───────────────────────────

test.describe('Golden Path 3: HR Admin Operations', () => {
  test('HR Admin can access employee list and payroll', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')

    // Employee directory
    await assertPageLoads(page, '/directory')

    // Payroll
    await assertPageLoads(page, '/payroll')

    // Recruitment
    await assertPageLoads(page, '/recruitment')

    // Attendance admin
    await assertPageLoads(page, '/attendance/admin')
  })
})

// ─── GP4: Performance Cycle ─────────────────────────────

test.describe('Golden Path 4: Performance Cycle', () => {
  test('HR Admin can view performance dashboard and goals', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')

    // Performance main
    await assertPageLoads(page, '/performance')

    // Goals
    await assertPageLoads(page, '/performance/goals')

    // Peer review
    await assertPageLoads(page, '/performance/peer-review')

    // Recognition
    await assertPageLoads(page, '/performance/recognition')
  })
})

// ─── GP5: Analytics & Insights ──────────────────────────

test.describe('Golden Path 5: Analytics & Insights', () => {
  test('HR Admin can view analytics dashboards', async ({ page }) => {
    await loginAs(page, 'HR_ADMIN')

    // Analytics overview
    await assertPageLoads(page, '/analytics')

    // Workforce analytics
    await assertPageLoads(page, '/analytics/workforce')

    // Compensation analytics
    await assertPageLoads(page, '/analytics/compensation')

    // Settings (system admin area)
    await assertPageLoads(page, '/settings')
  })
})
