// ═══════════════════════════════════════════════════════════
// CTR HR Hub — S276 지각/조퇴 판정 + 정책 게이트 e2e
// 실경로(REAL POST) 검증: 판정 배선·1일1레코드·야간 attach·
// 설정 법인스코프·단말기 역순 이벤트.
// 경계 의미론(== 등)은 unit(judgeStatus.test.ts)이 SSOT — 여기선 배선만.
// 픽스처: 전용 직원 당일 레코드 DB 정리 + try/finally 설정 원복 (Codex r2-4).
// ═══════════════════════════════════════════════════════════

import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { ApiClient, assertOk, assertError } from '../helpers/api-client'
import { authFile } from '../helpers/auth'
import { clockIn, clockOut, getTodayAttendance } from '../helpers/attendance-fixtures'
import { dbQuery, deleteAttendanceOn, deleteShiftOn, closeDb } from '../helpers/db'

// 전용 직원 — attendance-core(employee-a)와 fullyParallel 픽스처 충돌 회피
const EMP_EMAIL = 'employee-c@ctr.co.kr'

// KST 달력 날짜 (판정 대상 법인 CTR = Asia/Seoul)
function kstDateStr(offsetDays = 0): string {
  const kst = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86_400_000)
  return kst.toISOString().slice(0, 10)
}

/** KST 자정 직후/직전 에지 윈도우 — 결정성 가드 (Codex r3-2) */
function inMidnightEdgeWindow(): boolean {
  const kst = new Date(Date.now() + 9 * 3600_000)
  const hm = kst.getUTCHours() * 60 + kst.getUTCMinutes()
  return hm <= 2 || hm >= 23 * 60 + 58 // 00:00~00:02 또는 23:58~
}

async function newApi(role: Parameters<typeof authFile>[0]): Promise<{
  ctx: APIRequestContext
  api: ApiClient
}> {
  const ctx = await pwRequest.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
    storageState: authFile(role),
  })
  return { ctx, api: new ApiClient(ctx) }
}

test.afterAll(async () => {
  await closeDb()
})

// ─── 1. 설정 법인 스코프 (Codex r2-3) ──────────────────────

test.describe('S276 settings: SUPER가 선택 법인만 변경', () => {
  test.use({ storageState: authFile('SUPER_ADMIN') })

  test('PUT companyId=A → A만 변경, B 불변', async ({ request }) => {
    const api = new ApiClient(request)
    // CTR은 judgment describe가 동시에 설정을 바꾸므로 제외 (fullyParallel 경합 회피)
    const companies = await dbQuery<{ id: string; code: string }>(
      `SELECT id, code FROM companies WHERE code IN ('CTR-CN', 'CTR-HOLD') AND deleted_at IS NULL`,
    )
    const a = companies.find((c) => c.code === 'CTR-CN')
    const b = companies.find((c) => c.code === 'CTR-HOLD')
    expect(a && b).toBeTruthy()

    const getStart = async (companyId: string) => {
      const res = await api.get(`/api/v1/settings/attendance?companyId=${companyId}`)
      return (res.data as Record<string, unknown>).workStartTime as string
    }

    const beforeA = await getStart(a!.id)
    const beforeB = await getStart(b!.id)
    try {
      const put = await api.put('/api/v1/settings/attendance', {
        companyId: a!.id,
        workStartTime: '07:45',
      })
      expect(put.status).toBe(200)
      expect(await getStart(a!.id)).toBe('07:45')
      expect(await getStart(b!.id)).toBe(beforeB) // B 불변
    } finally {
      await api.put('/api/v1/settings/attendance', { companyId: a!.id, workStartTime: beforeA })
    }
  })

  test('PUT 비정상 입력 거부 — 29:99 시각·가짜 타임존', async ({ request }) => {
    const api = new ApiClient(request)
    const bad1 = await api.put('/api/v1/settings/attendance', { workStartTime: '29:99' })
    expect(bad1.status).toBe(400)
    const bad2 = await api.put('/api/v1/settings/attendance', { timezone: 'Not/AZone' })
    expect(bad2.status).toBe(400)
  })
})

// ─── 2. 지각 판정 배선 + 1일 1레코드 (EMPLOYEE 실경로) ─────

test.describe('S276 judgment: clock-in 실경로', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: authFile('EMPLOYEE_C') })

  let superCtx: APIRequestContext | null = null
  let superApi: ApiClient | null = null
  let savedStart = '08:30'
  let savedEnd = '17:30'
  let ctrId = ''

  test.beforeAll(async () => {
    const s = await newApi('SUPER_ADMIN')
    superCtx = s.ctx
    superApi = s.api
    const rows = await dbQuery<{ id: string }>(
      `SELECT id FROM companies WHERE code = 'CTR' AND deleted_at IS NULL LIMIT 1`,
    )
    ctrId = rows[0].id
    const cur = await superApi.get(`/api/v1/settings/attendance?companyId=${ctrId}`)
    savedStart = (cur.data as Record<string, unknown>).workStartTime as string
    savedEnd = (cur.data as Record<string, unknown>).workEndTime as string
    // 픽스처 정리: 오늘·어제 출퇴근/교대 (1일1레코드 정책 때문에 API로는 불가)
    await deleteAttendanceOn(EMP_EMAIL, kstDateStr(0))
    await deleteAttendanceOn(EMP_EMAIL, kstDateStr(-1))
    await deleteShiftOn(EMP_EMAIL, kstDateStr(-1))
  })

  test.afterAll(async () => {
    // try/finally 등가: 설정·근태 원복
    if (superApi) {
      await superApi.put('/api/v1/settings/attendance', {
        companyId: ctrId,
        workStartTime: savedStart,
        workEndTime: savedEnd,
      })
    }
    await deleteAttendanceOn(EMP_EMAIL, kstDateStr(0))
    await deleteAttendanceOn(EMP_EMAIL, kstDateStr(-1))
    await deleteShiftOn(EMP_EMAIL, kstDateStr(-1))
    await superCtx?.dispose()
  })

  test('기준 00:01 → clock-in LATE (판정 배선)', async ({ request }) => {
    test.skip(inMidnightEdgeWindow(), 'KST 자정 에지 윈도우 — 판정 경계는 unit이 SSOT')
    const api = new ApiClient(request)
    await superApi!.put('/api/v1/settings/attendance', {
      companyId: ctrId,
      workStartTime: '00:01',
      workEndTime: '23:58',
    })
    const res = await clockIn(api, { method: 'WEB' })
    assertOk(res, 'clock-in')
    expect((res.data as Record<string, unknown>).status).toBe('LATE')
  })

  test('1일 1레코드: 미퇴근 상태 재출근 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await clockIn(api)
    assertError(res, 400, 'duplicate clock-in (open)')
  })

  test('clock-out: LATE 유지 (조퇴로 다운그레이드 안 됨)', async ({ request }) => {
    test.skip(inMidnightEdgeWindow(), 'KST 자정 에지 윈도우')
    const api = new ApiClient(request)
    const res = await clockOut(api, { method: 'WEB' })
    assertOk(res, 'clock-out')
    expect((res.data as Record<string, unknown>).status).toBe('LATE')
  })

  test('1일 1레코드: 퇴근 완료 후에도 재출근 400', async ({ request }) => {
    const api = new ApiClient(request)
    const res = await clockIn(api)
    assertError(res, 400, 'duplicate clock-in (completed)')
  })

  test('야간 교대 attach: 어제 22:00 출근 기록 → 오늘 퇴근 성공', async ({ request }) => {
    // 22:00 KST 이후엔 (now − 어제22:00) > 24h → attach 한도 초과가 정상 동작
    test.skip(new Date(Date.now() + 9 * 3600_000).getUTCHours() >= 22, 'KST 22시 이후 — attach 24h 한도 윈도우')
    const api = new ApiClient(request)
    const yesterday = kstDateStr(-1)
    // 어제 기록·교대 시드 (22:00~06:00 야간, 22:00 KST = 13:00Z)
    await deleteAttendanceOn(EMP_EMAIL, yesterday)
    const emp = await dbQuery<{ id: string; company_id: string }>(
      `SELECT e.id, a.company_id FROM employees e
       JOIN employee_assignments a ON a.employee_id = e.id AND a.is_primary AND a.end_date IS NULL
       WHERE e.email = $1 LIMIT 1`,
      [EMP_EMAIL],
    )
    const patternRows = await dbQuery<{ id: string }>(
      `INSERT INTO shift_patterns (id, company_id, code, name, pattern_type, slots, cycle_days, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'E2E-S276', 'e2e night', 'CUSTOM',
               '[{"name":"night","start":"22:00","end":"06:00","breakMin":60,"nightPremium":true}]', 1, now(), now())
       ON CONFLICT (company_id, code) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [emp[0].company_id],
    )
    try {
      await dbQuery(
        `INSERT INTO shift_schedules (id, company_id, employee_id, shift_pattern_id, work_date, slot_index,
                                      slot_name, start_time, end_time, break_minutes, is_night_shift, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::date, 0, 'night', '22:00', '06:00', 60, true, 'SCHEDULED', now(), now())
         ON CONFLICT (employee_id, work_date) DO NOTHING`,
        [emp[0].company_id, emp[0].id, patternRows[0].id, yesterday],
      )
      await dbQuery(
        `INSERT INTO attendances (id, employee_id, company_id, work_date, clock_in, clock_in_method, status, work_type, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3::date, ($3 || 'T13:00:00Z')::timestamptz, 'WEB', 'NORMAL', 'NORMAL', now())`,
        [emp[0].id, emp[0].company_id, yesterday],
      )

      const res = await clockOut(api, { method: 'WEB' })
      assertOk(res, 'night-shift next-day clock-out')
      const data = res.data as Record<string, unknown>
      expect(data.clockOut).toBeTruthy()
    } finally {
      await deleteAttendanceOn(EMP_EMAIL, yesterday)
      await deleteShiftOn(EMP_EMAIL, yesterday)
      await dbQuery(`DELETE FROM shift_patterns WHERE code = 'E2E-S276'`)
    }
  })
})

// ─── 3. 단말기: 역순 이벤트 거부 (Codex r3-3) ──────────────

test.describe('S276 terminal: eventTime 계약', () => {
  // fullyParallel: employee-a는 judgment describe가 동시 조작 → 전용 직원(employee-b)으로 격리
  const TERM_EMAIL = 'employee-b@ctr.co.kr'

  test('CLOCK_OUT eventTime < clockIn → 400 (음수 근무시간 차단)', async () => {
    const ctx = await pwRequest.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
    })
    const secret = `tsec_e2e_s276_${Date.now()}`
    const today = kstDateStr(0)
    const emp = await dbQuery<{ id: string; company_id: string; employee_no: string }>(
      `SELECT e.id, a.company_id, e.employee_no FROM employees e
       JOIN employee_assignments a ON a.employee_id = e.id AND a.is_primary AND a.end_date IS NULL
       WHERE e.email = $1 LIMIT 1`,
      [TERM_EMAIL],
    )
    const term = await dbQuery<{ id: string }>(
      `INSERT INTO attendance_terminals (id, company_id, terminal_code, terminal_type, location_name, api_secret, created_at)
       VALUES (gen_random_uuid(), $1, 'E2E-S276-T', 'FINGERPRINT', 'e2e', $2, now())
       ON CONFLICT (terminal_code) DO UPDATE SET api_secret = $2, deleted_at = NULL
       RETURNING id`,
      [emp[0].company_id, secret],
    )
    try {
      await deleteAttendanceOn(TERM_EMAIL, today)
      // 미퇴근 기록: 오늘 09:00 KST 출근 (00:00Z)
      await dbQuery(
        `INSERT INTO attendances (id, employee_id, company_id, work_date, clock_in, clock_in_method, status, work_type, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3::date, ($3 || 'T00:00:00Z')::timestamptz, 'WEB', 'NORMAL', 'NORMAL', now())`,
        [emp[0].id, emp[0].company_id, today],
      )
      // 역순 이벤트: 출근보다 1시간 이른 퇴근 (08:00 KST = 23:00Z 전날)
      const res = await ctx.post('/api/v1/terminals/clock', {
        headers: { 'X-Terminal-ID': term[0].id, 'X-Terminal-Secret': secret },
        data: {
          employeeNo: emp[0].employee_no,
          eventType: 'CLOCK_OUT',
          timestamp: new Date(Date.parse(`${today}T00:00:00Z`) - 3600_000).toISOString(),
        },
      })
      expect(res.status()).toBe(400)
    } finally {
      await deleteAttendanceOn(TERM_EMAIL, today)
      await dbQuery(`DELETE FROM attendance_terminals WHERE terminal_code = 'E2E-S276-T'`)
      await ctx.dispose()
    }
  })
})

// ─── 4. 발령 실행: HR 허용 + 트랜잭션 내 감사로그 (O3) ─────

test.describe('S276 bulk-movements: HR 실행', () => {
  test.use({ storageState: authFile('HR_ADMIN') })

  // 발령(assignment) 픽스처는 employee-a 사용 — judgment describe(employee-c)의
  // assignment 조회와 충돌 방지. attendance-core는 attendances만 만지므로 안전.
  const BULK_EMAIL = 'employee-a@ctr.co.kr'

  test('HR validate→execute 200 + audit_logs 같은 커밋에 존재', async ({ request }) => {
    const effective = kstDateStr(0)
    // 멱등성 정리(원자적 1문장): 이전 실행이 만든 오늘자 TRANSFER 행 제거 + 마감된
    // 직전 발령 복원 — executor가 "현재 발효일 >= 신규 발효일"을 거부하므로 필수.
    const cleanupTransfer = async () => {
      await dbQuery(
        `WITH emp AS (SELECT id FROM employees WHERE email = $1),
              del AS (
                DELETE FROM employee_assignments
                WHERE employee_id = (SELECT id FROM emp)
                  AND change_type = 'TRANSFER' AND effective_date = $2::date
              )
         UPDATE employee_assignments SET end_date = NULL
         WHERE employee_id = (SELECT id FROM emp)
           AND is_primary AND end_date = $2::date`,
        [BULK_EMAIL, effective],
      )
    }
    await cleanupTransfer()
    try {
      // 이민준 현재 부서로의 no-op 전배치 (조직 상태 불변, append-only 행만 추가)
      const emp = await dbQuery<{ employee_no: string; dept_code: string }>(
        `SELECT e.employee_no, d.code AS dept_code
         FROM employees e
         JOIN employee_assignments a ON a.employee_id = e.id AND a.is_primary AND a.end_date IS NULL
         JOIN departments d ON d.id = a.department_id
         WHERE e.email = $1 LIMIT 1`,
        [BULK_EMAIL],
      )
      const csv = `사번,부서코드,직급코드,직위코드,근무지코드,발효일,사유\n${emp[0].employee_no},${emp[0].dept_code},,,,${effective},S276 e2e\n`
      const file = { name: 's276-transfer.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') }

      const validateRes = await request.post('/api/v1/bulk-movements/validate', {
        multipart: { file, type: 'transfer' },
      })
      expect(validateRes.status()).toBe(200)
      const validateBody = (await validateRes.json()) as {
        data: { valid: boolean; validationToken: string }
      }
      expect(validateBody.data.valid).toBe(true)

      const executeRes = await request.post('/api/v1/bulk-movements/execute', {
        multipart: { file, type: 'transfer', validationToken: validateBody.data.validationToken },
      })
      // HR 실행 데드락 해소 — 과거엔 결재플로우 role 검사로 403
      expect(executeRes.status()).toBe(200)
      const executeBody = (await executeRes.json()) as {
        data: { applied: number; executionId: string }
      }
      expect(executeBody.data.applied).toBe(1)

      // 감사로그가 실행 트랜잭션과 함께 커밋됐는지 (Codex r2-2)
      const audit = await dbQuery<{ id: string }>(
        `SELECT id FROM audit_logs WHERE resource_type = 'bulk_movement' AND resource_id = $1`,
        [executeBody.data.executionId],
      )
      expect(audit.length).toBe(1)
    } finally {
      await cleanupTransfer()
    }
  })

  test('삭제된 단건 전배치 API → 404', async ({ request }) => {
    const res = await request.post('/api/v1/employees/00000000-0000-0000-0000-000000000000/transfer', {
      data: {},
    })
    expect(res.status()).toBe(404)
  })
})
