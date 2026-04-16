// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance CFR & Pulse API Tests
//
// P5: 1:1 meetings, recognition feed, pulse surveys.
// CFR routes have NO delete. Recognition has NO detail/update/delete.
// Pulse surveys use `size` param (not `limit`).
// ═══════════════════════════════════════════════════════════

import { test, expect, type APIRequestContext } from '@playwright/test'
import { authFile } from '../helpers/auth'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { resolveSeedData } from '../helpers/test-data'
import * as pf from '../helpers/performance-fixtures'

// ═══════════════════════════════════════════════════════════
// BLOCK 1: 1:1 Meetings (serial, 9 tests)
// ═══════════════════════════════════════════════════════════

test.describe('CFR: 1:1 Meetings', () => {
  test.describe.configure({ mode: 'serial' })

  let mgrRequest: APIRequestContext
  let empRequest: APIRequestContext
  let mgrClient: ApiClient
  let empClient: ApiClient
  let employeeAId: string
  let meetingId1: string
  let meetingId2: string

  test.beforeAll(async ({ playwright }) => {
    mgrRequest = await playwright.request.newContext({ storageState: authFile('MANAGER') })
    empRequest = await playwright.request.newContext({ storageState: authFile('EMPLOYEE') })
    mgrClient = new ApiClient(mgrRequest)
    empClient = new ApiClient(empRequest)

    const seed = await resolveSeedData(mgrRequest)
    employeeAId = seed.employeeId
  })

  test.afterAll(async () => {
    await mgrRequest?.dispose()
    await empRequest?.dispose()
  })

  test('1. MANAGER creates 1:1 meeting (REGULAR)', async () => {
    const payload = pf.buildOneOnOne(employeeAId)
    const result = await pf.createOneOnOne(mgrClient, payload)
    assertOk(result, 'create 1:1 REGULAR')

    const data = result.data as Record<string, unknown>
    expect(data.id).toBeTruthy()
    meetingId1 = data.id as string
  })

  test('2. MANAGER creates 1:1 meeting (GOAL_REVIEW)', async () => {
    const payload = { ...pf.buildOneOnOne(employeeAId), meetingType: 'GOAL_REVIEW' }
    const result = await pf.createOneOnOne(mgrClient, payload)
    assertOk(result, 'create 1:1 GOAL_REVIEW')

    const data = result.data as Record<string, unknown>
    expect(data.id).toBeTruthy()
    meetingId2 = data.id as string
  })

  test('3. MANAGER lists 1:1 meetings', async () => {
    const result = await pf.listOneOnOnes(mgrClient)
    assertOk(result, 'list 1:1 meetings')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
  })

  test('4. MANAGER gets meeting detail', async () => {
    const result = await pf.getOneOnOne(mgrClient, meetingId1)
    assertOk(result, 'get 1:1 detail')

    const data = result.data as Record<string, unknown>
    expect(data.id).toBe(meetingId1)
    expect(data.employeeId).toBe(employeeAId)
    expect(data.scheduledAt).toBeTruthy()
  })

  test('5. MANAGER updates meeting with notes', async () => {
    const result = await pf.updateOneOnOne(mgrClient, meetingId1, {
      notes: `E2E test notes updated at ${Date.now()}`,
      actionItems: 'Follow up on project timeline; Review Q2 goals',
    })
    assertOk(result, 'update 1:1 notes')
  })

  test('6. MANAGER completes meeting', async () => {
    const result = await pf.updateOneOnOne(mgrClient, meetingId2, {
      status: 'COMPLETED',
    })
    assertOk(result, 'complete 1:1 meeting')
  })

  test('7. EMPLOYEE views own 1:1 meetings', async () => {
    const result = await pf.listOneOnOnes(empClient)
    assertOk(result, 'employee list 1:1')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
  })

  test('8. MANAGER views 1:1 dashboard', async () => {
    const result = await pf.getOneOnOneDashboard(mgrClient)
    assertOk(result, '1:1 dashboard')
  })

  test('9. EMPLOYEE cannot create 1:1 for non-report', async () => {
    const fakeEmployeeId = '00000000-0000-0000-0000-000000000099'
    const payload = pf.buildOneOnOne(fakeEmployeeId)
    const result = await pf.createOneOnOne(empClient, payload)
    assertError(result, 403, 'employee create 1:1 for non-report')
  })
})

// ═══════════════════════════════════════════════════════════
// BLOCK 2: Recognition Feed & Create (serial, 9 tests)
// ═══════════════════════════════════════════════════════════

test.describe('CFR: Recognition', () => {
  test.describe.configure({ mode: 'serial' })

  let mgrRequest: APIRequestContext
  let empRequest: APIRequestContext
  let hrRequest: APIRequestContext
  let mgrClient: ApiClient
  let empClient: ApiClient
  let hrClient: ApiClient
  let employeeAId: string
  let managerId: string
  let recogId: string

  test.beforeAll(async ({ playwright }) => {
    mgrRequest = await playwright.request.newContext({ storageState: authFile('MANAGER') })
    empRequest = await playwright.request.newContext({ storageState: authFile('EMPLOYEE') })
    hrRequest = await playwright.request.newContext({ storageState: authFile('HR_ADMIN') })
    mgrClient = new ApiClient(mgrRequest)
    empClient = new ApiClient(empRequest)
    hrClient = new ApiClient(hrRequest)

    // Resolve employee-a (이민준) as receiver for MANAGER recognition
    const seed = await resolveSeedData(mgrRequest)
    employeeAId = seed.employeeId

    // Resolve manager (박준혁) as receiver for EMPLOYEE recognition
    const mgrSearchRes = await empRequest.get('/api/v1/employees?search=박준혁&limit=1')
    const mgrSearchBody = await mgrSearchRes.json() as { data: Array<{ id: string }> }
    managerId = mgrSearchBody.data[0]?.id ?? ''
  })

  test.afterAll(async () => {
    await mgrRequest?.dispose()
    await empRequest?.dispose()
    await hrRequest?.dispose()
  })

  test('1. MANAGER creates recognition (CHALLENGE)', async () => {
    const payload = pf.buildRecognition(employeeAId, 'CHALLENGE')
    const result = await pf.createRecognition(mgrClient, payload)
    assertOk(result, 'create recognition CHALLENGE')

    const data = result.data as Record<string, unknown>
    expect(data.id).toBeTruthy()
    recogId = data.id as string
  })

  test('2. EMPLOYEE creates recognition (TRUST)', async () => {
    test.skip(!managerId, 'manager employeeId not resolved')
    const payload = pf.buildRecognition(managerId, 'TRUST')
    const result = await pf.createRecognition(empClient, payload)
    assertOk(result, 'create recognition TRUST')
  })

  test('3. EMPLOYEE cannot recognize self', async () => {
    const payload = pf.buildRecognition(employeeAId, 'RESPECT')
    const result = await pf.createRecognition(empClient, payload)
    assertError(result, 400, 'self-recognition blocked')
  })

  test('4. list recognition feed', async () => {
    const result = await pf.listRecognitions(mgrClient)
    assertOk(result, 'list recognition feed')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
  })

  test('5. filter feed by core value (CHALLENGE)', async () => {
    const result = await pf.listRecognitions(mgrClient, { coreValue: 'CHALLENGE' })
    assertOk(result, 'filter recognition by value')

    const data = result.data as Array<Record<string, unknown>>
    expect(Array.isArray(data)).toBe(true)
    if (data.length > 0) {
      expect(data[0].coreValue).toBe('CHALLENGE')
    }
  })

  test('6. EMPLOYEE likes a recognition', async () => {
    const result = await pf.likeRecognition(empClient, recogId)
    assertOk(result, 'like recognition')
  })

  test('7. HR gets recognition stats', async () => {
    const result = await pf.getRecognitionStats(hrClient)
    assertOk(result, 'recognition stats')
  })

  test('8. HR gets employee recognitions', async () => {
    const result = await pf.getEmployeeRecognitions(hrClient, employeeAId)
    assertOk(result, 'employee recognitions')
  })

  test('9. message too short rejected', async () => {
    const result = await pf.createRecognition(mgrClient, {
      receiverId: employeeAId,
      coreValue: 'CHALLENGE',
      message: 'Short',
      isPublic: true,
    })
    assertError(result, 400, 'short message rejected')
  })
})

// ═══════════════════════════════════════════════════════════
// BLOCK 3: Pulse Survey Lifecycle (serial, 12 tests)
// ═══════════════════════════════════════════════════════════

test.describe('Pulse Survey Lifecycle', () => {
  test.describe.configure({ mode: 'serial' })

  let hrRequest: APIRequestContext
  let empRequest: APIRequestContext
  let hrClient: ApiClient
  let empClient: ApiClient
  let surveyId: string
  let questionIds: string[] = []

  test.beforeAll(async ({ playwright }) => {
    hrRequest = await playwright.request.newContext({ storageState: authFile('HR_ADMIN') })
    empRequest = await playwright.request.newContext({ storageState: authFile('EMPLOYEE') })
    hrClient = new ApiClient(hrRequest)
    empClient = new ApiClient(empRequest)
  })

  test.afterAll(async () => {
    await hrRequest?.dispose()
    await empRequest?.dispose()
  })

  test('1. HR creates pulse survey', async () => {
    const payload = pf.buildSurvey()
    const result = await pf.createSurvey(hrClient, payload)
    assertOk(result, 'create pulse survey')

    const data = result.data as Record<string, unknown>
    expect(data.id).toBeTruthy()
    surveyId = data.id as string
  })

  test('2. HR gets survey detail with questions', async () => {
    const result = await pf.getSurvey(hrClient, surveyId)
    assertOk(result, 'get survey detail')

    const data = result.data as Record<string, unknown>
    expect(data.id).toBe(surveyId)

    const questions = data.questions as Array<{ id: string }> | undefined
    expect(questions).toBeDefined()
    expect(Array.isArray(questions)).toBe(true)
    if (questions && questions.length > 0) {
      questionIds = questions.map((q) => q.id)
    }
  })

  test('3. HR updates survey title', async () => {
    const result = await pf.updateSurvey(hrClient, surveyId, {
      title: `E2E Updated Survey ${Date.now()}`,
    })
    assertOk(result, 'update survey title')
  })

  test('4. HR lists surveys', async () => {
    const result = await pf.listSurveys(hrClient, { size: '10' })
    assertOk(result, 'list surveys')

    const data = result.data
    expect(Array.isArray(data)).toBe(true)
  })

  test('5. HR updates questions', async () => {
    const result = await pf.updateSurveyQuestions(hrClient, surveyId, {
      questions: [
        {
          questionText: 'How do you rate team morale this week?',
          questionType: 'LIKERT',
          sortOrder: 0,
          isRequired: true,
        },
        {
          questionText: 'What would improve your work-life balance?',
          questionType: 'TEXT',
          sortOrder: 1,
          isRequired: false,
        },
      ],
    })
    assertOk(result, 'update survey questions')

    // Re-fetch to get updated question IDs
    const detail = await pf.getSurvey(hrClient, surveyId)
    assertOk(detail, 're-fetch survey after question update')
    const questions = (detail.data as Record<string, unknown>).questions as Array<{ id: string }> | undefined
    if (questions && questions.length > 0) {
      questionIds = questions.map((q) => q.id)
    }
  })

  test('6. HR activates survey', async () => {
    const result = await pf.updateSurvey(hrClient, surveyId, {
      status: 'PULSE_ACTIVE',
    })
    assertOk(result, 'activate survey')
  })

  test('7. EMPLOYEE checks my-pending', async () => {
    const result = await pf.getMyPendingSurveys(empClient)
    assertOk(result, 'my-pending surveys')
  })

  test('8. EMPLOYEE responds to survey', async () => {
    test.skip(questionIds.length === 0, 'no question IDs resolved')

    const answers = questionIds.map((qId, idx) => ({
      questionId: qId,
      value: idx === 0 ? 4 : 'More flexible hours would help',
    }))

    const result = await pf.respondToSurvey(empClient, surveyId, { answers })
    assertOk(result, 'respond to survey')
  })

  test('9. EMPLOYEE double-responds rejected', async () => {
    test.skip(questionIds.length === 0, 'no question IDs resolved')

    const answers = questionIds.map((qId, idx) => ({
      questionId: qId,
      value: idx === 0 ? 3 : 'Duplicate attempt',
    }))

    const result = await pf.respondToSurvey(empClient, surveyId, { answers })
    assertError(result, 400, 'double response rejected')
  })

  test('10. HR gets survey results', async () => {
    const result = await pf.getSurveyResults(hrClient, surveyId)
    assertOk(result, 'survey results')
  })

  test('11. EMPLOYEE blocked from survey results', async () => {
    const result = await pf.getSurveyResults(empClient, surveyId)
    assertError(result, 403, 'employee blocked from results')
  })

  test('12. HR deletes survey (cleanup)', async () => {
    const result = await pf.deleteSurvey(hrClient, surveyId)
    assertOk(result, 'delete survey')
  })
})

// ═══════════════════════════════════════════════════════════
// BLOCK 4: CFR & Pulse RBAC (parallel, 5 tests)
// ═══════════════════════════════════════════════════════════

test.describe('CFR & Pulse RBAC: EMPLOYEE boundaries', () => {
  test.use({ storageState: authFile('EMPLOYEE') })

  const FAKE_ID = '00000000-0000-0000-0000-000000000000'

  test('EMPLOYEE cannot create pulse survey', async ({ request }) => {
    const client = new ApiClient(request)
    const payload = pf.buildSurvey()
    const result = await pf.createSurvey(client, payload)
    assertError(result, 403, 'employee create survey')
  })

  test('EMPLOYEE cannot delete pulse survey', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.deleteSurvey(client, FAKE_ID)
    assertError(result, 403, 'employee delete survey')
  })

  test('EMPLOYEE cannot view survey results', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.getSurveyResults(client, FAKE_ID)
    assertError(result, 403, 'employee view survey results')
  })

  test('EMPLOYEE cannot update survey', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.updateSurvey(client, FAKE_ID, { title: 'Hacked' })
    assertError(result, 403, 'employee update survey')
  })

  test('EMPLOYEE cannot update survey questions', async ({ request }) => {
    const client = new ApiClient(request)
    const result = await pf.updateSurveyQuestions(client, FAKE_ID, {
      questions: [{
        questionText: 'Hacked question',
        questionType: 'TEXT',
        sortOrder: 0,
      }],
    })
    assertError(result, 403, 'employee update survey questions')
  })
})
