// ═══════════════════════════════════════════════════════════
// Cron — Vercel 네이티브 트리거 경로 가드
// Vercel cron은 GET + `Authorization: Bearer ${CRON_SECRET}` 로 호출한다.
// 이전엔 nudge-batch / loa-return-reminder / apply-scheduled-comp 가
// POST 전용 + x-cron-secret 전용이라 Vercel cron이 닿지 못해 영구 401 이었음.
// 본 스펙은 GET 핸들러 + verifyCronSecret(SSOT)의 Bearer 수용을 가드한다.
//   - GET + Bearer          → 200 (Vercel native 경로)
//   - GET + x-cron-secret   → 200 (pg_cron 경로, GET 핸들러 신설)
//   - GET (무인증)          → 401 (fail-closed)
//   - POST + Bearer         → 200 (Bearer 가 POST 에도 적용)
// ═══════════════════════════════════════════════════════════

import { test } from '@playwright/test'
import { assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import {
  cronGet,
  cronGetBearer,
  cronGetNoSecret,
  cronPostBearer,
  CRON_PATHS,
} from '../helpers/p11-fixtures'

// 세션 유무와 무관하게 cron 라우트는 secret 으로만 인가된다(기존 스펙 관행상
// SUPER_ADMIN storageState 사용 — 미들웨어 리다이렉트 회피용, 인가엔 무영향).
const REVIVED = [
  { name: 'nudge-batch', path: CRON_PATHS.NUDGE },
  { name: 'loa-return-reminder', path: CRON_PATHS.LOA_RETURN },
  { name: 'apply-scheduled-comp', path: CRON_PATHS.SCHED_COMP },
] as const

test.describe('Cron Vercel-native auth: revived routes (GET + Bearer)', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  for (const route of REVIVED) {
    test(`GET ${route.name} + Bearer -> 200`, async ({ request }) => {
      const res = await cronGetBearer(request, route.path)
      assertOk(res, `${route.name} GET Bearer`)
    })

    test(`GET ${route.name} + x-cron-secret -> 200 (new GET handler)`, async ({ request }) => {
      const res = await cronGet(request, route.path)
      assertOk(res, `${route.name} GET x-cron-secret`)
    })

    test(`GET ${route.name} no auth -> 401 (fail-closed)`, async ({ request }) => {
      const res = await cronGetNoSecret(request, route.path)
      assertError(res, 401, `${route.name} GET no secret`)
    })

    test(`POST ${route.name} + Bearer -> 200`, async ({ request }) => {
      const res = await cronPostBearer(request, route.path)
      assertOk(res, `${route.name} POST Bearer`)
    })
  }
})

// ── 핵심 회귀 가드: 세션 없이(= Vercel cron 실제 조건) 동작해야 함 ──
// 빈 storageState → NextAuth 세션 없음. 위 블록은 SUPER_ADMIN 세션을 달고 있어
// middleware carve-out 이 제거돼도 세션 때문에 라우트에 닿아 통과할 수 있다(가드 공백).
// 본 블록은 세션 없이 검증하므로, /api/v1/cron carve-out 이 제거되면 미들웨어가
// 401 로 막아 실패한다 → carve-out 회귀를 직접 고정한다.
test.describe('Cron Vercel-native auth: session-less (middleware carve-out guard)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('GET nudge-batch + Bearer, no session -> 200', async ({ request }) => {
    const res = await cronGetBearer(request, CRON_PATHS.NUDGE)
    assertOk(res, 'session-less nudge-batch GET Bearer')
  })

  test('GET nudge-batch + x-cron-secret, no session -> 200', async ({ request }) => {
    const res = await cronGet(request, CRON_PATHS.NUDGE)
    assertOk(res, 'session-less nudge-batch GET x-cron-secret')
  })

  test('GET nudge-batch no auth, no session -> 401 (route guard, not middleware)', async ({ request }) => {
    const res = await cronGetNoSecret(request, CRON_PATHS.NUDGE)
    assertError(res, 401, 'session-less nudge-batch no secret')
  })
})

// 회귀: 이미 GET 가능했던 leave-promotion(§61 법정통보)이 공유 헬퍼로 전환된 뒤에도
// 두 인가 경로 모두 정상 동작하는지 확인.
test.describe('Cron Vercel-native auth: leave-promotion regression', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('GET leave-promotion + Bearer -> 200', async ({ request }) => {
    const res = await cronGetBearer(request, CRON_PATHS.LEAVE_PROMO)
    assertOk(res, 'leave-promotion GET Bearer')
  })

  test('GET leave-promotion + x-cron-secret -> 200', async ({ request }) => {
    const res = await cronGet(request, CRON_PATHS.LEAVE_PROMO)
    assertOk(res, 'leave-promotion GET x-cron-secret')
  })

  test('GET leave-promotion no auth -> 401', async ({ request }) => {
    const res = await cronGetNoSecret(request, CRON_PATHS.LEAVE_PROMO)
    assertError(res, 401, 'leave-promotion GET no secret')
  })
})
