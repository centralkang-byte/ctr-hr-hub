import { expect, test } from '@playwright/test'
import { authFile } from '../helpers/auth'

const APPROVALS = '/api/v1/approvals/attendance'

test.describe('Attendance correction authorization', () => {
  test.describe('EMPLOYEE', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('cannot query the HR correction team inbox', async ({ request }) => {
      const response = await request.get(
        `${APPROVALS}?view=team&requestType=attendance_correction&status=pending`,
      )
      expect(response.status()).toBe(403)
    })

    test('monthly response includes effective timezone and safe record identifiers', async ({ request }) => {
      const response = await request.get('/api/v1/attendance/monthly/2026/7')
      expect(response.ok()).toBeTruthy()
      const body = await response.json() as {
        data: { timezone: string; days: Array<{ id: string | null }> }
      }
      expect(body.data.timezone).toBeTruthy()
      expect(body.data.days).toHaveLength(31)
      for (const day of body.data.days) {
        expect(day.id === null || typeof day.id === 'string').toBeTruthy()
      }
    })
  })

  test.describe('HR_ADMIN', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('generic approval creation rejects attendance_correction', async ({ request }) => {
      const response = await request.post(APPROVALS, {
        data: {
          requestType: 'attendance_correction',
          referenceId: 'fabricated',
          title: 'fabricated',
          details: {},
          approverIds: ['00000000-0000-0000-0000-000000000000'],
        },
      })
      expect(response.status()).toBe(400)
    })

    test('malformed list filters fail closed', async ({ request }) => {
      const response = await request.get(`${APPROVALS}?view=everything`)
      expect(response.status()).toBe(400)
    })

    test('can query the target-company correction inbox', async ({ request }) => {
      const response = await request.get(
        `${APPROVALS}?view=team&requestType=attendance_correction&status=pending`,
      )
      expect(response.ok()).toBeTruthy()
    })
  })
})
