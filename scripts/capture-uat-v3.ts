/**
 * UAT V2 홈 화면 캡처 — 4 역할 × /home (V2 promote 후)
 *
 * 사용:
 *   npx tsx scripts/capture-uat-v2-home.ts
 *
 * 출력:
 *   docs/uat/screenshots-v3/01-home-{role}.png
 */

import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const BASE_URL = 'http://localhost:3002'
const OUTPUT_DIR = path.join(__dirname, '../docs/uat/screenshots-v3')

interface Role {
  key: string
  email: string
  label: string
}

const ROLES: Role[] = [
  { key: 'super-admin', email: 'super@ctr.co.kr', label: 'SUPER_ADMIN (대조영)' },
  { key: 'hr-admin', email: 'hr@ctr.co.kr', label: 'HR_ADMIN (한지영)' },
  { key: 'manager', email: 'manager@ctr.co.kr', label: 'MANAGER (박준혁)' },
  { key: 'employee', email: 'employee-a@ctr.co.kr', label: 'EMPLOYEE (이민준)' },
]

// Optional CLI filter: `npx tsx ... --role super-admin` to re-capture a single role.
const roleFilter = process.argv.find((arg) => arg.startsWith('--role='))?.split('=')[1]
  ?? (process.argv.includes('--role') ? process.argv[process.argv.indexOf('--role') + 1] : undefined)
const SELECTED_ROLES = roleFilter
  ? ROLES.filter((r) => r.key === roleFilter)
  : ROLES

const PAGES: Array<{ slug: string; path: string; label: string }> = [
  { slug: 'home', path: '/home', label: '홈 대시보드 (V2)' },
  { slug: 'approvals-inbox', path: '/my/tasks?tab=approvals', label: '나의 업무 — 승인 요청 탭' },
  { slug: 'notifications', path: '/notifications', label: '알림' },
]

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: true })

  let total = 0
  let errors = 0

  for (const role of SELECTED_ROLES) {
    console.log(`\n👤 ${role.label}`)
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'ko-KR',
    })
    await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ko', url: BASE_URL }])
    const page = await context.newPage()

    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const csrf = await page.evaluate(async () => {
        const res = await fetch('/api/auth/csrf')
        return (await res.json()) as { csrfToken: string }
      })

      await page.evaluate(async ({ token, email }) => {
        await fetch('/api/auth/callback/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            csrfToken: token,
            email,
            callbackUrl: '/home',
            json: 'true',
          }),
        })
      }, { token: csrf.csrfToken, email: role.email })

      await page.goto(`${BASE_URL}/home`, { waitUntil: 'networkidle', timeout: 30000 })
      const title = await page.title()
      if (title.includes('로그인') || title.includes('Login')) {
        console.error(`  ❌ Login failed`)
        errors++
        await context.close()
        continue
      }

      for (const target of PAGES) {
        const filename = `${target.slug}-${role.key}.png`
        const filePath = path.join(OUTPUT_DIR, filename)
        try {
          await page.goto(`${BASE_URL}${target.path}`, { waitUntil: 'networkidle', timeout: 30000 })
          await page.waitForTimeout(2000)
          await page.screenshot({ path: filePath, fullPage: false })
          console.log(`  📸 ${filename} — ${target.label}`)
          total++
        } catch (err) {
          console.log(`  ⚠️  ${filename} — SKIP (${(err as Error).message.substring(0, 80)})`)
          errors++
        }
      }
    } catch (err) {
      console.error(`  ❌ ${role.email}: ${(err as Error).message}`)
      errors++
    } finally {
      await context.close()
    }
  }

  await browser.close()
  console.log(`\n✅ Done — ${total} captured, ${errors} errors`)
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
