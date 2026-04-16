// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Calibration Batch Adjust E2E Tests
//
// Tests batch-adjust API: validation, permissions, data update
// Uses 46-calibration-qa seed data (CALIBRATION cycle + 20 evals)
//
// Roles:
// - HR_ADMIN (hr@ctr.co.kr): has performance:manage → can adjust
// - EMPLOYEE (employee-a@ctr.co.kr): lacks performance:manage → blocked
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { authFile } from '../helpers/auth'
import {
  getCalibrationSessions,
  submitBatchAdjust,
} from '../helpers/calibration-fixtures'

// ─── State ────────────────────────────────────────────────────

let sessionId: string
let evalEmployeeIds: Array<{ employeeId: string; emsBlock: string }> = []

// ═══════════════════════════════════════════════════════════
// ALL TESTS
// ═══════════════════════════════════════════════════════════

test.describe('Calibration Batch Adjust', () => {
  test.describe.configure({ mode: 'serial' })

  // ── Setup: find seed data ──
  test.describe('Setup', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('1. find calibration session from seed', async ({ request }) => {
      const sessions = await getCalibrationSessions(request)
      const qaSession = sessions.find((s) => s.name?.includes('QA'))
        ?? sessions.find((s) => s.status !== 'CALIBRATION_COMPLETED')
      expect(qaSession).toBeDefined()
      sessionId = qaSession!.id

      // Get evaluations via session detail (includes evaluations with emsBlock)
      const detailRes = await request.get(
        `/api/v1/performance/calibration/sessions/${sessionId}`,
      )
      expect(detailRes.ok()).toBeTruthy()
      const detailBody = await detailRes.json() as {
        data?: {
          evaluations?: Array<{ employee?: { id: string }; emsBlock: string | null }>
        }
      }
      const evals = (detailBody.data?.evaluations ?? []).filter(
        (e) => e.employee?.id && e.emsBlock,
      )
      expect(evals.length).toBeGreaterThanOrEqual(5)

      // Store first 3 employees with their current blocks
      evalEmployeeIds = evals.slice(0, 3).map((e) => ({
        employeeId: e.employee!.id,
        emsBlock: e.emsBlock!,
      }))
    })
  })

  // ── Validation tests ──
  test.describe('Validation', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('2. reason too short (< 10 chars) rejected', async ({ request }) => {
      const result = await submitBatchAdjust(
        request,
        sessionId,
        [{ employeeId: evalEmployeeIds[0].employeeId, fromBlock: '2B', toBlock: '3C' }],
        'short', // < 10 chars
      )
      expect(result.status).toBe(400)
    })

    test('3. invalid session ID returns 404', async ({ request }) => {
      const result = await submitBatchAdjust(
        request,
        '00000000-0000-0000-0000-000000000000',
        [{ employeeId: evalEmployeeIds[0].employeeId, fromBlock: '2B', toBlock: '3C' }],
        'E2E 테스트: 존재하지 않는 세션 검증',
      )
      expect(result.status).toBe(404)
    })

    test('4. empty adjustments array rejected', async ({ request }) => {
      const res = await request.post(
        `/api/v1/performance/calibration/${sessionId}/batch-adjust`,
        { data: { adjustments: [], sharedReason: 'E2E 테스트: 빈 배열 검증용 사유입니다' } },
      )
      expect(res.status()).toBe(400)
    })
  })

  // ── Permission test ──
  test.describe('Permissions', () => {
    test('5. EMPLOYEE cannot batch adjust', async ({ }) => {
      const empReq = await playwrightRequest.newContext({
        storageState: authFile('EMPLOYEE'),
      })

      const result = await submitBatchAdjust(
        empReq,
        sessionId,
        [{ employeeId: evalEmployeeIds[0].employeeId, fromBlock: '2B', toBlock: '3C' }],
        'E2E 테스트: 권한 검증용 사유입니다 (직원)',
      )
      expect(result.status).toBe(403)
      await empReq.dispose()
    })
  })

  // ── Happy path ──
  test.describe('Batch Adjust', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('6. single employee adjust succeeds', async ({ request }) => {
      const emp = evalEmployeeIds[0]
      const targetBlock = emp.emsBlock === '3C' ? '1A' : '3C'

      const result = await submitBatchAdjust(
        request,
        sessionId,
        [{ employeeId: emp.employeeId, fromBlock: emp.emsBlock, toBlock: targetBlock }],
        'E2E 테스트: 단일 직원 배치 조정 검증입니다',
      )
      expect(result.ok).toBeTruthy()
      expect(result.data?.batchId).toBeTruthy()
      expect(result.data?.succeeded).toBe(1)
      expect(result.data?.failed).toBe(0)

      // Update stored block for later tests
      evalEmployeeIds[0].emsBlock = targetBlock
    })

    test('7. multiple employees adjust succeeds', async ({ request }) => {
      const adjustments = evalEmployeeIds.slice(1, 3).map((emp) => ({
        employeeId: emp.employeeId,
        fromBlock: emp.emsBlock,
        toBlock: emp.emsBlock === '1A' ? '2B' : '1A',
      }))

      const result = await submitBatchAdjust(
        request,
        sessionId,
        adjustments,
        'E2E 테스트: 다중 직원 배치 조정 검증입니다 (2명)',
      )
      expect(result.ok).toBeTruthy()
      expect(result.data?.succeeded).toBe(2)
      expect(result.data?.failed).toBe(0)
      expect(result.data?.totalProcessed).toBe(2)
    })

    test('8. non-existent employee in batch handled gracefully', async ({ request }) => {
      const result = await submitBatchAdjust(
        request,
        sessionId,
        [
          {
            employeeId: '00000000-0000-0000-0000-000000000099',
            fromBlock: '2B',
            toBlock: '3C',
          },
        ],
        'E2E 테스트: 존재하지 않는 직원 포함 배치입니다',
      )
      // API may return 200 with failed count, or 400/500 — both are acceptable
      if (result.ok) {
        // Partial failure: 200 OK with failed=1
        expect(result.data?.failed).toBe(1)
      } else {
        // Error response: 4xx or 5xx
        expect(result.status).toBeGreaterThanOrEqual(400)
      }
    })

    test('9. verify emsBlock updated via session detail', async ({ request }) => {
      const detailRes = await request.get(
        `/api/v1/performance/calibration/sessions/${sessionId}`,
      )
      expect(detailRes.ok()).toBeTruthy()
      const body = await detailRes.json() as {
        data?: {
          evaluations?: Array<{ employee?: { id: string }; emsBlock: string | null }>
        }
      }
      const evals = body.data?.evaluations ?? []

      // The first employee should have the updated block
      const updated = evals.find((e) => e.employee?.id === evalEmployeeIds[0].employeeId)
      expect(updated).toBeDefined()
      expect(updated!.emsBlock).toBe(evalEmployeeIds[0].emsBlock)
    })
  })
})
