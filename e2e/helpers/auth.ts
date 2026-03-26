// ═══════════════════════════════════════════════════════════
// CTR HR Hub — E2E Auth Helpers
// Login uses NextAuth credentials provider via API call
// ═══════════════════════════════════════════════════════════

import { type Page, expect } from '@playwright/test'

const TEST_EMAILS: Record<string, string> = {
  SUPER_ADMIN: 'super@ctr.co.kr',
  HR_ADMIN:    'hr@ctr.co.kr',
  MANAGER:     'manager@ctr.co.kr',
  EMPLOYEE:    'employee-a@ctr.co.kr',
}

/**
 * Login as a specific user role using NextAuth credentials API directly.
 * More reliable than clicking UI buttons (avoids client-side signIn race conditions).
 */
export async function loginAs(
  page: Page,
  role: 'SUPER_ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE',
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
