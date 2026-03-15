// ═══════════════════════════════════════════════════════════
// CTR HR Hub — E2E Auth Helpers
// Phase Q-5f: Playwright Golden Path Tests
//
// Login uses NextAuth credentials provider via test account buttons
// (see src/app/(auth)/login/LoginPageContent.tsx — TEST_ACCOUNTS)
// ═══════════════════════════════════════════════════════════

import { type Page, expect } from '@playwright/test'

/**
 * Test account emails matching LoginPageContent.tsx TEST_ACCOUNTS.
 * These use NextAuth credentials provider (signIn('credentials', { email })).
 * The dev login buttons trigger signIn directly — no password field needed.
 */
const TEST_EMAILS: Record<string, string> = {
  SUPER_ADMIN: 'admin@ctr.co.kr',
  HR_ADMIN:    'hr@ctr.co.kr',
  MANAGER:     'manager@ctr.co.kr',
  EMPLOYEE:    'employee@ctr.co.kr',
}

/**
 * Login as a specific user role by clicking the dev test-account button.
 * Requires NEXT_PUBLIC_SHOW_TEST_ACCOUNTS=true in .env
 */
export async function loginAs(
  page: Page,
  role: 'SUPER_ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE',
) {
  const email = TEST_EMAILS[role]

  await page.goto('/login')

  // Wait for the login page to fully load
  await page.waitForLoadState('networkidle', { timeout: 10000 })

  // Click the test account button that matches the email
  // Each test account card shows the email as text
  const accountButton = page.locator(`button:has-text("${email}")`)
  
  if (await accountButton.isVisible({ timeout: 5000 })) {
    // Dev mode: click the test account button directly
    await accountButton.click()
  } else {
    // Fallback: try NextAuth signIn via URL (credentials provider)
    await page.goto(
      `/api/auth/callback/credentials?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent('/home')}`,
    )
  }

  // Wait for redirect to dashboard/home
  await page.waitForURL('**/home**', { timeout: 15000 }).catch(() => {
    // Some roles might redirect elsewhere
    return page.waitForURL('**/*', { timeout: 5000 })
  })
}

/**
 * Assert that a page loads without showing the error boundary.
 */
export async function assertPageLoads(
  page: Page,
  url: string,
  options?: { timeout?: number },
) {
  await page.goto(url, { timeout: options?.timeout || 15000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 })

  // Should NOT show error boundary
  const errorBoundary = page.locator('text=페이지를 불러올 수 없습니다')
  await expect(errorBoundary).not.toBeVisible({ timeout: 3000 })

  // Should NOT be redirected back to login
  expect(page.url()).not.toContain('/login')
}
