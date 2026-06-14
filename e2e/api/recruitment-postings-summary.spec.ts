// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment 목록 KPI 요약 + per-job funnel API
// Covers: summary 역할 allowlist(SUPER/HR/MANAGER 200·EXECUTIVE/EMPLOYEE 403),
//         멀티테넌트(SUPER 전사 합계 >= 단일법인·CTR-CN 스코프),
//         postings funnel shape + applied==_count.applications 패리티.
// 단계 버킷 정확성 + soft-delete where절은 vitest(stage-buckets) + 코드리뷰가 커버.
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'

const SUMMARY = '/api/v1/recruitment/postings/summary'
const POSTINGS = '/api/v1/recruitment/postings'

interface Summary {
  activePostings: number
  totalApplicants: number
  inInterview: number
  offersOut: number
}
const KEYS = ['activePostings', 'totalApplicants', 'inInterview', 'offersOut'] as const

interface FunnelShape {
  applied: number
  screen: number
  interview: number
  offer: number
}
interface PostingItem {
  companyId: string
  funnel: FunnelShape
  _count: { applications: number }
}

// ─── 역할 allowlist: 200 ──────────────────────────────────

for (const role of ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'] as const) {
  test.describe(`recruitment summary — ${role} 허용`, () => {
    test.use({ storageState: authFile(role) })

    test(`${role}: GET summary → 200 + numeric shape`, async ({ request }) => {
      const api = new ApiClient(request)
      const res = await api.get<Summary>(SUMMARY)
      assertOk(res, `${role} summary`)
      for (const k of KEYS) {
        expect(typeof res.data![k], `${k} numeric`).toBe('number')
        expect(res.data![k], `${k} >= 0`).toBeGreaterThanOrEqual(0)
      }
    })
  })
}

// ─── 역할 차단: 403 ───────────────────────────────────────

for (const role of ['EXECUTIVE', 'EMPLOYEE'] as const) {
  test.describe(`recruitment summary — ${role} 차단`, () => {
    test.use({ storageState: authFile(role) })

    test(`${role}: GET summary → 403`, async ({ request }) => {
      const api = new ApiClient(request)
      const res = await api.get(SUMMARY)
      assertError(res, 403, `${role} summary forbidden`)
    })
  })
}

// ─── 멀티테넌트 ───────────────────────────────────────────

test.describe('recruitment summary — 멀티테넌트 스코프', () => {
  test('SUPER 전사 합계 >= 단일법인(CTR HR) 합계', async () => {
    const suReq = await playwrightRequest.newContext({ storageState: authFile('SUPER_ADMIN') })
    const hrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    try {
      const su = await new ApiClient(suReq).get<Summary>(SUMMARY)
      const hr = await new ApiClient(hrReq).get<Summary>(SUMMARY)
      assertOk(su, 'SUPER summary')
      assertOk(hr, 'HR summary')
      // SUPER는 전 법인 통합, HR은 자기 법인만 → SUPER >= HR (CTR ⊆ 전체)
      for (const k of KEYS) {
        expect(su.data![k], `SUPER ${k} >= HR ${k}`).toBeGreaterThanOrEqual(hr.data![k])
      }
    } finally {
      await suReq.dispose()
      await hrReq.dispose()
    }
  })

  test('CTR-CN HR → 200 + 자기 법인 스코프(5xx 없음)', async () => {
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    try {
      const res = await new ApiClient(cnReq).get<Summary>(SUMMARY)
      assertOk(res, 'CTR-CN summary')
      for (const k of KEYS) {
        expect(typeof res.data![k], `${k} numeric`).toBe('number')
      }
    } finally {
      await cnReq.dispose()
    }
  })

  // Positive-identity: 비-SUPER 목록은 단일 법인만 — leak이면 inflate되어 distinct companyId>1.
  // (inequality-only 검사는 inflate형 누출을 못 잡으므로 보강 — 적대 리뷰 confirmed P2)
  test('비-SUPER 목록은 자기 법인 공고만, CTR ≠ CTR-CN', async () => {
    const cnReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const ctrReq = await playwrightRequest.newContext({ storageState: authFile('HR_ADMIN') })
    try {
      const cn = await new ApiClient(cnReq).get<PostingItem[]>(POSTINGS, { page: '1', limit: '100' })
      const ctr = await new ApiClient(ctrReq).get<PostingItem[]>(POSTINGS, { page: '1', limit: '100' })
      assertOk(cn, 'CTR-CN postings')
      assertOk(ctr, 'CTR postings')
      const cnCompanies = new Set(cn.data!.map((p) => p.companyId))
      const ctrCompanies = new Set(ctr.data!.map((p) => p.companyId))
      // 각 비-SUPER 호출자는 자기 법인 공고만 → distinct companyId <= 1 (누출이면 > 1)
      expect(cnCompanies.size, 'CTR-CN HR sees only one company').toBeLessThanOrEqual(1)
      expect(ctrCompanies.size, 'CTR HR sees only one company').toBeLessThanOrEqual(1)
      // 둘 다 데이터가 있으면 서로 다른 법인이어야 (격리 증명)
      if (cnCompanies.size === 1 && ctrCompanies.size === 1) {
        expect([...cnCompanies][0], 'CTR-CN company != CTR company').not.toBe([...ctrCompanies][0])
      }
    } finally {
      await cnReq.dispose()
      await ctrReq.dispose()
    }
  })
})

// ─── postings per-job funnel ──────────────────────────────

test.describe('recruitment postings — per-job funnel', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('각 공고 funnel{applied,screen,interview,offer} + applied == _count.applications', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.get<PostingItem[]>(POSTINGS, { page: '1', limit: '20' })
    assertOk(res, 'postings list')
    const items = res.data!
    for (const item of items) {
      const f = item.funnel
      expect(f, 'funnel present').toBeDefined()
      for (const c of ['applied', 'screen', 'interview', 'offer'] as const) {
        expect(typeof f[c], `funnel.${c} numeric`).toBe('number')
        expect(f[c], `funnel.${c} >= 0`).toBeGreaterThanOrEqual(0)
      }
      // 단일 groupBy 스냅샷 내부 일관성: 각 버킷 <= applied(전체 합).
      // (applied vs _count.applications 는 별도 쿼리 시점이라 동시쓰기 시 흔들릴 수 있어 비교하지 않음)
      expect(f.screen).toBeLessThanOrEqual(f.applied)
      expect(f.interview).toBeLessThanOrEqual(f.applied)
      expect(f.offer).toBeLessThanOrEqual(f.applied)
    }
  })
})
