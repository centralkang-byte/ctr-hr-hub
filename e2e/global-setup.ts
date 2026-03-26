// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Playwright Global Setup
// Logs in each role ONCE and saves storageState for reuse.
// This eliminates ~60 redundant loginAs calls per test run.
// ═══════════════════════════════════════════════════════════

import { chromium, type FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const AUTH_DIR = path.join(__dirname, '.auth')

const ROLES = {
  SUPER_ADMIN: 'super@ctr.co.kr',
  HR_ADMIN: 'hr@ctr.co.kr',
  MANAGER: 'manager@ctr.co.kr',
  EMPLOYEE: 'employee-a@ctr.co.kr',
} as const

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3002'

  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  const browser = await chromium.launch()

  for (const [role, email] of Object.entries(ROLES)) {
    const authFile = path.join(AUTH_DIR, `${role}.json`)

    // Skip if auth file exists and is less than 1 hour old
    if (fs.existsSync(authFile)) {
      const stat = fs.statSync(authFile)
      const ageMs = Date.now() - stat.mtimeMs
      if (ageMs < 60 * 60 * 1000) {
        console.log(`  [auth] ${role} — reusing cached session`)
        continue
      }
    }

    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()

    try {
      // 1. Get CSRF token
      const csrfRes = await page.request.get('/api/auth/csrf')
      const { csrfToken } = await csrfRes.json()

      // 2. POST credentials to NextAuth callback
      await page.request.post('/api/auth/callback/credentials', {
        form: {
          email,
          csrfToken,
          callbackUrl: '/home',
          json: 'true',
        },
      })

      // 3. Navigate to verify session is set
      await page.goto('/home', { waitUntil: 'domcontentloaded', timeout: 45000 })

      if (page.url().includes('/login')) {
        throw new Error(`Login failed for ${role} (${email})`)
      }

      // 4. Save storageState
      await context.storageState({ path: authFile })
      console.log(`  [auth] ${role} — session saved`)
    } catch (err) {
      console.error(`  [auth] ${role} — FAILED:`, err)
      throw err
    } finally {
      await context.close()
    }
  }

  await browser.close()
}

export default globalSetup
