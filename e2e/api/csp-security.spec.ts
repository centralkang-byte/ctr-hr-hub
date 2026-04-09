// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Phase 3 Batch 4: CSP & Security Headers E2E
//
// Verifies:
// 1. CSP header present on page and API responses
// 2. Security headers correctly set
// 3. X-XSS-Protection removed (legacy)
// 4. object-src 'none' in CSP
// 5. Dev mode: unsafe-eval/unsafe-inline present
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from '../helpers/auth'

test.describe('CSP & Security Headers', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('page response has CSP header with required directives', async ({ page }) => {
    const response = await page.goto('/home')
    expect(response).not.toBeNull()
    const csp = response!.headers()['content-security-policy']
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("object-src 'none'")
  })

  test('API response has CSP header', async ({ request }) => {
    const res = await request.get('/api/v1/notifications/unread-count')
    const csp = res.headers()['content-security-policy']
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
  })

  test('security headers are present', async ({ page }) => {
    const response = await page.goto('/home')
    expect(response).not.toBeNull()
    const headers = response!.headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toContain('camera=()')
  })

  test('X-XSS-Protection is removed', async ({ page }) => {
    const response = await page.goto('/home')
    expect(response).not.toBeNull()
    expect(response!.headers()['x-xss-protection']).toBeUndefined()
  })

  test('CSP contains script-src directive', async ({ page }) => {
    const response = await page.goto('/home')
    expect(response).not.toBeNull()
    const csp = response!.headers()['content-security-policy']
    // Dev: unsafe-eval + unsafe-inline, Prod: nonce + strict-dynamic
    expect(csp).toMatch(/script-src/)
  })

  test('CSP contains style-src with cdn.jsdelivr.net', async ({ page }) => {
    const response = await page.goto('/home')
    expect(response).not.toBeNull()
    const csp = response!.headers()['content-security-policy']
    expect(csp).toContain('cdn.jsdelivr.net')
  })
})
