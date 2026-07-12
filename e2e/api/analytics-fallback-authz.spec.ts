// ═══════════════════════════════════════════════════════════
// CTR HR Hub — analytics 권한 폴백 액션 한정 e2e
// 런칭 감사 P1: hasPermission() ANALYTICS 폴백이 action 을 무시해
// MANAGER/EXECUTIVE 가 HR 전용 배치 계산 라우트를 직접 호출 가능했음.
// 수정: 폴백을 ACTION.VIEW 로 한정 + employee-risk recalculate 분기 HR 가드.
// ═══════════════════════════════════════════════════════════

import { test } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

const RANDOM_UUID = '00000000-0000-4000-8000-000000000000'

test.describe('Analytics fallback: MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('POST /analytics/calculate → 403 (CREATE 폴백 차단)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post('/api/v1/analytics/calculate', {})
    assertError(res, 403, 'manager cannot trigger batch calculate')
  })

  test('GET /analytics/employee-risk?recalculate=true → 403 (mutating VIEW 분기 가드)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.get('/api/v1/analytics/employee-risk', {
      employee_id: RANDOM_UUID,
      recalculate: 'true',
    })
    assertError(res, 403, 'manager cannot force recalculation')
  })
})

test.describe('Analytics fallback: EXECUTIVE', () => {
  test.use({ storageState: authFile('EXECUTIVE') })

  test('POST /attrition/recalculate → 403 (APPROVE 폴백 차단)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post('/api/v1/attrition/recalculate')
    assertError(res, 403, 'executive cannot trigger recalculation')
  })

  test('GET analytics VIEW 라우트는 여전히 200 (읽기 폴백 보존 회귀)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.get('/api/v1/analytics/workforce/overview')
    assertOk(res, 'executive keeps analytics read access')
  })
})

test.describe('Analytics fallback: HR_ADMIN regression', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('HR 는 seed 권한으로 calculate 여전히 가능 (200/처리)', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post('/api/v1/analytics/calculate', {})
    assertOk(res, 'HR_ADMIN batch calculate')
  })
})
