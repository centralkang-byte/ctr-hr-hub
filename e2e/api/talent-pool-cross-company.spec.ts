// ═══════════════════════════════════════════════════════════
// Talent Pool 멀티테넌트 격리 — companyId anchor (P0 PII 누출 차단)
//   GET/POST /api/v1/recruitment/talent-pool · PATCH /talent-pool/[id]
//   GET /api/v1/recruitment/applicants/[id]/timeline
// 시나리오 (CTR-CN HR → CTR 리소스 차단 + SUPER 전사 + 회귀):
//   · 목록: CTR-CN HR 은 CTR 풀 항목/회사 0건
//   · PATCH by-id: CTR 항목 id → 404 (IDOR 차단)
//   · POST: CTR 전용 후보(출처 없음) → 403 (자사 지원이력 없음)
//   · POST: CTR 후보 + 자사 CTR-CN 공고(우회 시도) → 403 (Codex G2 P0 회귀)
//   · timeline: CTR 전용 후보 → 404
//   · SUPER: 전사 풀 조회(CTR 항목 포함)
//   · 회귀: CTR HR 은 자사 항목 정상 조회
// 픽스처는 beforeAll 에서 확정 확보(없으면 throw — silent skip-pass 방지).
// ═══════════════════════════════════════════════════════════

import { test, expect, request as playwrightRequest } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import type { RoleType } from '../helpers/auth'

async function clientFor(role: RoleType) {
  const ctx = await playwrightRequest.newContext({ storageState: authFile(role) })
  return { ctx, api: new ApiClient(ctx) }
}

function asArray<T = Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const d = data as { data?: T[]; items?: T[] }
  return d?.data ?? d?.items ?? []
}

const TP = '/api/v1/recruitment/talent-pool'

test.describe('talent-pool cross-tenant isolation', () => {
  test.describe.configure({ mode: 'serial' })

  let ctrCompanyId = ''
  let ctrEntryId = ''
  let ctrApplicantId = ''
  let ctrcnPostingId = ''

  test.beforeAll(async () => {
    // ── CTR(국내) 풀 항목 픽스처 (기존 재사용 or board 후보로 생성) ──
    const ctr = await clientFor('HR_ADMIN')
    const jg = await ctr.api.get('/api/v1/job-grades')
    ctrCompanyId = asArray<{ companyId?: string }>(jg.data).find((g) => g.companyId)?.companyId ?? ''

    const list = await ctr.api.get(TP, { limit: '100' })
    const existing = asArray<{ id?: string; applicant?: { id?: string } }>(list.data)[0]
    if (existing?.id) {
      ctrEntryId = existing.id
      ctrApplicantId = existing.applicant?.id ?? ''
    } else {
      const board = await ctr.api.get('/api/v1/recruitment/board')
      const postings =
        (board.data as { postings?: Array<{ applications?: Array<{ applicant?: { id?: string } }> }> })
          ?.postings ?? []
      for (const p of postings) {
        const a = (p.applications ?? []).find((x) => x.applicant?.id)
        if (a?.applicant?.id) {
          ctrApplicantId = a.applicant.id
          break
        }
      }
      if (ctrApplicantId) {
        const created = await ctr.api.post(TP, {
          applicantId: ctrApplicantId,
          poolReason: 'manual',
          consentGiven: true,
        })
        assertOk(created, 'create CTR talent-pool fixture')
        ctrEntryId = (created.data as { id?: string })?.id ?? ''
      }
    }
    await ctr.ctx.dispose()

    // ── CTR-CN 자사 공고 1건 + 픽스처 후보가 'CTR 전용'인지 확정 ──
    const cn = await clientFor('HR_ADMIN_CN')
    const cnPostings = await cn.api.get('/api/v1/recruitment/postings', { limit: '20' })
    ctrcnPostingId = asArray<{ id?: string }>(cnPostings.data)[0]?.id ?? ''
    // 선택한 CTR 후보가 CTR-CN 관점에서 비가시(timeline 404)여야 격리 테스트가 유효 —
    // 공유(다법인 지원) 후보면 403/404 단언이 의미를 잃으므로 throw 로 loud-fail.
    const cnTimeline = ctrApplicantId
      ? await cn.api.get(`/api/v1/recruitment/applicants/${ctrApplicantId}/timeline`)
      : null
    await cn.ctx.dispose()

    if (!ctrEntryId || !ctrApplicantId || !ctrcnPostingId) {
      throw new Error(
        `talent-pool 픽스처 미확보: entry=${!!ctrEntryId} applicant=${!!ctrApplicantId} cnPosting=${!!ctrcnPostingId}`,
      )
    }
    if (cnTimeline?.status !== 404) {
      throw new Error(
        `픽스처 후보(${ctrApplicantId})가 CTR-CN 에 노출됨(status ${cnTimeline?.status}) — CTR 전용 후보가 아님`,
      )
    }
  })

  test('CTR-CN HR 목록 → CTR 항목/회사 0건', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get(TP, { limit: '100' })
    expect(res.status).toBe(200)
    const rows = asArray<{ id?: string; companyId?: string }>(res.data)
    expect(rows.map((r) => r.id), 'CTR 풀 항목이 CTR-CN HR 에 누출되면 안 됨').not.toContain(ctrEntryId)
    expect(rows.filter((r) => r.companyId === ctrCompanyId).length, 'CTR 회사 항목 0건').toBe(0)
    await ctx.dispose()
  })

  test('CTR-CN HR PATCH CTR 항목 id → 404 (IDOR 차단)', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.patch(`${TP}/${ctrEntryId}`, { status: 'contacted' })
    assertError(res, 404, 'CTR-CN HR 은 CTR 풀 항목 수정 불가')
    await ctx.dispose()
  })

  test('CTR-CN HR POST CTR 전용 후보(출처 없음) → 403', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post(TP, { applicantId: ctrApplicantId, poolReason: 'manual' })
    assertError(res, 403, 'CTR-CN HR 은 CTR 전용 후보를 풀에 등록 불가')
    await ctx.dispose()
  })

  test('CTR-CN HR POST CTR 후보 + 자사 CTR-CN 공고(우회 시도) → 403', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.post(TP, {
      applicantId: ctrApplicantId,
      sourcePostingId: ctrcnPostingId,
      poolReason: 'manual',
    })
    assertError(res, 403, '자사 공고를 끼워도 타 법인 후보 흡수 불가 (소유권 게이트)')
    await ctx.dispose()
  })

  test('CTR-CN HR timeline CTR 전용 후보 → 404', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN_CN')
    const res = await api.get(`/api/v1/recruitment/applicants/${ctrApplicantId}/timeline`)
    assertError(res, 404, 'CTR-CN HR 은 CTR 후보 타임라인 조회 불가')
    await ctx.dispose()
  })

  test('SUPER 목록 → CTR 항목 포함 (전사)', async () => {
    const { ctx, api } = await clientFor('SUPER_ADMIN')
    const res = await api.get(TP, { limit: '100' })
    expect(res.status).toBe(200)
    expect(asArray<{ id?: string }>(res.data).map((r) => r.id), 'SUPER 는 전사 풀 조회').toContain(
      ctrEntryId,
    )
    await ctx.dispose()
  })

  test('회귀: CTR HR 목록 → 자사 항목 포함', async () => {
    const { ctx, api } = await clientFor('HR_ADMIN')
    const res = await api.get(TP, { limit: '100' })
    expect(res.status).toBe(200)
    expect(asArray<{ id?: string }>(res.data).map((r) => r.id), 'CTR HR 은 자사 항목 조회').toContain(
      ctrEntryId,
    )
    await ctx.dispose()
  })
})
