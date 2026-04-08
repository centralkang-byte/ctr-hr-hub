// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment Pipeline API Tests
// Covers: postings CRUD, applicants, applications stage
// transitions, offer flow, RBAC boundaries.
// ═══════════════════════════════════════════════════════════

import { test, expect } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { resolveSeedData, resolveEmployeeId } from '../helpers/test-data'
import {
  listPostings,
  createPosting,
  getPosting,
  updatePosting,
  deletePosting,
  publishPosting,
  closePosting,
  listPostingApplicants,
  addApplicantToPosting,
  getApplicant,
  updateApplicant,
  getApplicantTimeline,
  checkDuplicate,
  changeStage,
  sendOffer,
  respondOffer,
  checkCandidate,
  buildPosting,
  buildApplicant,
  resolveSeedPosting,
  futureDateStr,
} from '../helpers/recruitment-fixtures'

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: Posting CRUD
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: Posting CRUD', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let seedData: Awaited<ReturnType<typeof resolveSeedData>>
  let createdPostingId: string
  let publishedPostingId: string
  const cleanupPostingIds: string[] = []

  test.beforeAll(async ({ request }) => {
    seedData = await resolveSeedData(request)
  })

  test.afterAll(async ({ request }) => {
    const api = new ApiClient(request)
    for (const id of cleanupPostingIds) {
      await deletePosting(api, id).catch(() => {})
    }
  })

  test('GET /postings returns paginated list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await listPostings(api, { page: '1', limit: '5' })
    assertOk(res, 'list postings')
    expect(Array.isArray(res.data)).toBe(true)
    expect((res.data as unknown[]).length).toBeGreaterThan(0)
    if (res.pagination) {
      expect(res.pagination.page).toBe(1)
    }
  })

  test('GET /postings?status=OPEN filters correctly', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await listPostings(api, { status: 'OPEN' })
    assertOk(res, 'filter OPEN')
    const items = res.data as Array<Record<string, unknown>>
    for (const item of items) {
      expect(item.status).toBe('OPEN')
    }
  })

  test('GET /postings?search=생산기술 finds matching posting', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await listPostings(api, { search: '생산기술' })
    assertOk(res, 'search 생산기술')
    const items = res.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
    expect(items.some((p) => (p.title as string).includes('생산기술'))).toBe(true)
  })

  test('POST /postings creates DRAFT posting', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await createPosting(api, buildPosting('crud'))
    assertOk(res, 'create posting')
    const data = res.data as Record<string, unknown>
    expect(data.status).toBe('DRAFT')
    expect(data.id).toBeTruthy()
    createdPostingId = data.id as string
    cleanupPostingIds.push(createdPostingId)
  })

  test('GET /postings/[id] returns created posting', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await getPosting(api, createdPostingId)
    assertOk(res, 'get posting detail')
    const data = res.data as Record<string, unknown>
    expect(data.id).toBe(createdPostingId)
    expect(data.status).toBe('DRAFT')
  })

  test('PUT /postings/[id] updates title', async ({ request }) => {
    const api = new ApiClient(request)
    const newTitle = `Updated Title ${Date.now()}`
    const res = await updatePosting(api, createdPostingId, { title: newTitle })
    assertOk(res, 'update posting')
    const data = res.data as Record<string, unknown>
    expect(data.title).toBe(newTitle)
  })

  test('PUT /postings/[id]/publish with required fields succeeds', async ({ request }) => {
    const api = new ApiClient(request)
    // First set required fields for publish
    const recruiterId = await resolveEmployeeId(request, '한지영')
    await updatePosting(api, createdPostingId, {
      departmentId: seedData.departmentId,
      jobGradeId: seedData.jobGradeId,
      recruiterId,
    })
    const res = await publishPosting(api, createdPostingId)
    assertOk(res, 'publish posting')
    const data = res.data as Record<string, unknown>
    expect(data.status).toBe('OPEN')
    publishedPostingId = createdPostingId
  })

  test('PUT /postings/[id]/publish on non-DRAFT returns 400', async ({ request }) => {
    const api = new ApiClient(request)
    // publishedPostingId is now OPEN, not DRAFT
    const res = await publishPosting(api, publishedPostingId)
    assertError(res, 400, 'publish non-DRAFT')
  })

  test('PUT /postings/[id]/close on OPEN posting succeeds', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await closePosting(api, publishedPostingId)
    assertOk(res, 'close posting')
    const data = res.data as Record<string, unknown>
    expect(data.status).toBe('CLOSED')
  })

  test('DELETE /postings/[id] on fresh DRAFT succeeds', async ({ request }) => {
    const api = new ApiClient(request)
    // Create a fresh DRAFT to delete
    const createRes = await createPosting(api, buildPosting('del'))
    assertOk(createRes, 'create for delete')
    const newId = (createRes.data as Record<string, unknown>).id as string
    const delRes = await deletePosting(api, newId)
    assertOk(delRes, 'delete DRAFT posting')
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: Applicants + Applications
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: Applicants + Applications', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let seedPostingId: string
  let newApplicationId: string
  let stageTestAppId: string
  let applicantEmail: string
  let seedApplicantId: string

  test.beforeAll(async ({ request }) => {
    const api = new ApiClient(request)
    const posting = await resolveSeedPosting(api)
    seedPostingId = posting.id as string
  })

  test('GET /postings/[id]/applicants returns list', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await listPostingApplicants(api, seedPostingId, { limit: '50' })
    assertOk(res, 'list applicants')
    const items = res.data as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThan(0)
    // Capture an applicant ID for timeline test
    seedApplicantId = (items[0].applicant as Record<string, unknown>)?.id as string
      ?? items[0].applicantId as string
  })

  test('POST /postings/[id]/applicants adds new applicant', async ({ request }) => {
    const api = new ApiClient(request)
    const applicant = buildApplicant('pipe')
    applicantEmail = applicant.email
    const res = await addApplicantToPosting(api, seedPostingId, applicant)
    assertOk(res, 'add applicant')
    const data = res.data as Record<string, unknown>
    expect(data.id).toBeTruthy()
    newApplicationId = data.id as string
  })

  test('POST /postings/[id]/applicants duplicate email returns 409', async ({ request }) => {
    const api = new ApiClient(request)
    const dup = buildApplicant('dup')
    dup.email = applicantEmail
    const res = await addApplicantToPosting(api, seedPostingId, dup)
    // Unique constraint on (postingId, applicantId) — may be 400 or 409
    expect([400, 409]).toContain(res.status)
  })

  test('GET /applicants/[id] returns application detail', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await getApplicant(api, newApplicationId)
    assertOk(res, 'get applicant detail')
    const data = res.data as Record<string, unknown>
    expect(data.id ?? data.applicant).toBeTruthy()
  })

  test('PUT /applicants/[id] updates AI screening score', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await updateApplicant(api, newApplicationId, {
      aiScreeningScore: 85,
      aiScreeningSummary: 'E2E 테스트 AI 평가: 우수',
    })
    assertOk(res, 'update applicant')
  })

  test('GET /applicants/[id]/timeline returns events', async ({ request }) => {
    const api = new ApiClient(request)
    // timeline endpoint uses Applicant ID (not Application ID)
    const res = await getApplicantTimeline(api, seedApplicantId)
    assertOk(res, 'get timeline')
    const data = res.data as Record<string, unknown>
    expect(data.events ?? data.timeline ?? res.body.data).toBeTruthy()
  })

  test('POST /applicants/check-duplicate detects email match', async ({ request }) => {
    const api = new ApiClient(request)
    // check-duplicate requires both name and email (Codex G1 #1)
    const res = await checkDuplicate(api, { name: '테스트지원자', email: applicantEmail })
    assertOk(res, 'check duplicate')
    const data = res.data as Record<string, unknown>
    const duplicates = data.duplicates as unknown[] | undefined
    const hasDups = data.hasDuplicates ?? (duplicates && duplicates.length > 0)
    expect(hasDups).toBeTruthy()
  })

  test('PUT /applications/[id]/stage APPLIED→SCREENING succeeds', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await changeStage(api, newApplicationId, { stage: 'SCREENING' })
    assertOk(res, 'APPLIED→SCREENING')
    const data = res.data as Record<string, unknown>
    expect(data.stage).toBe('SCREENING')
    stageTestAppId = newApplicationId
  })

  test('PUT /applications/[id]/stage SCREENING→INTERVIEW_1 succeeds', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await changeStage(api, stageTestAppId, { stage: 'INTERVIEW_1' })
    assertOk(res, 'SCREENING→INTERVIEW_1')
    expect((res.data as Record<string, unknown>).stage).toBe('INTERVIEW_1')
  })

  test('PUT /applications/[id]/stage backward INTERVIEW_1→APPLIED returns 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await changeStage(api, stageTestAppId, { stage: 'APPLIED' })
    assertError(res, 400, 'backward transition blocked')
  })

  test('PUT /applications/[id]/stage REJECTED without reason returns 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await changeStage(api, stageTestAppId, { stage: 'REJECTED' })
    assertError(res, 400, 'REJECTED no reason')
  })

  test('PUT /applications/[id]/stage REJECTED with reason succeeds', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await changeStage(api, stageTestAppId, {
      stage: 'REJECTED',
      rejectionReason: 'E2E 테스트 반려 사유',
    })
    assertOk(res, 'REJECTED with reason')
    expect((res.data as Record<string, unknown>).stage).toBe('REJECTED')
  })
})

// ═══════════════════════════════════════════════════════════
// HR_ADMIN: Offer Flow
// ═══════════════════════════════════════════════════════════

test.describe('HR_ADMIN: Offer Flow', () => {
  test.use({ storageState: authFile('HR_ADMIN') })
  test.describe.configure({ mode: 'serial' })

  let seedData: Awaited<ReturnType<typeof resolveSeedData>>
  let offerPostingId: string
  let offerAppId: string
  let rejectedAppId: string

  test.afterAll(async ({ request }) => {
    // Cleanup: soft-delete the offer-flow posting (Codex G1 #4)
    if (offerPostingId) {
      const api = new ApiClient(request)
      await deletePosting(api, offerPostingId).catch(() => {})
    }
  })

  test.beforeAll(async ({ request }) => {
    seedData = await resolveSeedData(request)
    const api = new ApiClient(request)

    // Create a posting + applicant for offer flow
    const recruiterId = await resolveEmployeeId(request, '한지영')
    const postRes = await createPosting(api, {
      ...buildPosting('offer'),
      departmentId: seedData.departmentId,
      jobGradeId: seedData.jobGradeId,
      recruiterId,
    })
    assertOk(postRes, 'create offer-flow posting')
    offerPostingId = (postRes.data as Record<string, unknown>).id as string

    // Publish it
    await publishPosting(api, offerPostingId)

    // Add applicant
    const appRes = await addApplicantToPosting(api, offerPostingId, buildApplicant('offer'))
    assertOk(appRes, 'add offer applicant')
    offerAppId = (appRes.data as Record<string, unknown>).id as string

    // Advance to FINAL: APPLIED→SCREENING→INTERVIEW_1→FINAL
    await changeStage(api, offerAppId, { stage: 'SCREENING' })
    await changeStage(api, offerAppId, { stage: 'INTERVIEW_1' })
    await changeStage(api, offerAppId, { stage: 'FINAL' })

    // Create a second applicant and reject for negative test
    const rejRes = await addApplicantToPosting(api, offerPostingId, buildApplicant('rej'))
    assertOk(rejRes, 'add rejected applicant')
    rejectedAppId = (rejRes.data as Record<string, unknown>).id as string
    await changeStage(api, rejectedAppId, { stage: 'REJECTED', rejectionReason: 'E2E test' })
  })

  test('POST /applications/[id]/offer sends offer and advances to OFFER stage', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await sendOffer(api, offerAppId, {
      offeredSalary: 50000000,
      offeredDate: new Date().toISOString(),
      expectedStartDate: futureDateStr(30),
    })
    assertOk(res, 'send offer')
    const data = res.data as Record<string, unknown>
    expect(data.stage).toBe('OFFER')
    expect(data.offeredSalary).toBeTruthy()
  })

  test('POST /applications/[id]/offer on REJECTED returns 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await sendOffer(api, rejectedAppId, {
      offeredSalary: 40000000,
      offeredDate: new Date().toISOString(),
      expectedStartDate: futureDateStr(30),
    })
    assertError(res, 400, 'offer on REJECTED')
  })

  test('PATCH /applications/[id]/offer ACCEPT succeeds', async ({ request }) => {
    const res = await respondOffer(request, offerAppId, { response: 'ACCEPT' })
    assertOk(res, 'accept offer')
    expect((res.data as Record<string, unknown>).stage).toBe('OFFER_ACCEPTED')
  })

  test('PATCH /applications/[id]/offer on non-OFFER returns 400', async ({ request }) => {
    // offerAppId is now OFFER_ACCEPTED, not OFFER
    const res = await respondOffer(request, offerAppId, { response: 'ACCEPT' })
    assertError(res, 400, 'respond on non-OFFER')
  })

  test('GET /candidates/check with email returns result', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await checkCandidate(api, { email: 'applicant.kr0+KR-PROD-ENG@example.com' })
    assertOk(res, 'check candidate')
  })

  test('GET /candidates/check without params returns 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await checkCandidate(api, {})
    // Route requires email or phone — always 400 (Codex G1 #2)
    assertError(res, 400, 'candidates/check no params')
  })
})

// ═══════════════════════════════════════════════════════════
// RBAC: EMPLOYEE blocked
// ═══════════════════════════════════════════════════════════

test.describe('RBAC: EMPLOYEE blocked from recruitment', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  const dummyId = '00000000-0000-0000-0000-000000000000'

  test('EMPLOYEE GET /postings returns 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await listPostings(api)
    assertError(res, 403, 'EMP list postings')
  })

  test('EMPLOYEE POST /postings returns 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await createPosting(api, buildPosting('emp'))
    assertError(res, 403, 'EMP create posting')
  })

  test('EMPLOYEE PUT /applications/[id]/stage returns 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await changeStage(api, dummyId, { stage: 'SCREENING' })
    assertError(res, 403, 'EMP change stage')
  })

  test('EMPLOYEE DELETE /postings/[id] returns 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await deletePosting(api, dummyId)
    assertError(res, 403, 'EMP delete posting')
  })
})

// ═══════════════════════════════════════════════════════════
// MANAGER: Read-Only Access
// ═══════════════════════════════════════════════════════════

test.describe('MANAGER: Recruitment read-only access', () => {
  test.use({ storageState: authFile('MANAGER') })

  let seedPostingId: string
  const dummyId = '00000000-0000-0000-0000-000000000000'

  test.beforeAll(async ({ request }) => {
    // Resolve a seed posting using HR_ADMIN context isn't available here,
    // but MANAGER should have VIEW permission to list postings
    const api = new ApiClient(request)
    const res = await listPostings(api, { status: 'OPEN', limit: '1' })
    if (res.ok && res.data && (res.data as unknown[]).length > 0) {
      seedPostingId = ((res.data as Array<Record<string, unknown>>)[0]).id as string
    }
  })

  test('MANAGER GET /postings returns 200', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await listPostings(api)
    assertOk(res, 'MGR list postings')
  })

  test('MANAGER GET /postings/[id] returns 200', async ({ request }) => {
    test.skip(!seedPostingId, 'no seed posting available')
    const api = new ApiClient(request)
    const res = await getPosting(api, seedPostingId)
    assertOk(res, 'MGR get posting detail')
  })

  test('MANAGER POST /postings returns 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await createPosting(api, buildPosting('mgr'))
    assertError(res, 403, 'MGR create posting blocked')
  })

  test('MANAGER DELETE /postings/[id] returns 403', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await deletePosting(api, dummyId)
    assertError(res, 403, 'MGR delete posting blocked')
  })

  test('MANAGER POST /applicants/check-duplicate returns 200 (VIEW perm)', async ({ request }) => {
    const api = new ApiClient(request)
    // check-duplicate requires name + email (Codex G1 #1)
    const res = await checkDuplicate(api, { name: '테스트', email: 'nonexistent@test.local' })
    assertOk(res, 'MGR check-duplicate allowed')
  })
})
