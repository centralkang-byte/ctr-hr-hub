// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LoA proof upload: RBAC + proof-binding 보안 e2e
// PR-5: 직원 본인신청 RBAC · 대리신청 leave:manage · 크로스테넌트 차단 ·
//        proofUploadId 단일소비·검증(임의/만료/타인 거부) · presign 권한.
// 실제 S3 업로드(해피패스)는 자격증명 필요 → 별도 describe(자격증명 없으면 skip).
// ═══════════════════════════════════════════════════════════

import { test, expect, request as pwRequest } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { resolveSeedData, resolveEmployeeId, TEST_ACCOUNTS } from '../helpers/test-data'
import * as f from '../helpers/loa-discipline-misc-fixtures'

const LOA = '/api/v1/leave-of-absence'
const PRESIGN = '/api/v1/leave-of-absence/proof/presigned'
const RANDOM_UUID = '00000000-0000-4000-8000-000000000000'

// 셋업: requiresProof 유형 + 일반 유형(HR), CTR-CN 직원 1명(크로스테넌트 검증용)
let proofTypeId = ''
let plainTypeId = ''
let ctrCnEmployeeId = ''

test.beforeAll(async () => {
  const hrCtx = await pwRequest.newContext({ storageState: authFile('HR_ADMIN') })
  const hrApi = new ApiClient(hrCtx)
  const proof = await f.createLoaType(hrApi, {
    ...f.buildLoaType('PROOF'),
    requiresProof: true,
  })
  assertOk(proof, 'create requiresProof type')
  proofTypeId = (proof.data as { id: string }).id
  const plain = await f.createLoaType(hrApi, f.buildLoaType('PLAIN'))
  assertOk(plain, 'create plain type')
  plainTypeId = (plain.data as { id: string }).id
  await hrCtx.dispose()

  const cnCtx = await pwRequest.newContext({ storageState: authFile('HR_ADMIN_CN') })
  const cnApi = new ApiClient(cnCtx)
  const emps = await cnApi.get('/api/v1/employees?limit=10')
  const cnList = (emps.data as Array<{ id: string }>) ?? []
  ctrCnEmployeeId = cnList[0]?.id ?? ''
  await cnCtx.dispose()
})

async function otherSameCompanyEmployeeId(api: ApiClient, selfId: string): Promise<string> {
  const res = await api.get('/api/v1/employees?limit=50')
  const list = (res.data as Array<{ id: string }>) ?? []
  const other = list.find((e) => e.id !== selfId)
  if (!other) throw new Error('동일 법인 다른 직원을 찾지 못했습니다.')
  return other.id
}

// ─── EMPLOYEE: 본인 신청 RBAC + 증빙 검증 ────────────────
test.describe('LoA proof — EMPLOYEE self-request', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  test('본인 신청(증빙불요 유형)은 허용된다 — 직원 self-request 복구', async ({ request }) => {
    const api = new ApiClient(request)
    const { employeeId } = await resolveSeedData(request)
    const res = await api.post(LOA, { ...f.buildLoaRecord(employeeId, plainTypeId) })
    assertOk(res, 'employee self-request (no proof)')
  })

  test('증빙 필수 유형을 proofUploadId 없이 제출하면 400', async ({ request }) => {
    const api = new ApiClient(request)
    const { employeeId } = await resolveSeedData(request)
    const res = await api.post(LOA, { ...f.buildLoaRecord(employeeId, proofTypeId) })
    assertError(res, 400, 'requiresProof without proof → 400')
  })

  test('존재하지 않는 proofUploadId 는 거부된다(400)', async ({ request }) => {
    const api = new ApiClient(request)
    const { employeeId } = await resolveSeedData(request)
    const res = await api.post(LOA, {
      ...f.buildLoaRecord(employeeId, proofTypeId),
      proofUploadId: RANDOM_UUID,
    })
    assertError(res, 400, 'bogus proofUploadId → 400')
  })

  test('다른 직원 대리 신청은 금지된다(403)', async ({ request }) => {
    const api = new ApiClient(request)
    const { employeeId } = await resolveSeedData(request)
    const otherId = await otherSameCompanyEmployeeId(api, employeeId)
    const res = await api.post(LOA, { ...f.buildLoaRecord(otherId, plainTypeId) })
    assertError(res, 403, 'employee on-behalf other → 403')
  })
})

// ─── MANAGER: 대리신청 BOLA 차단 ─────────────────────────
test.describe('LoA proof — MANAGER', () => {
  test.use({ storageState: authFile('MANAGER') })

  test('매니저는 다른 직원 대리 신청 불가(403) — BOLA 차단', async ({ request }) => {
    const api = new ApiClient(request)
    const { employeeId } = await resolveSeedData(request)
    const otherId = await otherSameCompanyEmployeeId(api, employeeId)
    const res = await api.post(LOA, { ...f.buildLoaRecord(otherId, plainTypeId) })
    assertError(res, 403, 'manager on-behalf → 403')
  })

  test('매니저 본인 신청은 허용(leave:update)', async ({ request }) => {
    const api = new ApiClient(request)
    // self 판정은 "신청 대상 == 호출자 본인"이다. resolveSeedData 는 고정 시드 직원
    // (이민준)을 돌려주므로 매니저(박준혁) 본인이 아니다 → 대리신청으로 403 처리됨.
    // 매니저 자신의 employeeId 를 직접 해소해 본인 신청 경로를 검증한다.
    const selfId = await resolveEmployeeId(request, TEST_ACCOUNTS.MANAGER.name)
    const res = await api.post(LOA, { ...f.buildLoaRecord(selfId, plainTypeId) })
    assertOk(res, 'manager self-request')
  })
})

// ─── HR_ADMIN: 대리신청 허용 + 크로스테넌트 차단 ─────────
test.describe('LoA proof — HR_ADMIN on-behalf + tenant isolation', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  test('HR 는 같은 법인 직원 대리 신청 가능(200)', async ({ request }) => {
    const api = new ApiClient(request)
    const { employeeId } = await resolveSeedData(request)
    const otherId = await otherSameCompanyEmployeeId(api, employeeId)
    const res = await api.post(LOA, { ...f.buildLoaRecord(otherId, plainTypeId) })
    assertOk(res, 'HR on-behalf same-company')
  })

  test('HR 가 타 법인(CTR-CN) 직원으로 신청하면 404 — 크로스테넌트 차단', async ({ request }) => {
    test.skip(!ctrCnEmployeeId, 'CTR-CN 직원 미해결 — skip')
    const api = new ApiClient(request)
    const res = await api.post(LOA, { ...f.buildLoaRecord(ctrCnEmployeeId, plainTypeId) })
    assertError(res, 404, 'cross-company employeeId → 404')
  })
})

// ─── Presign endpoint 권한 ───────────────────────────────
test.describe('LoA proof — presign endpoint', () => {
  test('EMPLOYEE 는 pdf presign 발급 가능(uploadId+post 반환)', async () => {
    const ctx = await pwRequest.newContext({ storageState: authFile('EMPLOYEE') })
    const api = new ApiClient(ctx)
    const res = await api.post(PRESIGN, {
      filename: 'proof.pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
    })
    assertOk(res, 'employee presign pdf')
    const d = res.data as { uploadId: string; post: { url: string; fields: Record<string, string> } }
    expect(d.uploadId).toBeTruthy()
    expect(d.post?.url).toBeTruthy()
    expect(d.post?.fields).toBeTruthy()
    await ctx.dispose()
  })

  test('허용되지 않는 형식(text/plain)은 400', async () => {
    const ctx = await pwRequest.newContext({ storageState: authFile('EMPLOYEE') })
    const api = new ApiClient(ctx)
    const res = await api.post(PRESIGN, {
      filename: 'note.txt',
      contentType: 'text/plain',
      fileSize: 100,
    })
    assertError(res, 400, 'disallowed content type → 400')
    await ctx.dispose()
  })

  test('EXECUTIVE(leave:read only)는 presign 금지(403)', async () => {
    const ctx = await pwRequest.newContext({ storageState: authFile('EXECUTIVE') })
    const api = new ApiClient(ctx)
    const res = await api.post(PRESIGN, {
      filename: 'proof.pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
    })
    assertError(res, 403, 'executive presign → 403')
    await ctx.dispose()
  })
})

// ─── 실제 S3 해피패스 (자격증명 필요 → 없으면 skip) ───────
test.describe('LoA proof — real S3 upload (creds-gated)', () => {
  test.skip(
    !process.env.AWS_ACCESS_KEY_ID || !process.env.S3_BUCKET,
    'AWS 자격증명 미설정 — 실제 presign→POST→HEAD→제출 통합 테스트 skip (CI/스테이징에서 실행)',
  )
  test.use({ storageState: authFile('EMPLOYEE') })

  test('증빙 업로드 후 증빙필수 휴직 신청 성공', async ({ request }) => {
    const api = new ApiClient(request)
    const { employeeId } = await resolveSeedData(request)

    // 1) presign
    const presign = await api.post(PRESIGN, {
      filename: 'proof.pdf',
      contentType: 'application/pdf',
      fileSize: 5,
    })
    assertOk(presign, 'presign')
    const { uploadId, post } = presign.data as {
      uploadId: string
      post: { url: string; fields: Record<string, string> }
    }

    // 2) S3 직접 POST (정책 fields + 파일)
    const form: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
      ...post.fields,
      file: { name: 'proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
    }
    const s3 = await request.post(post.url, { multipart: form })
    expect(s3.ok()).toBe(true)

    // 3) 증빙 첨부 제출
    const res = await api.post(LOA, {
      ...f.buildLoaRecord(employeeId, proofTypeId),
      proofUploadId: uploadId,
    })
    assertOk(res, 'submit with real proof')

    // 4) 동일 uploadId 재사용은 거부(단일 소비)
    const reuse = await api.post(LOA, {
      ...f.buildLoaRecord(employeeId, proofTypeId),
      proofUploadId: uploadId,
    })
    assertError(reuse, 400, 'consumed uploadId reuse → 400')
  })
})
