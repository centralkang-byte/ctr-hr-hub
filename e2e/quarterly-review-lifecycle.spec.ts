// ═══════════════════════════════════════════════════════════
// CTR HR Hub — QuarterlyReview Lifecycle E2E Tests
//
// CRUD lifecycle + state transitions:
// DRAFT → IN_PROGRESS → EMPLOYEE_DONE → COMPLETED
// Reopen: COMPLETED → IN_PROGRESS (HR only)
// Write-through: employee submit → MboProgress 생성
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from './helpers/auth'
import {
  createReview,
  getReview,
  listReviews,
  updateReviewAsEmployee,
  updateReviewAsManager,
  submitReview,
  reopenReview,
} from './helpers/qr-fixtures'

// 절대 도달할 수 없는 미래 연도 — 시드 데이터(2025-2026)와 충돌 불가, worker=1이므로 병렬 충돌 없음
const TEST_YEAR = 2099
const TEST_QUARTER = 'Q1' as const

// Known QA accounts (from seed)
// employee-a@ctr.co.kr = 이민준 (EMPLOYEE)
// manager@ctr.co.kr = 박준혁 (MANAGER) — manages 이민준
// hr@ctr.co.kr = 한지영 (HR_ADMIN)

let reviewId: string

// ─── Full Lifecycle: HR creates → Employee writes → Employee submits → Manager writes → Manager submits ───

test.describe('QuarterlyReview Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })

  test.describe('HR creates review', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('should create a quarterly review for employee (idempotent)', async ({ request }) => {
      // We need employee-a's ID. Get it via list with a known filter.
      const listRes = await request.get('/api/v1/employees?search=이민준&limit=1')
      const listBody = await listRes.json() as { data: Array<{ id: string }> }
      const employeeId = listBody.data[0]?.id
      expect(employeeId).toBeTruthy()

      // 멱등성: 이전 실행에서 남은 리뷰가 있으면(409) 기존 리뷰 재사용
      const createRes = await request.post('/api/v1/performance/quarterly-reviews', {
        data: { employeeId, year: TEST_YEAR, quarter: TEST_QUARTER },
      })

      if (createRes.status() === 409) {
        // 기존 리뷰 조회
        const existing = await listReviews(request, {
          year: String(TEST_YEAR),
          quarter: TEST_QUARTER,
        })
        const found = (existing.data as Array<{ id: string; employeeId: string; status: string }>)
          .find(r => r.employeeId === employeeId)
        expect(found).toBeTruthy()
        reviewId = found!.id

        // DRAFT가 아니면 reopen으로 상태 초기화
        if (found!.status !== 'DRAFT' && found!.status !== 'IN_PROGRESS') {
          await reopenReview(request, reviewId, 'E2E test reset')
        }
      } else {
        expect(createRes.ok()).toBeTruthy()
        const body = await createRes.json() as { data: { id: string; status: string } }
        expect(body.data.id).toBeTruthy()
        reviewId = body.data.id
      }

      expect(reviewId).toBeTruthy()
    })

    test('should return conflict for duplicate create', async ({ request }) => {
      const listRes = await request.get('/api/v1/employees?search=이민준&limit=1')
      const listBody = await listRes.json() as { data: Array<{ id: string }> }
      const employeeId = listBody.data[0]?.id

      const res = await request.post('/api/v1/performance/quarterly-reviews', {
        data: { employeeId, year: TEST_YEAR, quarter: TEST_QUARTER },
      })
      // 첫 테스트에서 이미 생성됐으므로 409 보장
      expect(res.status()).toBe(409)
    })
  })

  test.describe('Employee updates and submits', () => {
    test.use({ storageState: authFile('EMPLOYEE') })

    test('should update employee sections and auto-transition to IN_PROGRESS', async ({ request }) => {
      const updated = await updateReviewAsEmployee(request, reviewId, {
        goalHighlights: 'Q1 목표 잘 진행 중',
        challenges: '리소스 부족',
        employeeComments: '전반적으로 양호',
      })

      expect(updated).toBeTruthy()

      // Verify auto-transition
      const detail = await getReview(request, reviewId)
      expect(detail.status).toBe('IN_PROGRESS')
    })

    test('should submit employee review', async ({ request }) => {
      const result = await submitReview(request, reviewId)
      expect(result.status).toBe('EMPLOYEE_DONE')
      expect(result.submittedAt).toBeTruthy()
    })

    test('should reject employee edit after submission', async ({ request }) => {
      const res = await request.put(`/api/v1/performance/quarterly-reviews/${reviewId}`, {
        data: { goalHighlights: '수정 시도' },
      })
      expect(res.status()).toBe(400)
    })
  })

  test.describe('Manager updates and completes', () => {
    test.use({ storageState: authFile('MANAGER') })

    test('should see employee sections after EMPLOYEE_DONE', async ({ request }) => {
      const detail = await getReview(request, reviewId)
      expect(detail.goalHighlights).toBe('Q1 목표 잘 진행 중')
      expect(detail.status).toBe('EMPLOYEE_DONE')
    })

    test('should update manager sections', async ({ request }) => {
      const updated = await updateReviewAsManager(request, reviewId, {
        managerFeedback: '좋은 성과',
        overallSentiment: 'POSITIVE',
        coachingNotes: '지속 유지',
      })
      expect(updated).toBeTruthy()
    })

    test('should complete review via manager submit', async ({ request }) => {
      const result = await submitReview(request, reviewId)
      expect(result.status).toBe('COMPLETED')
      expect(result.submittedAt).toBeTruthy()
    })
  })

  test.describe('HR reopens completed review', () => {
    test.use({ storageState: authFile('HR_ADMIN') })

    test('should reopen completed review', async ({ request }) => {
      const result = await reopenReview(request, reviewId, '추가 수정 필요')
      expect(result.status).toBe('IN_PROGRESS')
    })

    test('should verify review is editable again', async ({ request }) => {
      const detail = await getReview(request, reviewId)
      expect(detail.status).toBe('IN_PROGRESS')
      expect(detail.employeeSubmittedAt).toBeNull()
      expect(detail.managerSubmittedAt).toBeNull()
    })

  })
})
