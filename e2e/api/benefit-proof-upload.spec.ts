// ═══════════════════════════════════════════════════════════
// CTR HR Hub — benefit claim proof upload: 보안 e2e
// 런칭 감사 P0 수정 검증 (가짜 업로드 → presigned FileUpload 단일소비).
// LoA(#183) 미러: 임의/만료/타인 uploadId 거부 · requiresProof 강제 ·
// 다운로드 authz(본인/HR/크로스테넌트) · 레거시 자유문자열 미서명.
// 실제 S3 업로드 해피패스는 자격증명 필요 → CI/preview에서만 (LoA 선례).
// ═══════════════════════════════════════════════════════════

import { test, expect, request as pwRequest } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'

const CLAIMS = '/api/v1/benefit-claims'
const PLANS = '/api/v1/benefit-plans'
const PRESIGN = '/api/v1/benefit-claims/proof/presigned'
const RANDOM_UUID = '00000000-0000-4000-8000-000000000000'

type Plan = { id: string; requiresProof: boolean; benefitType: string; amount: number | null; maxAmount: number | null }

async function resolvePlans(api: ApiClient): Promise<{ proofPlan?: Plan; plainPlan?: Plan }> {
  const res = await api.get(PLANS)
  const plans = (res.data as Plan[]) ?? []
  return {
    proofPlan: plans.find((p) => p.requiresProof),
    plainPlan: plans.find((p) => !p.requiresProof),
  }
}

function claimBody(plan: Plan, extra: Record<string, unknown> = {}) {
  const amount = plan.benefitType === 'fixed_amount' && plan.amount ? plan.amount : Math.min(10000, plan.maxAmount ?? 10000)
  return { benefitPlanId: plan.id, claimAmount: amount, ...extra }
}

test.describe('Benefit Proof Upload: EMPLOYEE', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('presign 발급 (pdf) → uploadId + post 반환', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post(PRESIGN, { filename: 'receipt.pdf', contentType: 'application/pdf', fileSize: 1024 })
    assertOk(res, 'presign issue')
    const data = res.data as { uploadId: string; post: { url: string; fields: Record<string, string> } }
    expect(data.uploadId).toBeTruthy()
    expect(data.post.url).toBeTruthy()
  })

  test('허용되지 않는 형식(text/plain) presign → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await api.post(PRESIGN, { filename: 'evil.txt', contentType: 'text/plain' })
    assertError(res, 400, 'disallowed content type')
  })

  test('requiresProof 항목을 증빙 없이 신청 → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const { proofPlan } = await resolvePlans(api)
    test.skip(!proofPlan, 'no requiresProof plan seeded for this company')
    const res = await api.post(CLAIMS, claimBody(proofPlan!))
    assertError(res, 400, 'proof required')
  })

  test('존재하지 않는 proofUploadId → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const { proofPlan, plainPlan } = await resolvePlans(api)
    const plan = proofPlan ?? plainPlan
    test.skip(!plan, 'no plan seeded')
    const res = await api.post(CLAIMS, claimBody(plan!, { proofUploadIds: [RANDOM_UUID] }))
    assertError(res, 400, 'fake uploadId rejected')
  })

  test('중복 proofUploadIds → 400', async ({ request }) => {
    const api = new ApiClient(request)
    const { proofPlan, plainPlan } = await resolvePlans(api)
    const plan = proofPlan ?? plainPlan
    test.skip(!plan, 'no plan seeded')
    const res = await api.post(CLAIMS, claimBody(plan!, { proofUploadIds: [RANDOM_UUID, RANDOM_UUID] }))
    assertError(res, 400, 'duplicate uploadIds rejected')
  })

  test('타인의 uploadId 는 소비 불가 (400)', async ({ request }) => {
    // employee-b 가 presign 발급 → employee-a 가 그 uploadId 로 신청 시도
    const bCtx = await pwRequest.newContext({ storageState: authFile('EMPLOYEE_C') })
    const bApi = new ApiClient(bCtx)
    const presign = await bApi.post(PRESIGN, { filename: 'other.pdf', contentType: 'application/pdf', fileSize: 512 })
    const otherUploadId = (presign.data as { uploadId: string } | undefined)?.uploadId ?? ''
    await bCtx.dispose()
    expect(otherUploadId, 'failed to issue presign as EMPLOYEE_C').toBeTruthy()

    const api = new ApiClient(request)
    const { proofPlan, plainPlan } = await resolvePlans(api)
    const plan = proofPlan ?? plainPlan
    test.skip(!plan, 'no plan seeded')
    const res = await api.post(CLAIMS, claimBody(plan!, { proofUploadIds: [otherUploadId] }))
    assertError(res, 400, 'another employee uploadId rejected')
  })
})

test.describe('Benefit Proof Download: authz', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  let ownClaimId = ''

  test.beforeAll(async () => {
    // 증빙 불요 항목으로 본인 청구 하나 생성 (proofPaths 빈 배열 — 다운로드 라우트 authz 검증용)
    const ctx = await pwRequest.newContext({ storageState: authFile('EMPLOYEE') })
    const api = new ApiClient(ctx)
    const { plainPlan } = await resolvePlans(api)
    if (plainPlan) {
      const res = await api.post(CLAIMS, claimBody(plainPlan))
      ownClaimId = (res.data as { id: string } | undefined)?.id ?? ''
    }
    await ctx.dispose()
  })

  test('본인 청구 증빙 목록 조회 200 (빈 배열 OK)', async ({ request }) => {
    test.skip(!ownClaimId, 'no claim created (no proof-free plan seeded)')
    const api = new ApiClient(request)
    const res = await api.get(`${CLAIMS}/${ownClaimId}/proof`)
    assertOk(res, 'own proof list')
    expect(Array.isArray((res.data as { files: unknown[] }).files)).toBe(true)
  })

  test('타 법인 HR 은 증빙 조회 403', async () => {
    test.skip(!ownClaimId, 'no claim created')
    const cnCtx = await pwRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
    const cnApi = new ApiClient(cnCtx)
    const res = await cnApi.get(`${CLAIMS}/${ownClaimId}/proof`)
    await cnCtx.dispose()
    assertError(res, 403, 'cross-company HR blocked')
  })

  test('같은 법인 HR 은 증빙 조회 200', async () => {
    test.skip(!ownClaimId, 'no claim created')
    const hrCtx = await pwRequest.newContext({ storageState: authFile('HR_ADMIN') })
    const hrApi = new ApiClient(hrCtx)
    const res = await hrApi.get(`${CLAIMS}/${ownClaimId}/proof`)
    await hrCtx.dispose()
    assertOk(res, 'same-company HR allowed')
  })

  test('동료 직원은 타인 청구 증빙 조회 403', async () => {
    test.skip(!ownClaimId, 'no claim created')
    const cCtx = await pwRequest.newContext({ storageState: authFile('EMPLOYEE_C') })
    const cApi = new ApiClient(cCtx)
    const res = await cApi.get(`${CLAIMS}/${ownClaimId}/proof`)
    await cCtx.dispose()
    assertError(res, 403, 'peer employee blocked')
  })
})
