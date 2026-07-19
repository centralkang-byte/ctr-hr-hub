import { randomUUID } from 'node:crypto'
import readline from 'node:readline'

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  applyDirectAttendanceCorrection,
  createAttendanceCorrectionRequest,
  decideAttendanceCorrectionRequest,
  type CorrectionServiceDeps,
} from '@/lib/attendance/correction-service'
import { completeClockOutEvent } from '@/lib/attendance/clock-event-service'
import {
  closeAttendancePeriod,
  reopenAttendancePeriod,
} from '@/lib/payroll/attendance-period-service'
import { calculatePayrollRun } from '@/lib/payroll/batch'
import {
  updatePayrollRunInPhase,
  withLockedPayrollRunPhase,
} from '@/lib/payroll/phase-writer-service'
import type { SessionUser } from '@/types'

type Db = NonNullable<CorrectionServiceDeps['db']>

const YEAR = 2026
const MONTH = 7
const YEAR_MONTH = '2026-07'
const WORK_DATE = new Date('2026-07-15T00:00:00.000Z')
const CLOCK_IN = new Date('2026-07-14T23:30:00.000Z')
const DECOY_CLOCK_IN = new Date('2026-07-14T23:15:00.000Z')
const CORRECTED_CLOCK_IN = new Date('2026-07-14T23:20:00.000Z')
const RECORDED_CLOCK_OUT = new Date('2026-07-15T08:45:00.000Z')
const FIXED_NOW = new Date('2026-07-15T09:00:00.000Z')
const PERIOD_START = new Date('2026-07-01T00:00:00.000Z')
const PERIOD_END = new Date('2026-07-31T00:00:00.000Z')
const OBSERVATION_TIMEOUT_MS = 15_000
const FIXTURE_TRANSACTION_TIMEOUT_MS = 60_000
const SAFE_TEST_DATABASE_PATTERN = /(^|[_-])test($|[_-])/i
const HARNESS_INSTANCE = randomUUID().replaceAll('-', '').slice(0, 12)
const CLIENT_A_APPLICATION_NAME = `ctr-concurrency-${HARNESS_INSTANCE}-a`
const CLIENT_B_APPLICATION_NAME = `ctr-concurrency-${HARNESS_INSTANCE}-b`

const SCENARIOS = [
  'duplicate-correction-create',
  'approve-vs-clock-out-approve-first',
  'approve-vs-clock-out-clock-out-first',
  'concurrent-clock-out',
  'approve-vs-direct-correction-approve-first',
  'approve-vs-direct-correction-direct-first',
  'close-vs-correction-create-close-first',
  'close-vs-correction-create-create-first',
  'close-vs-correction-approve-close-first',
  'close-vs-correction-approve-approve-first',
  'calculate-start-vs-reopen-calculate-first',
  'calculate-start-vs-reopen-reopen-first',
  'phase-writer-vs-reopen-writer-first',
  'phase-writer-vs-reopen-reopen-first',
  'tenant-boundary-decoy',
] as const

type ScenarioName = (typeof SCENARIOS)[number]

interface ScenarioCommand {
  type: 'scenario'
  id: string
  name: ScenarioName
}

interface ReleaseCommand {
  type: 'release'
  id: string
  token: string
}

interface TeardownCommand {
  type: 'teardown'
  id: string
}

interface CancelCommand {
  type: 'cancel'
  id: string
}

type HarnessCommand =
  | ScenarioCommand
  | ReleaseCommand
  | CancelCommand
  | TeardownCommand

interface Fixture {
  companyId: string
  requesterId: string
  reviewerId: string
  attendanceId: string
  decoyCompanyId: string
  decoyEmployeeId: string
  decoyAttendanceId: string
  decoyPayrollRunId: string
  requester: SessionUser
  reviewer: SessionUser
}

interface SerializedError {
  name: string
  message: string
  code?: string
  statusCode?: number
}

type OperationOutcome<T extends Record<string, unknown> = Record<string, unknown>> =
  | { ok: true; value: T }
  | { ok: false; error: SerializedError }

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function emit(message: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: unknown; statusCode?: unknown }
    return {
      name: error.name,
      message: error.message,
      ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
      ...(typeof candidate.statusCode === 'number'
        ? { statusCode: candidate.statusCode }
        : {}),
    }
  }
  return { name: 'UnknownError', message: String(error) }
}

async function outcome<T extends Record<string, unknown>>(
  operation: () => Promise<T>,
): Promise<OperationOutcome<T>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    return { ok: false, error: serializeError(error) }
  }
}

class BarrierController {
  private readonly waiting = new Map<string, Deferred<void>>()
  private readonly canceledScenarios = new Set<string>()
  private closed = false

  async wait(
    scenarioId: string,
    label: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    if (this.closed || this.canceledScenarios.has(scenarioId)) return
    const token = `${scenarioId}:${label}`
    if (this.waiting.has(token)) {
      throw new Error(`Barrier already waiting: ${token}`)
    }
    const gate = deferred<void>()
    this.waiting.set(token, gate)
    emit({ type: 'barrier', id: scenarioId, token, label, context })
    try {
      await gate.promise
    } finally {
      if (this.waiting.get(token) === gate) this.waiting.delete(token)
    }
  }

  release(command: ReleaseCommand): void {
    const gate = this.waiting.get(command.token)
    if (!gate) {
      emit({
        type: 'release',
        id: command.id,
        token: command.token,
        ok: false,
        error: `Unknown barrier: ${command.token}`,
      })
      return
    }
    this.waiting.delete(command.token)
    gate.resolve()
    emit({ type: 'release', id: command.id, token: command.token, ok: true })
  }

  cancelScenario(scenarioId: string): void {
    this.canceledScenarios.add(scenarioId)
    for (const [token, gate] of this.waiting) {
      if (!token.startsWith(`${scenarioId}:`)) continue
      this.waiting.delete(token)
      gate.resolve()
    }
  }

  finishScenario(scenarioId: string): void {
    this.canceledScenarios.delete(scenarioId)
  }

  isActive(scenarioId: string): boolean {
    return !this.closed && !this.canceledScenarios.has(scenarioId)
  }

  close(): void {
    this.closed = true
    for (const gate of this.waiting.values()) gate.resolve()
    this.waiting.clear()
  }
}

function parseSafeTestDatabaseName(connectionString: string): string {
  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('TEST_DATABASE_URL must use postgres:// or postgresql://.')
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!databaseName || databaseName.includes('/')) {
    throw new Error('TEST_DATABASE_URL must name exactly one database.')
  }
  if (!SAFE_TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error(
      `Refusing concurrency writes: database "${databaseName}" lacks a standalone test marker.`,
    )
  }
  return databaseName
}

function connectionStringWithApplicationName(
  connectionString: string,
  applicationName: string,
): string {
  const url = new URL(connectionString)
  url.searchParams.set('application_name', applicationName)
  return url.toString()
}

function createOwnedClient(
  connectionString: string,
  applicationName: string,
): {
  raw: PrismaClient
  db: Db
} {
  const namedConnectionString = connectionStringWithApplicationName(
    connectionString,
    applicationName,
  )
  const isLocal =
    namedConnectionString.includes('localhost') ||
    namedConnectionString.includes('127.0.0.1')
  const isSupabase =
    namedConnectionString.includes('supabase.co') ||
    namedConnectionString.includes('supabase.com')
  const adapter = new PrismaPg({
    connectionString: namedConnectionString,
    ...(!isLocal && isSupabase
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
    max: 4,
  })
  const raw = new PrismaClient({ adapter })
  return { raw, db: raw as unknown as Db }
}

async function waitForClientLockWait(
  observer: Db,
  applicationName: string,
  shouldContinue: () => boolean,
): Promise<{ waitEvent: string | null } | null> {
  const deadline = Date.now() + OBSERVATION_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (!shouldContinue()) return null
    const waiting = await observer.$queryRaw<
      Array<{ waitEvent: string | null }>
    >`
      SELECT wait_event AS "waitEvent"
      FROM pg_stat_activity
      WHERE application_name = ${applicationName}
        AND state = 'active'
        AND wait_event_type = 'Lock'
        AND cardinality(pg_blocking_pids(pid)) > 0
      LIMIT 1
    `
    if (waiting[0]) return waiting[0]
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  if (!shouldContinue()) return null
  throw new Error(
    `Timed out waiting for PostgreSQL lock contention from ${applicationName}.`,
  )
}

async function createFixture(db: Db): Promise<Fixture> {
  const suffix = randomUUID().replaceAll('-', '')
  return db.$transaction(
    async (tx) => {
      const role = await tx.role.findUnique({ where: { code: 'HR_ADMIN' } })
      if (!role) {
        throw new Error('Concurrency fixture requires the seeded HR_ADMIN role.')
      }

      const [company, decoyCompany] = await Promise.all([
        tx.company.create({
          data: {
            code: `E2E-CONC-${suffix}`,
            name: `E2E Concurrency ${suffix}`,
            nameEn: `E2E Concurrency ${suffix}`,
            countryCode: 'KR',
            timezone: 'Asia/Seoul',
            locale: 'ko',
            currency: 'KRW',
          },
        }),
        tx.company.create({
          data: {
            code: `E2E-DECOY-${suffix}`,
            name: `E2E Decoy ${suffix}`,
            nameEn: `E2E Decoy ${suffix}`,
            countryCode: 'KR',
            timezone: 'Asia/Seoul',
            locale: 'ko',
            currency: 'KRW',
          },
        }),
      ])
      const [requester, reviewer, decoyEmployee] = await Promise.all([
        tx.employee.create({
          data: {
            employeeNo: `E2E-REQ-${suffix}`,
            name: 'Concurrency Requester',
            email: `e2e-concurrency-requester-${suffix}@example.invalid`,
            hireDate: new Date('2020-01-01T00:00:00.000Z'),
            locale: 'ko',
            timezone: 'Asia/Seoul',
          },
        }),
        tx.employee.create({
          data: {
            employeeNo: `E2E-HR-${suffix}`,
            name: 'Concurrency Reviewer',
            email: `e2e-concurrency-reviewer-${suffix}@example.invalid`,
            hireDate: new Date('2020-01-01T00:00:00.000Z'),
            locale: 'ko',
            timezone: 'Asia/Seoul',
          },
        }),
        tx.employee.create({
          data: {
            employeeNo: `E2E-DECOY-${suffix}`,
            name: 'Concurrency Decoy',
            email: `e2e-concurrency-decoy-${suffix}@example.invalid`,
            hireDate: new Date('2020-01-01T00:00:00.000Z'),
            locale: 'ko',
            timezone: 'Asia/Seoul',
          },
        }),
      ])

      await tx.employeeAssignment.createMany({
        data: [
          { employeeId: requester.id, companyId: company.id },
          { employeeId: reviewer.id, companyId: company.id },
          { employeeId: decoyEmployee.id, companyId: decoyCompany.id },
        ].map(({ employeeId, companyId }) => ({
          employeeId,
          effectiveDate: new Date('2020-01-01T00:00:00.000Z'),
          changeType: 'HIRE',
          companyId,
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          isPrimary: true,
        })),
      })
      await tx.employeeRole.create({
        data: {
          employeeId: reviewer.id,
          roleId: role.id,
          companyId: company.id,
          startDate: new Date('2020-01-01T00:00:00.000Z'),
        },
      })
      await tx.attendanceSetting.createMany({
        data: [company.id, decoyCompany.id].map((companyId) => ({
          companyId,
          workStartTime: '08:30',
          workEndTime: '17:30',
          timezone: 'Asia/Seoul',
        })),
      })
      const [attendance, decoyAttendance] = await Promise.all([
        tx.attendance.create({
          data: {
            companyId: company.id,
            employeeId: requester.id,
            workDate: WORK_DATE,
            clockIn: CLOCK_IN,
            clockInMethod: 'WEB',
            workType: 'NORMAL',
            status: 'NORMAL',
          },
        }),
        tx.attendance.create({
          data: {
            companyId: decoyCompany.id,
            employeeId: decoyEmployee.id,
            workDate: WORK_DATE,
            clockIn: DECOY_CLOCK_IN,
            clockInMethod: 'WEB',
            workType: 'NORMAL',
            status: 'NORMAL',
            note: 'tenant decoy - must remain unchanged',
          },
        }),
      ])
      const decoyPayrollRun = await tx.payrollRun.create({
        data: {
          companyId: decoyCompany.id,
          createdById: decoyEmployee.id,
          name: 'Concurrency tenant decoy',
          runType: 'MONTHLY',
          yearMonth: YEAR_MONTH,
          year: YEAR,
          month: MONTH,
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          status: 'ATTENDANCE_CLOSED',
          attendanceClosedAt: FIXED_NOW,
          attendanceClosedBy: decoyEmployee.id,
          excludedEmployeeIds: [decoyEmployee.id],
        },
      })

      const requesterUser: SessionUser = {
        id: requester.id,
        employeeId: requester.id,
        companyId: company.id,
        name: requester.name,
        email: requester.email,
        role: 'EMPLOYEE',
        permissions: [],
      }
      const reviewerUser: SessionUser = {
        id: reviewer.id,
        employeeId: reviewer.id,
        companyId: company.id,
        name: reviewer.name,
        email: reviewer.email,
        role: 'HR_ADMIN',
        permissions: [],
      }

      return {
        companyId: company.id,
        requesterId: requester.id,
        reviewerId: reviewer.id,
        attendanceId: attendance.id,
        decoyCompanyId: decoyCompany.id,
        decoyEmployeeId: decoyEmployee.id,
        decoyAttendanceId: decoyAttendance.id,
        decoyPayrollRunId: decoyPayrollRun.id,
        requester: requesterUser,
        reviewer: reviewerUser,
      }
    },
    { timeout: FIXTURE_TRANSACTION_TIMEOUT_MS },
  )
}

async function cleanupFixture(db: Db, fixture: Fixture): Promise<void> {
  await db.$transaction(async (tx) => {
    const companyIds = [fixture.companyId, fixture.decoyCompanyId]
    const employeeIds = [
      fixture.requesterId,
      fixture.reviewerId,
      fixture.decoyEmployeeId,
    ]
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { companyId: { in: companyIds } },
          { actorId: { in: employeeIds } },
        ],
      },
    })
    await tx.attendanceApprovalRequest.deleteMany({
      where: { companyId: { in: companyIds } },
    })
    const runs = await tx.payrollRun.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    })
    const runIds = runs.map((run) => run.id)
    if (runIds.length > 0) {
      await tx.payrollApproval.deleteMany({
        where: { payrollRunId: { in: runIds } },
      })
      await tx.payrollAnomaly.deleteMany({
        where: { payrollRunId: { in: runIds } },
      })
      await tx.payrollAdjustment.deleteMany({
        where: { payrollRunId: { in: runIds } },
      })
      await tx.payrollItem.deleteMany({ where: { runId: { in: runIds } } })
      await tx.payrollRun.deleteMany({ where: { id: { in: runIds } } })
    }
    await tx.attendance.deleteMany({ where: { companyId: { in: companyIds } } })
    await tx.employeeRole.deleteMany({ where: { companyId: { in: companyIds } } })
    await tx.employeeAssignment.deleteMany({
      where: { companyId: { in: companyIds } },
    })
    await tx.attendanceSetting.deleteMany({
      where: { companyId: { in: companyIds } },
    })
    await tx.employee.deleteMany({
      where: {
        id: { in: employeeIds },
      },
    })
    await tx.company.deleteMany({ where: { id: { in: companyIds } } })
  }, { timeout: FIXTURE_TRANSACTION_TIMEOUT_MS })
}

function correctionInput(): Record<string, unknown> {
  return {
    clockIn: CORRECTED_CLOCK_IN.toISOString(),
    clockOut: null,
    reason: 'deterministic concurrency fixture',
  }
}

async function createCorrectionRequest(
  db: Db,
  fixture: Fixture,
  deps: Omit<CorrectionServiceDeps, 'db' | 'now'> = {},
): Promise<{ id: string; status: string }> {
  const request = await createAttendanceCorrectionRequest({
    attendanceId: fixture.attendanceId,
    input: correctionInput(),
    user: fixture.requester,
    deps: { ...deps, db, now: () => FIXED_NOW },
  })
  return { id: request.id, status: request.status }
}

async function approveCorrectionRequest(
  db: Db,
  fixture: Fixture,
  requestId: string,
  deps: Omit<CorrectionServiceDeps, 'db' | 'now'> = {},
): Promise<{ id: string; status: string }> {
  const request = await decideAttendanceCorrectionRequest({
    requestId,
    action: 'approve',
    user: fixture.reviewer,
    deps: { ...deps, db, now: () => FIXED_NOW },
  })
  return { id: request.id, status: request.status }
}

async function applyDirectCorrection(
  db: Db,
  fixture: Fixture,
  deps: Omit<CorrectionServiceDeps, 'db' | 'now'> = {},
): Promise<{ id: string; clockOut: string | null; note: string | null }> {
  const attendance = await applyDirectAttendanceCorrection({
    attendanceId: fixture.attendanceId,
    input: {
      clockOut: '2026-07-15T08:40:00.000Z',
      note: 'deterministic direct correction',
    },
    user: fixture.reviewer,
    deps: { ...deps, db, now: () => FIXED_NOW },
  })
  return {
    id: attendance.id,
    clockOut: attendance.clockOut?.toISOString() ?? null,
    note: attendance.note,
  }
}

async function clockOut(
  db: Db,
  fixture: Fixture,
  deps: Parameters<typeof completeClockOutEvent>[0]['deps'] = {},
  source: 'web' | 'terminal' = 'web',
): Promise<{ id: string; clockOut: string | null }> {
  const result = await completeClockOutEvent({
    companyId: fixture.companyId,
    employeeId: fixture.requesterId,
    eventTime: RECORDED_CLOCK_OUT,
    method: source === 'web' ? 'WEB' : 'CARD_READER',
    source,
    overtimeBreakPolicy: source === 'web' ? 'default' : 'graduated',
    deps: { ...deps, db },
  })
  return {
    id: result.attendance.id,
    clockOut: result.attendance.clockOut?.toISOString() ?? null,
  }
}

async function closePeriod(
  db: Db,
  fixture: Fixture,
  deps: Parameters<typeof closeAttendancePeriod>[0]['deps'] = {},
): Promise<{ id: string; status: string }> {
  const result = await closeAttendancePeriod({
    companyId: fixture.companyId,
    year: YEAR,
    month: MONTH,
    excludeEmployeeIds: [fixture.requesterId, fixture.reviewerId],
    actorId: fixture.reviewerId,
    deps: { ...deps, db },
  })
  return { id: result.payrollRun.id, status: result.payrollRun.status }
}

async function createPayrollRun(
  db: Db,
  fixture: Fixture,
  status: 'ATTENDANCE_CLOSED' | 'REVIEW',
): Promise<{ id: string; companyId: string; yearMonth: string }> {
  return db.payrollRun.create({
    data: {
      companyId: fixture.companyId,
      createdById: fixture.reviewerId,
      name: `Concurrency ${status}`,
      runType: 'MONTHLY',
      yearMonth: YEAR_MONTH,
      year: YEAR,
      month: MONTH,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status,
      attendanceClosedAt: FIXED_NOW,
      attendanceClosedBy: fixture.reviewerId,
      excludedEmployeeIds: [fixture.requesterId, fixture.reviewerId],
    },
    select: { id: true, companyId: true, yearMonth: true },
  })
}

async function readFinalState(
  db: Db,
  fixture: Fixture,
  requestId?: string,
): Promise<Record<string, unknown>> {
  const [
    attendance,
    request,
    pendingCount,
    run,
    itemCount,
    correctionCreateAuditCount,
    correctionApprovalAuditCount,
    directCorrectionAuditCount,
    decoyAttendance,
    decoyPayrollRun,
  ] = await Promise.all([
    db.attendance.findUnique({
      where: { id: fixture.attendanceId },
      select: {
        clockIn: true,
        clockOut: true,
        totalMinutes: true,
        overtimeMinutes: true,
        note: true,
      },
    }),
    requestId
      ? db.attendanceApprovalRequest.findUnique({
          where: { id: requestId },
          select: {
            status: true,
            steps: {
              select: { status: true },
              orderBy: [{ stepOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        })
      : null,
    db.attendanceApprovalRequest.count({
      where: {
        companyId: fixture.companyId,
        requestType: 'attendance_correction',
        status: 'pending',
      },
    }),
    db.payrollRun.findUnique({
      where: {
        companyId_yearMonth_runType: {
          companyId: fixture.companyId,
          yearMonth: YEAR_MONTH,
          runType: 'MONTHLY',
        },
      },
      select: { id: true, status: true },
    }),
    db.payrollItem.count({
      where: { run: { companyId: fixture.companyId } },
    }),
    db.auditLog.count({
      where: {
        companyId: fixture.companyId,
        action: 'ATTENDANCE_CORRECTION_REQUEST_CREATE',
      },
    }),
    db.auditLog.count({
      where: {
        companyId: fixture.companyId,
        action: 'ATTENDANCE_CORRECTION_APPROVE',
      },
    }),
    db.auditLog.count({
      where: {
        companyId: fixture.companyId,
        action: 'attendance.manual_correction',
      },
    }),
    db.attendance.findUnique({
      where: { id: fixture.decoyAttendanceId },
      select: { clockIn: true, clockOut: true, note: true },
    }),
    db.payrollRun.findUnique({
      where: { id: fixture.decoyPayrollRunId },
      select: { status: true },
    }),
  ])

  return {
    attendanceClockIn: attendance?.clockIn?.toISOString() ?? null,
    attendanceClockOut: attendance?.clockOut?.toISOString() ?? null,
    attendanceTotalMinutes: attendance?.totalMinutes ?? null,
    attendanceOvertimeMinutes: attendance?.overtimeMinutes ?? null,
    attendanceNote: attendance?.note ?? null,
    attendanceMutationAuditCount:
      correctionApprovalAuditCount + directCorrectionAuditCount,
    correctionCreateAuditCount,
    correctionApprovalAuditCount,
    directCorrectionAuditCount,
    requestStatus: request?.status ?? null,
    requestStepStatuses: request?.steps.map((step) => step.status) ?? [],
    pendingCorrectionCount: pendingCount,
    payrollRunId: run?.id ?? null,
    payrollStatus: run?.status ?? null,
    payrollItemCount: itemCount,
    decoyAttendanceClockIn: decoyAttendance?.clockIn?.toISOString() ?? null,
    decoyAttendanceClockOut: decoyAttendance?.clockOut?.toISOString() ?? null,
    decoyAttendanceNote: decoyAttendance?.note ?? null,
    decoyPayrollStatus: decoyPayrollRun?.status ?? null,
  }
}

async function waitForOperationSignal(
  signal: Promise<void>,
  operation: Promise<OperationOutcome>,
  description: string,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      signal,
      operation.then(() => {
        throw new Error(`Operation settled before ${description}.`)
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out waiting for ${description}.`)),
          OBSERVATION_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function heldFirstRace(params: {
  scenarioId: string
  barriers: BarrierController
  observer: Db
  primary: (hold: (context: Record<string, unknown>) => Promise<void>) => Promise<OperationOutcome>
  contender: () => Promise<OperationOutcome>
}): Promise<{ primary: OperationOutcome; contender: OperationOutcome }> {
  const entered = deferred<void>()
  const primary = params.primary(async (context) => {
    entered.resolve()
    await params.barriers.wait(params.scenarioId, 'winner-held', context)
  })
  let contender: Promise<OperationOutcome> | undefined
  try {
    await waitForOperationSignal(entered.promise, primary, 'winner lock barrier')
    contender = params.contender()
    const lockWait = await waitForClientLockWait(
      params.observer,
      CLIENT_B_APPLICATION_NAME,
      () => params.barriers.isActive(params.scenarioId),
    )
    if (lockWait) {
      await params.barriers.wait(params.scenarioId, 'contender-blocked', {
        kind: 'postgres-lock-wait',
        waitEvent: lockWait.waitEvent,
      })
    }
    const [primaryResult, contenderResult] = await Promise.all([
      primary,
      contender,
    ])
    return { primary: primaryResult, contender: contenderResult }
  } catch (error) {
    params.barriers.cancelScenario(params.scenarioId)
    await Promise.allSettled([primary, ...(contender ? [contender] : [])])
    throw error
  }
}

async function waitForContenderBlocked(params: {
  scenarioId: string
  barriers: BarrierController
  observer: Db
  contender: Promise<OperationOutcome>
  candidateEntered: Promise<void>
  candidateReleased: Promise<void>
  description: string
}): Promise<void> {
  await waitForOperationSignal(
    params.candidateEntered,
    params.contender,
    `${params.description} candidate barrier`,
  )
  await waitForOperationSignal(
    params.candidateReleased,
    params.contender,
    `${params.description} candidate release`,
  )
  const lockWait = await waitForClientLockWait(
    params.observer,
    CLIENT_B_APPLICATION_NAME,
    () => params.barriers.isActive(params.scenarioId),
  )
  if (!lockWait) return
  await params.barriers.wait(params.scenarioId, 'contender-blocked', {
    kind: 'postgres-lock-wait',
    waitEvent: lockWait.waitEvent,
    operation: params.description,
  })
}

async function waitForPayrollStatus(
  db: Db,
  runId: string,
  expected: string,
  shouldContinue: () => boolean = () => true,
): Promise<boolean> {
  const deadline = Date.now() + OBSERVATION_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (!shouldContinue()) return false
    const run = await db.payrollRun.findUnique({
      where: { id: runId },
      select: { status: true },
    })
    if (run?.status === expected) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Timed out waiting for payroll status ${expected}.`)
}

async function duplicateCorrectionCreate(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  fixture: Fixture,
): Promise<Record<string, unknown>> {
  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    primary: (hold) =>
      outcome(() =>
        createCorrectionRequest(dbA, fixture, {
          afterAttendanceRowLock: (context) => hold(context),
        }),
      ),
    contender: () => outcome(() => createCorrectionRequest(dbB, fixture)),
  })
  const request = await dbA.attendanceApprovalRequest.findFirst({
    where: { companyId: fixture.companyId, requestType: 'attendance_correction' },
    select: { id: true },
  })
  return {
    outcomes: race,
    final: await readFinalState(dbA, fixture, request?.id),
  }
}

async function approveVsClockOut(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  fixture: Fixture,
  first: 'approve' | 'clock-out',
): Promise<Record<string, unknown>> {
  const request = await createCorrectionRequest(dbA, fixture)

  if (first === 'approve') {
    const approveEntered = deferred<void>()
    const clockCandidateEntered = deferred<void>()
    const clockCandidateReleased = deferred<void>()
    const approval = outcome(() =>
      approveCorrectionRequest(dbA, fixture, request.id, {
        afterAttendanceRowLock: async (context) => {
          approveEntered.resolve()
          await barriers.wait(scenarioId, 'approve-row-held', context)
        },
      }),
    )
    let clock: Promise<OperationOutcome> | undefined
    try {
      await waitForOperationSignal(
        approveEntered.promise,
        approval,
        'approval row lock barrier',
      )
      clock = outcome(() =>
        clockOut(dbB, fixture, {
          afterCandidateRead: async (context) => {
            clockCandidateEntered.resolve()
            await barriers.wait(scenarioId, 'clock-candidate-held', context)
            clockCandidateReleased.resolve()
          },
        }),
      )
      await waitForContenderBlocked({
        scenarioId,
        barriers,
        observer: dbA,
        contender: clock,
        candidateEntered: clockCandidateEntered.promise,
        candidateReleased: clockCandidateReleased.promise,
        description: 'clock-out',
      })
      const [approvalResult, clockResult] = await Promise.all([approval, clock])
      return {
        outcomes: { approval: approvalResult, clockOut: clockResult },
        final: await readFinalState(dbA, fixture, request.id),
      }
    } catch (error) {
      barriers.cancelScenario(scenarioId)
      await Promise.allSettled([approval, ...(clock ? [clock] : [])])
      throw error
    }
  }

  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    primary: (hold) =>
      outcome(() =>
        clockOut(dbA, fixture, {
          afterAttendanceRowLock: (context) => hold(context),
        }),
      ),
    contender: () =>
      outcome(() => approveCorrectionRequest(dbB, fixture, request.id)),
  })
  return {
    outcomes: { clockOut: race.primary, approval: race.contender },
    final: await readFinalState(dbA, fixture, request.id),
  }
}

async function approveVsDirectCorrection(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  fixture: Fixture,
  first: 'approve' | 'direct',
): Promise<Record<string, unknown>> {
  const request = await createCorrectionRequest(dbA, fixture)

  if (first === 'approve') {
    const approvalEntered = deferred<void>()
    const directCandidateEntered = deferred<void>()
    const directCandidateReleased = deferred<void>()
    const approval = outcome(() =>
      approveCorrectionRequest(dbA, fixture, request.id, {
        afterAttendanceRowLock: async (context) => {
          approvalEntered.resolve()
          await barriers.wait(scenarioId, 'approval-row-held', { ...context })
        },
      }),
    )
    let directCorrection: Promise<OperationOutcome> | undefined
    try {
      await waitForOperationSignal(
        approvalEntered.promise,
        approval,
        'approval row lock barrier',
      )
      directCorrection = outcome(() =>
        applyDirectCorrection(dbB, fixture, {
          afterCandidateRead: async (context) => {
            directCandidateEntered.resolve()
            await barriers.wait(scenarioId, 'direct-candidate-held', {
              ...context,
            })
            directCandidateReleased.resolve()
          },
        }),
      )
      await waitForContenderBlocked({
        scenarioId,
        barriers,
        observer: dbA,
        contender: directCorrection,
        candidateEntered: directCandidateEntered.promise,
        candidateReleased: directCandidateReleased.promise,
        description: 'direct-correction',
      })
      const [approvalResult, directResult] = await Promise.all([
        approval,
        directCorrection,
      ])
      return {
        outcomes: { approval: approvalResult, directCorrection: directResult },
        final: await readFinalState(dbA, fixture, request.id),
      }
    } catch (error) {
      barriers.cancelScenario(scenarioId)
      await Promise.allSettled([
        approval,
        ...(directCorrection ? [directCorrection] : []),
      ])
      throw error
    }
  }

  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    primary: (hold) =>
      outcome(() =>
        applyDirectCorrection(dbA, fixture, {
          afterAttendanceRowLock: (context) => hold({ ...context }),
        }),
      ),
    contender: () =>
      outcome(() => approveCorrectionRequest(dbB, fixture, request.id)),
  })
  return {
    outcomes: { directCorrection: race.primary, approval: race.contender },
    final: await readFinalState(dbA, fixture, request.id),
  }
}

async function concurrentClockOut(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  fixture: Fixture,
): Promise<Record<string, unknown>> {
  const winnerEntered = deferred<void>()
  const contenderCandidateEntered = deferred<void>()
  const contenderCandidateReleased = deferred<void>()
  const webClockOut = outcome(() =>
    clockOut(dbA, fixture, {
      afterAttendanceRowLock: async (context) => {
        winnerEntered.resolve()
        await barriers.wait(scenarioId, 'winner-held', { ...context })
      },
    }),
  )
  let terminalClockOut: Promise<OperationOutcome> | undefined
  try {
    await waitForOperationSignal(
      winnerEntered.promise,
      webClockOut,
      'web clock-out row lock barrier',
    )
    terminalClockOut = outcome(() =>
      clockOut(
        dbB,
        fixture,
        {
          afterCandidateRead: async (context) => {
            contenderCandidateEntered.resolve()
            await barriers.wait(scenarioId, 'contender-candidate-held', {
              ...context,
            })
            contenderCandidateReleased.resolve()
          },
        },
        'terminal',
      ),
    )
    await waitForContenderBlocked({
      scenarioId,
      barriers,
      observer: dbA,
      contender: terminalClockOut,
      candidateEntered: contenderCandidateEntered.promise,
      candidateReleased: contenderCandidateReleased.promise,
      description: 'terminal-clock-out',
    })
    const [webResult, terminalResult] = await Promise.all([
      webClockOut,
      terminalClockOut,
    ])
    return {
      outcomes: { webClockOut: webResult, terminalClockOut: terminalResult },
      final: await readFinalState(dbA, fixture),
    }
  } catch (error) {
    barriers.cancelScenario(scenarioId)
    await Promise.allSettled([
      webClockOut,
      ...(terminalClockOut ? [terminalClockOut] : []),
    ])
    throw error
  }
}

async function closeVsCorrectionCreate(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  fixture: Fixture,
  first: 'close' | 'create',
): Promise<Record<string, unknown>> {
  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    primary: (hold) =>
      first === 'close'
        ? outcome(() =>
            closePeriod(dbA, fixture, {
              afterPeriodLock: async (context) => {
                if (!context.key.startsWith('attendance-period:')) return
                await hold({ ...context })
              },
            }),
          )
        : outcome(() =>
            createCorrectionRequest(dbA, fixture, {
              afterAttendanceRowLock: (context) => hold(context),
            }),
          ),
    contender: () =>
      first === 'close'
        ? outcome(() => createCorrectionRequest(dbB, fixture))
        : outcome(() => closePeriod(dbB, fixture)),
  })
  const request = await dbA.attendanceApprovalRequest.findFirst({
    where: { companyId: fixture.companyId, requestType: 'attendance_correction' },
    select: { id: true },
  })
  return {
    outcomes:
      first === 'close'
        ? { close: race.primary, create: race.contender }
        : { create: race.primary, close: race.contender },
    final: await readFinalState(dbA, fixture, request?.id),
  }
}

async function closeVsCorrectionApprove(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  fixture: Fixture,
  first: 'close' | 'approve',
): Promise<Record<string, unknown>> {
  const request = await createCorrectionRequest(dbA, fixture)
  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    primary: (hold) =>
      first === 'close'
        ? outcome(() =>
            closePeriod(dbA, fixture, {
              afterPeriodLock: async (context) => {
                if (!context.key.startsWith('attendance-period:')) return
                await hold({ ...context })
              },
            }),
          )
        : outcome(() =>
            approveCorrectionRequest(dbA, fixture, request.id, {
              afterAttendanceRowLock: (context) => hold(context),
            }),
          ),
    contender: () =>
      first === 'close'
        ? outcome(() => approveCorrectionRequest(dbB, fixture, request.id))
        : outcome(() => closePeriod(dbB, fixture)),
  })
  return {
    outcomes:
      first === 'close'
        ? { close: race.primary, approval: race.contender }
        : { approval: race.primary, close: race.contender },
    final: await readFinalState(dbA, fixture, request.id),
  }
}

async function calculateVsReopen(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  fixture: Fixture,
  first: 'calculate' | 'reopen',
): Promise<Record<string, unknown>> {
  const run = await createPayrollRun(dbA, fixture, 'ATTENDANCE_CLOSED')

  if (first === 'calculate') {
    const calculationEntered = deferred<void>()
    const reopenRegistryEntered = deferred<void>()
    const calculation = outcome(async () => {
      const result = await calculatePayrollRun(run.id, {
        mode: 'gp3',
        authorizedCompanyId: fixture.companyId,
        actorId: fixture.reviewerId,
        deps: {
          db: dbA,
          afterPayrollRunLock: async (context) => {
            if (context.operation !== 'payroll-gp3-calculate-start') return
            calculationEntered.resolve()
            await barriers.wait(scenarioId, 'calculation-run-held', context)
          },
        },
      })
      return { id: result.payrollRun.id, status: result.payrollRun.status }
    })
    let reopen: Promise<OperationOutcome> | undefined
    try {
      await waitForOperationSignal(
        calculationEntered.promise,
        calculation,
        'calculation run lock barrier',
      )

      reopen = outcome(async () => {
        const result = await reopenAttendancePeriod({
          payrollRunId: run.id,
          companyId: fixture.companyId,
          actorId: fixture.reviewerId,
          deps: {
            db: dbB,
            afterPeriodLock: async (context) => {
              if (!context.key.startsWith('payroll-run-registry:')) return
              reopenRegistryEntered.resolve()
              await barriers.wait(scenarioId, 'reopen-registry-held', {
                ...context,
              })
            },
          },
        })
        return { id: result.payrollRun.id, status: result.payrollRun.status }
      })
      await waitForOperationSignal(
        reopenRegistryEntered.promise,
        reopen,
        'reopen registry lock barrier',
      )

      const calculationStarted = await waitForPayrollStatus(
        dbA,
        run.id,
        'CALCULATING',
        () => barriers.isActive(scenarioId),
      )
      if (calculationStarted) {
        await barriers.wait(scenarioId, 'calculation-started', {
          runId: run.id,
          status: 'CALCULATING',
        })
      }
      const [calculationResult, reopenResult] = await Promise.all([
        calculation,
        reopen,
      ])
      return {
        outcomes: { calculation: calculationResult, reopen: reopenResult },
        final: await readFinalState(dbA, fixture),
      }
    } catch (error) {
      barriers.cancelScenario(scenarioId)
      await Promise.allSettled([calculation, ...(reopen ? [reopen] : [])])
      throw error
    }
  }

  const calculationCandidateEntered = deferred<void>()
  const reopenEntered = deferred<void>()
  const calculation = outcome(async () => {
    const result = await calculatePayrollRun(run.id, {
      mode: 'gp3',
      authorizedCompanyId: fixture.companyId,
      actorId: fixture.reviewerId,
      deps: {
        db: dbA,
        afterCandidateRead: async (context) => {
          calculationCandidateEntered.resolve()
          await barriers.wait(scenarioId, 'calculation-candidate-held', context)
        },
      },
    })
    return { id: result.payrollRun.id, status: result.payrollRun.status }
  })
  let reopen: Promise<OperationOutcome> | undefined
  try {
    await waitForOperationSignal(
      calculationCandidateEntered.promise,
      calculation,
      'calculation candidate barrier',
    )
    reopen = outcome(async () => {
      const result = await reopenAttendancePeriod({
        payrollRunId: run.id,
        companyId: fixture.companyId,
        actorId: fixture.reviewerId,
        deps: {
          db: dbB,
          afterPayrollRunLock: async (context) => {
            reopenEntered.resolve()
            await barriers.wait(scenarioId, 'reopen-run-held', context)
          },
        },
      })
      return { id: result.payrollRun.id, status: result.payrollRun.status }
    })
    await waitForOperationSignal(
      reopenEntered.promise,
      reopen,
      'reopen run lock barrier',
    )
    const reopenResult = await reopen
    await barriers.wait(scenarioId, 'reopen-committed', {
      runId: run.id,
      status: 'DRAFT',
    })
    const calculationResult = await calculation
    return {
      outcomes: { calculation: calculationResult, reopen: reopenResult },
      final: await readFinalState(dbA, fixture),
    }
  } catch (error) {
    barriers.cancelScenario(scenarioId)
    await Promise.allSettled([calculation, ...(reopen ? [reopen] : [])])
    throw error
  }
}

async function phaseWriterVsReopen(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  fixture: Fixture,
  first: 'writer' | 'reopen',
): Promise<Record<string, unknown>> {
  const run = await createPayrollRun(dbA, fixture, 'REVIEW')
  const itemId = randomUUID()

  const writer = (
    db: Db,
    hold?: (context: Record<string, unknown>) => Promise<void>,
  ) =>
    outcome(async () => {
      const result = await withLockedPayrollRunPhase({
        candidate: run,
        expectedStatus: 'REVIEW',
        operation: 'e2e-payroll-item-write',
        statusError: (status) => `Expected REVIEW, received ${status}`,
        deps: {
          db,
          ...(hold
            ? { afterPayrollRunLock: (context) => hold(context) }
            : {}),
        },
        mutate: async (tx, lockedRun) => {
          await tx.payrollItem.create({
            data: {
              id: itemId,
              runId: lockedRun.id,
              employeeId: fixture.requesterId,
              baseSalary: 100,
              grossPay: 100,
              deductions: 0,
              netPay: 100,
            },
          })
          await updatePayrollRunInPhase(tx, lockedRun, 'REVIEW', {
            headcount: 1,
            totalGross: 100,
            totalDeductions: 0,
            totalNet: 100,
          })
          return { id: lockedRun.id, itemId }
        },
      })
      return result
    })

  const reopen = (
    db: Db,
    hold?: (context: Record<string, unknown>) => Promise<void>,
  ) =>
    outcome(async () => {
      const result = await reopenAttendancePeriod({
        payrollRunId: run.id,
        companyId: fixture.companyId,
        actorId: fixture.reviewerId,
        deps: {
          db,
          ...(hold
            ? { afterPayrollRunLock: (context) => hold(context) }
            : {}),
        },
      })
      return { id: result.payrollRun.id, status: result.payrollRun.status }
    })

  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    primary: (hold) =>
      first === 'writer' ? writer(dbA, hold) : reopen(dbA, hold),
    contender: () =>
      first === 'writer' ? reopen(dbB) : writer(dbB),
  })
  return {
    outcomes:
      first === 'writer'
        ? { writer: race.primary, reopen: race.contender }
        : { reopen: race.primary, writer: race.contender },
    final: await readFinalState(dbA, fixture),
  }
}

async function tenantBoundaryDecoy(
  dbA: Db,
  fixture: Fixture,
): Promise<Record<string, unknown>> {
  const correctionCreate = await outcome(async () => {
    const result = await createAttendanceCorrectionRequest({
      attendanceId: fixture.decoyAttendanceId,
      input: correctionInput(),
      user: fixture.requester,
      deps: { db: dbA, now: () => FIXED_NOW },
    })
    return { id: result.id, status: result.status }
  })
  const directCorrection = await outcome(async () => {
    const result = await applyDirectAttendanceCorrection({
      attendanceId: fixture.decoyAttendanceId,
      input: {
        clockOut: '2026-07-15T08:40:00.000Z',
        note: 'must not cross tenant boundary',
      },
      user: fixture.reviewer,
      deps: { db: dbA, now: () => FIXED_NOW },
    })
    return { id: result.id }
  })
  const calculation = await outcome(async () => {
    const result = await calculatePayrollRun(fixture.decoyPayrollRunId, {
      mode: 'gp3',
      authorizedCompanyId: fixture.companyId,
      actorId: fixture.reviewerId,
      deps: { db: dbA },
    })
    return { id: result.payrollRun.id, status: result.payrollRun.status }
  })
  const phaseWriter = await outcome(async () => {
    const result = await withLockedPayrollRunPhase({
      candidate: {
        id: fixture.decoyPayrollRunId,
        companyId: fixture.companyId,
        yearMonth: YEAR_MONTH,
      },
      expectedStatus: 'ATTENDANCE_CLOSED',
      operation: 'e2e-tenant-boundary-decoy',
      statusError: 'Tenant decoy must not be writable.',
      deps: { db: dbA },
      mutate: async () => ({ id: fixture.decoyPayrollRunId }),
    })
    return result
  })

  return {
    outcomes: { correctionCreate, directCorrection, calculation, phaseWriter },
    final: await readFinalState(dbA, fixture),
  }
}

async function executeScenario(
  command: ScenarioCommand,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
): Promise<Record<string, unknown>> {
  const fixture = await createFixture(dbA)
  try {
    switch (command.name) {
      case 'duplicate-correction-create':
        return await duplicateCorrectionCreate(command.id, barriers, dbA, dbB, fixture)
      case 'approve-vs-clock-out-approve-first':
        return await approveVsClockOut(command.id, barriers, dbA, dbB, fixture, 'approve')
      case 'approve-vs-clock-out-clock-out-first':
        return await approveVsClockOut(command.id, barriers, dbA, dbB, fixture, 'clock-out')
      case 'concurrent-clock-out':
        return await concurrentClockOut(command.id, barriers, dbA, dbB, fixture)
      case 'approve-vs-direct-correction-approve-first':
        return await approveVsDirectCorrection(
          command.id,
          barriers,
          dbA,
          dbB,
          fixture,
          'approve',
        )
      case 'approve-vs-direct-correction-direct-first':
        return await approveVsDirectCorrection(
          command.id,
          barriers,
          dbA,
          dbB,
          fixture,
          'direct',
        )
      case 'close-vs-correction-create-close-first':
        return await closeVsCorrectionCreate(command.id, barriers, dbA, dbB, fixture, 'close')
      case 'close-vs-correction-create-create-first':
        return await closeVsCorrectionCreate(command.id, barriers, dbA, dbB, fixture, 'create')
      case 'close-vs-correction-approve-close-first':
        return await closeVsCorrectionApprove(command.id, barriers, dbA, dbB, fixture, 'close')
      case 'close-vs-correction-approve-approve-first':
        return await closeVsCorrectionApprove(command.id, barriers, dbA, dbB, fixture, 'approve')
      case 'calculate-start-vs-reopen-calculate-first':
        return await calculateVsReopen(command.id, barriers, dbA, dbB, fixture, 'calculate')
      case 'calculate-start-vs-reopen-reopen-first':
        return await calculateVsReopen(command.id, barriers, dbA, dbB, fixture, 'reopen')
      case 'phase-writer-vs-reopen-writer-first':
        return await phaseWriterVsReopen(command.id, barriers, dbA, dbB, fixture, 'writer')
      case 'phase-writer-vs-reopen-reopen-first':
        return await phaseWriterVsReopen(command.id, barriers, dbA, dbB, fixture, 'reopen')
      case 'tenant-boundary-decoy':
        return await tenantBoundaryDecoy(dbA, fixture)
    }
    throw new Error(`Unhandled concurrency scenario: ${command.name}`)
  } finally {
    try {
      await cleanupFixture(dbA, fixture)
    } finally {
      barriers.finishScenario(command.id)
    }
  }
}

async function main(): Promise<void> {
  if (process.env.RUN_DB_CONCURRENCY_TESTS !== '1') {
    emit({
      type: 'ready',
      ok: false,
      error: 'RUN_DB_CONCURRENCY_TESTS=1 is required by the concurrency harness.',
    })
    return
  }
  const connectionString = process.env.TEST_DATABASE_URL
  if (!connectionString) {
    emit({
      type: 'ready',
      ok: false,
      error: 'TEST_DATABASE_URL is required by the concurrency harness.',
    })
    return
  }
  let expectedDatabaseName: string
  try {
    expectedDatabaseName = parseSafeTestDatabaseName(connectionString)
  } catch (error) {
    emit({ type: 'ready', ok: false, error: serializeError(error) })
    return
  }

  const clientA = createOwnedClient(connectionString, CLIENT_A_APPLICATION_NAME)
  const clientB = createOwnedClient(connectionString, CLIENT_B_APPLICATION_NAME)
  const barriers = new BarrierController()
  let active: Promise<void> | null = null
  let shuttingDown = false
  let shutdownPromise: Promise<void> | null = null

  const disconnect = async (): Promise<void> => {
    await Promise.allSettled([clientA.raw.$disconnect(), clientB.raw.$disconnect()])
  }

  const shutdown = (id: string): Promise<void> => {
    if (shutdownPromise) return shutdownPromise
    shuttingDown = true
    barriers.close()
    shutdownPromise = (async () => {
      if (active) await active
      await disconnect()
      emit({ type: 'teardown', id, ok: true })
    })()
    return shutdownPromise
  }

  process.once('SIGTERM', () => {
    void shutdown('signal').finally(() => process.exit(0))
  })
  process.once('SIGINT', () => {
    void shutdown('signal').finally(() => process.exit(0))
  })

  try {
    await Promise.all([clientA.raw.$connect(), clientB.raw.$connect()])
    const [database] = await clientA.db.$queryRaw<
      Array<{ databaseName: string }>
    >`SELECT current_database() AS "databaseName"`
    if (
      !database ||
      database.databaseName !== expectedDatabaseName ||
      !SAFE_TEST_DATABASE_PATTERN.test(database.databaseName)
    ) {
      throw new Error(
        `Live database safety marker mismatch: expected "${expectedDatabaseName}", received "${database?.databaseName ?? 'unknown'}".`,
      )
    }
    const role = await clientA.db.role.findUnique({ where: { code: 'HR_ADMIN' } })
    if (!role) throw new Error('Seeded HR_ADMIN role is missing.')
  } catch (error) {
    emit({ type: 'ready', ok: false, error: serializeError(error) })
    await disconnect()
    return
  }

  const input = readline.createInterface({ input: process.stdin })
  input.on('line', (line) => {
    let command: HarnessCommand
    try {
      command = JSON.parse(line) as HarnessCommand
    } catch (error) {
      emit({ type: 'protocol-error', error: serializeError(error) })
      return
    }

    if (command.type === 'release') {
      barriers.release(command)
      return
    }
    if (command.type === 'cancel') {
      barriers.cancelScenario(command.id)
      emit({ type: 'cancel', id: command.id, ok: true })
      return
    }
    if (command.type === 'teardown') {
      void shutdown(command.id).finally(() => input.close())
      return
    }
    if (shuttingDown) {
      emit({
        type: 'result',
        id: command.id,
        ok: false,
        error: { name: 'HarnessError', message: 'Harness is shutting down.' },
      })
      return
    }
    if (active) {
      emit({
        type: 'result',
        id: command.id,
        ok: false,
        error: { name: 'HarnessError', message: 'Another scenario is active.' },
      })
      return
    }
    if (!SCENARIOS.includes(command.name)) {
      emit({
        type: 'result',
        id: command.id,
        ok: false,
        error: { name: 'HarnessError', message: `Unknown scenario: ${command.name}` },
      })
      return
    }

    emit({ type: 'scenario', id: command.id, name: command.name, ok: true })
    active = (async () => {
      try {
        const data = await executeScenario(
          command,
          barriers,
          clientA.db,
          clientB.db,
        )
        emit({ type: 'result', id: command.id, ok: true, data })
      } catch (error) {
        emit({
          type: 'result',
          id: command.id,
          ok: false,
          error: serializeError(error),
        })
      } finally {
        active = null
      }
    })()
  })
  input.on('close', () => {
    void shutdown('stdin-closed')
  })

  emit({
    type: 'ready',
    ok: true,
    protocol: 2,
    databaseName: expectedDatabaseName,
    scenarios: SCENARIOS,
  })
}

void main().catch((error) => {
  emit({ type: 'ready', ok: false, error: serializeError(error) })
  process.exitCode = 1
})
