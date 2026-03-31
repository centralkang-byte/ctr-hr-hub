// ═══════════════════════════════════════════════════════════
// CTR HR Hub — E2E Auth Helpers
// Login uses NextAuth credentials provider via API call.
// storageState-based session reuse via authFile().
// ═══════════════════════════════════════════════════════════

import path from 'path'
import { type Page, expect } from '@playwright/test'

// ─── Role types ──────────────────────────────────────────
export type RoleType = 'SUPER_ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE'

const TEST_EMAILS: Record<RoleType, string> = {
  SUPER_ADMIN: 'super@ctr.co.kr',
  HR_ADMIN:    'hr@ctr.co.kr',
  MANAGER:     'manager@ctr.co.kr',
  EMPLOYEE:    'employee-a@ctr.co.kr',
}

// ─── storageState path helper ────────────────────────────
const AUTH_DIR = path.join(__dirname, '..', '.auth')

/**
 * Returns the storageState JSON file path for a given role.
 * Use with `test.use({ storageState: authFile('HR_ADMIN') })`.
 */
export function authFile(role: RoleType): string {
  return path.join(AUTH_DIR, `${role}.json`)
}

// ─── loginAs (kept for golden-paths backward compat) ─────
/**
 * Login as a specific user role using NextAuth credentials API directly.
 * Prefer storageState + authFile() for new tests.
 */
export async function loginAs(
  page: Page,
  role: RoleType,
) {
  const email = TEST_EMAILS[role]

  // 1. Get CSRF token from NextAuth
  const csrfRes = await page.request.get('/api/auth/csrf')
  const { csrfToken } = await csrfRes.json()

  // 2. POST credentials directly to NextAuth callback
  await page.request.post('/api/auth/callback/credentials', {
    form: {
      email,
      csrfToken,
      callbackUrl: '/home',
      json: 'true',
    },
  })

  // 3. Navigate to home — session cookie is now set
  await page.goto('/home', { waitUntil: 'domcontentloaded', timeout: 45000 })

  // Verify we're not redirected to login
  if (page.url().includes('/login')) {
    throw new Error(`loginAs(${role}) failed — redirected to /login`)
  }
}

// ─── assertBlocked ──────────────────────────────────────
/**
 * Assert that a page route is blocked (redirects to forbidden or login).
 * Used by RBAC and permission boundary tests.
 */
export async function assertBlocked(page: Page, path: string) {
  await page.goto(path)
  // Wait for page to settle
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 })

  const url = page.url()
  const isForbiddenPath = url.includes(path)
  const isRedirectedAway =
    url.includes('error=forbidden') ||
    url.includes('/login') ||
    !isForbiddenPath

  expect(
    isRedirectedAway,
    `Expected ${path} to be blocked but URL was: ${url}`,
  ).toBe(true)
}

// ─── assertPageLoads ─────────────────────────────────────
/**
 * Assert that a page loads without showing the error boundary.
 */
export async function assertPageLoads(
  page: Page,
  url: string,
  options?: { timeout?: number },
) {
  await page.goto(url, {
    timeout: options?.timeout || 45000,
    waitUntil: 'domcontentloaded',
  })

  // Should NOT be redirected back to login
  expect(page.url()).not.toContain('/login')

  // Should NOT show error boundary
  const errorBoundary = page.locator('text=페이지를 불러올 수 없습니다')
  await expect(errorBoundary).not.toBeVisible({ timeout: 5000 })
}
