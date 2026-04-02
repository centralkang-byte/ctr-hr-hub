// ═══════════════════════════════════════════════════════════
// CTR HR Hub — QuarterlyReview Bulk Create E2E Tests
//
// Tests:
// - Manager bulk-creates for team
// - Idempotency: re-run same params → created=0, skipped=N
// - Non-team employee → rejected
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from './helpers/auth'

const BASE = '/api/v1/performance/quarterly-reviews'
// Unique year per run to avoid collisions (no DELETE API)
const BULK_YEAR = 2050 + (Math.floor(Date.now() / 1000) % 48)
const BULK_QUARTER = 'Q3'

test.describe('QuarterlyReview Bulk Create', () => {
  test.describe.configure({ mode: 'serial' })

  let teamEmployeeIds: string[] = []

  test.describe('MANAGER bulk-creates for team', () => {
    test.use({ storageState: authFile('MANAGER') })

    test('should get team member IDs', async ({ request }) => {
      // manager@ctr.co.kr manages employee-a and employee-b
      // Get their IDs via employee search
      const resA = await request.get('/api/v1/employees?search=이민준&limit=1')
      const bodyA = await resA.json() as { data: Array<{ id: string }> }
      const resB = await request.get('/api/v1/employees?search=정다은&limit=1')
      const bodyB = await resB.json() as { data: Array<{ id: string }> }

      if (bodyA.data[0]?.id) teamEmployeeIds.push(bodyA.data[0].id)
      if (bodyB.data[0]?.id) teamEmployeeIds.push(bodyB.data[0].id)

      expect(teamEmployeeIds.length).toBeGreaterThanOrEqual(1)
    })

    test('should bulk-create reviews for team', async ({ request }) => {
      const res = await request.post(`${BASE}/bulk-create`, {
        data: {
          employeeIds: teamEmployeeIds,
          year: BULK_YEAR,
          quarter: BULK_QUARTER,
        },
      })

      if (!res.ok()) {
        const errBody = await res.json().catch(() => ({}))
        console.error('bulk-create failed:', res.status(), JSON.stringify(errBody))
      }
      expect(res.ok()).toBeTruthy()
      const body = await res.json() as { data: { created: number; skipped: number; total: number } }
      expect(body.data.created).toBe(teamEmployeeIds.length)
      expect(body.data.skipped).toBe(0)
      expect(body.data.total).toBe(teamEmployeeIds.length)
    })

    test('should skip existing reviews on re-run (idempotency)', async ({ request }) => {
      const res = await request.post(`${BASE}/bulk-create`, {
        data: {
          employeeIds: teamEmployeeIds,
          year: BULK_YEAR,
          quarter: BULK_QUARTER,
        },
      })

      expect(res.ok()).toBeTruthy()
      const body = await res.json() as { data: { created: number; skipped: number; total: number } }
      expect(body.data.created).toBe(0)
      expect(body.data.skipped).toBe(teamEmployeeIds.length)
    })
  })

  test.describe('Non-team employee rejection', () => {
    test.use({ storageState: authFile('MANAGER') })

    test('should reject non-team employee in bulk-create', async ({ request }) => {
      // manager2@ctr.co.kr manages 송현우, not 이민준
      // manager@ctr.co.kr should not be able to create for 송현우
      const resC = await request.get('/api/v1/employees?search=송현우&limit=1')
      const bodyC = await resC.json() as { data: Array<{ id: string }> }
      const nonTeamId = bodyC.data[0]?.id

      if (nonTeamId) {
        const res = await request.post(`${BASE}/bulk-create`, {
          data: {
            employeeIds: [nonTeamId],
            year: BULK_YEAR,
            quarter: 'Q4', // Different quarter to avoid collision
          },
        })
        // Should either 403 or 400 (employee not in team)
        expect(res.ok()).toBeFalsy()
      }
    })
  })

  test.describe('HR_ADMIN can bulk-create for any employee', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('should bulk-create without team restriction', async ({ request }) => {
      if (teamEmployeeIds.length === 0) return

      const res = await request.post(`${BASE}/bulk-create`, {
        data: {
          employeeIds: teamEmployeeIds,
          year: BULK_YEAR,
          quarter: 'Q4', // Different quarter
        },
      })

      expect(res.ok()).toBeTruthy()
      const body = await res.json() as { data: { created: number; total: number } }
      expect(body.data.created).toBeGreaterThanOrEqual(0)
    })
  })
})
