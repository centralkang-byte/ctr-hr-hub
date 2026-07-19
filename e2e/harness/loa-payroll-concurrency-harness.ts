import { randomUUID } from 'node:crypto'
import readline from 'node:readline'

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import {
  transitionLeaveOfAbsence,
  type LoaTransitionDeps,
  type LoaTransitionInput,
} from '@/lib/loa/service'
import {
  acquireExclusivePeriodLock,
  acquirePayrollRunRegistryLock,
  type PeriodLockHookContext,
} from '@/lib/attendance/period-lock'
import {
  primaryAssignmentDepartmentScopeKey,
  revalidatePrimaryAssignmentMasterDataSet,
  sortPrimaryAssignmentDepartmentScopes,
  type PrimaryAssignmentDepartmentScope,
  type PrimaryAssignmentLockHooks,
} from '@/lib/employee/primary-assignment-writer'
import {
  lockActivePositionReferences,
  softDeletePositionMaster,
  type SoftDeletePositionMasterDeps,
} from '@/lib/employee/assignment-master-lifecycle'
import { createAssignment } from '@/lib/assignments'
import { conflict } from '@/lib/errors'
import { softDeleteDepartment } from '@/lib/org/department-lifecycle'
import {
  createPayrollRunWithInitialLoaChildrenLocked,
  createPayrollRunWithInitialLoaChildren,
  type PayrollRunCreationDeps,
  type PayrollRunCreationInput,
} from '@/lib/payroll/run-service'

type Db = NonNullable<LoaTransitionDeps['db']>

const SOURCE_YEAR_MONTH = '2025-01'
const LATER_YEAR_MONTH = '2025-02'
const LOA_START = new Date('2025-01-06T00:00:00.000Z')
const LOA_EXPECTED_END = new Date('2025-01-31T00:00:00.000Z')
const LOA_ACTUAL_END = '2025-01-17'
const CURRENT_ASSIGNMENT_START = new Date('2020-01-01T00:00:00.000Z')
const FUTURE_ASSIGNMENT_START = new Date('2099-01-01T00:00:00.000Z')
const WRITER_AFTER_LOA_START = new Date('2025-01-07T00:00:00.000Z')
const FIXED_AUDIT_TIME = new Date('2025-02-03T00:00:00.000Z')
const ANNUAL_SALARY = 120_000_000
const OBSERVATION_TIMEOUT_MS = 15_000
const TEST_DATABASE_MARKERS = new Set(['test', 'e2e', 'ci', 'sandbox'])
const REQUIRED_APPLICATION_NAME = 'ctr-hr-hub-e2e'

const SCENARIOS = [
  'completed-before-run-base',
  'locked-source-later-compensation',
  'obligation-rollback-retry',
  'cancel-vs-complete-complete-first',
  'cancel-vs-complete-cancel-first',
  'future-assignment-activate',
  'future-assignment-complete',
  'future-assignment-cancel',
  'loa-first-vs-scheduled-primary-writer',
  'scheduled-primary-writer-first-vs-loa-activate',
  'department-delete-first-vs-assignment-writer',
  'assignment-writer-first-vs-department-delete',
  'assignment-writer-first-vs-position-delete',
  'position-delete-first-vs-hierarchy-writer',
] as const

type ScenarioName = (typeof SCENARIOS)[number]
type InitialLoaStatus = 'APPROVED' | 'ACTIVE' | 'RETURN_REQUESTED'
type InitialAssignmentStatus = 'ACTIVE' | 'ON_LEAVE'

interface FixtureConfig {
  initialLoaStatus: InitialLoaStatus
  initialAssignmentStatus: InitialAssignmentStatus
  includeFutureAssignment?: boolean
  includePosition?: boolean
}

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

type HarnessCommand = ScenarioCommand | ReleaseCommand | TeardownCommand

interface Fixture {
  companyId: string
  futureCompanyId: string
  sourceDepartmentId: string
  targetParentDepartmentId: string
  departmentId: string
  employeeId: string
  actorId: string
  loaTypeId: string
  loaId: string
  initialAssignmentId: string
  futureAssignmentId: string | null
  loaAssignmentId: string | null
  positionId: string | null
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

interface OwnedClient {
  raw: PrismaClient
  db: Db
  applicationName: string
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

  async wait(
    scenarioId: string,
    label: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    const token = `${scenarioId}:${label}`
    if (this.waiting.has(token)) {
      throw new Error(`Barrier already waiting: ${token}`)
    }
    const gate = deferred<void>()
    this.waiting.set(token, gate)
    emit({ type: 'barrier', id: scenarioId, token, label, context })
    await gate.promise
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

  releaseAll(): void {
    for (const gate of this.waiting.values()) gate.resolve()
    this.waiting.clear()
  }
}

function parseDatabaseUrl(value: string): URL {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.')
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('TEST_DATABASE_URL must use the PostgreSQL protocol.')
  }
  if (!parsed.hostname || !parsed.pathname.slice(1)) {
    throw new Error('TEST_DATABASE_URL must include a host and database name.')
  }
  return parsed
}

function databaseIdentity(value: string): string {
  const parsed = parseDatabaseUrl(value)
  return [
    parsed.hostname.toLowerCase(),
    parsed.port || '5432',
    decodeURIComponent(parsed.pathname.slice(1)),
  ].join('|')
}

function assertSafeTestDatabaseUrl(value: string, primaryDatabaseUrl?: string): URL {
  const parsed = parseDatabaseUrl(value)
  const databaseName = decodeURIComponent(parsed.pathname.slice(1))
  const databaseTokens = databaseName.toLowerCase().split(/[^a-z0-9]+/)
  const applicationName = parsed.searchParams.get('application_name')
  const hasDatabaseMarker = databaseTokens.some((token) => TEST_DATABASE_MARKERS.has(token))
  if (!hasDatabaseMarker && applicationName !== REQUIRED_APPLICATION_NAME) {
    throw new Error(
      'Unsafe TEST_DATABASE_URL: use a database name containing test/e2e/ci/sandbox, '
      + `or set application_name=${REQUIRED_APPLICATION_NAME}.`,
    )
  }
  if (
    primaryDatabaseUrl &&
    databaseIdentity(primaryDatabaseUrl) === databaseIdentity(value)
  ) {
    throw new Error('TEST_DATABASE_URL must not point to the same database as DATABASE_URL.')
  }
  return parsed
}

function withApplicationName(connectionString: string, applicationName: string): string {
  const parsed = new URL(connectionString)
  parsed.searchParams.set('application_name', applicationName)
  return parsed.toString()
}

function createOwnedClient(
  connectionString: string,
  label: 'a' | 'b',
): OwnedClient {
  const applicationName = `ctr-hr-hub-loa-concurrency-${label}-${process.pid}`
  const ownedConnectionString = withApplicationName(connectionString, applicationName)
  const isLocal =
    ownedConnectionString.includes('localhost') ||
    ownedConnectionString.includes('127.0.0.1')
  const isSupabase =
    ownedConnectionString.includes('supabase.co') ||
    ownedConnectionString.includes('supabase.com')
  const adapter = new PrismaPg({
    connectionString: ownedConnectionString,
    ...(!isLocal && isSupabase
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
    max: 4,
  })
  const raw = new PrismaClient({ adapter })
  return { raw, db: raw as unknown as Db, applicationName }
}

async function assertConnectedDatabase(
  db: Db,
  expectedDatabaseName: string,
): Promise<void> {
  const rows = await db.$queryRaw<Array<{ database_name: string }>>`
    SELECT current_database() AS database_name
  `
  if (rows[0]?.database_name !== expectedDatabaseName) {
    throw new Error('Connected database does not match TEST_DATABASE_URL.')
  }
}

async function createFixture(
  db: Db,
  config: FixtureConfig,
): Promise<Fixture> {
  const suffix = randomUUID().replaceAll('-', '')
  const initialAssignmentId = randomUUID()
  const futureAssignmentId = config.includeFutureAssignment ? randomUUID() : null
  const fixture: Fixture = {
    companyId: randomUUID(),
    futureCompanyId: randomUUID(),
    sourceDepartmentId: randomUUID(),
    targetParentDepartmentId: randomUUID(),
    departmentId: randomUUID(),
    employeeId: randomUUID(),
    actorId: randomUUID(),
    loaTypeId: randomUUID(),
    loaId: randomUUID(),
    initialAssignmentId,
    futureAssignmentId,
    loaAssignmentId:
      config.initialAssignmentStatus === 'ON_LEAVE' ? initialAssignmentId : null,
    positionId: config.includePosition ? randomUUID() : null,
  }

  await db.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { code: 'HR_ADMIN' } })
    if (!role) {
      throw new Error('LOA concurrency fixture requires the seeded HR_ADMIN role.')
    }

    await tx.company.create({
      data: {
        id: fixture.companyId,
        code: `E2E-LOA-CONC-${suffix}`,
        name: `E2E LOA Concurrency ${suffix}`,
        nameEn: `E2E LOA Concurrency ${suffix}`,
        countryCode: 'KR',
        timezone: 'Asia/Seoul',
        locale: 'ko',
        currency: 'KRW',
      },
    })
    await tx.company.create({
      data: {
        id: fixture.futureCompanyId,
        code: `E2E-LOA-FUTURE-${suffix}`,
        name: `E2E LOA Future Company ${suffix}`,
        nameEn: `E2E LOA Future Company ${suffix}`,
        countryCode: 'KR',
        timezone: 'Asia/Seoul',
        locale: 'ko',
        currency: 'KRW',
      },
    })
    await tx.department.createMany({
      data: [
        {
          id: fixture.sourceDepartmentId,
          companyId: fixture.companyId,
          code: `E2E-DEPT-SOURCE-${suffix}`,
          name: `E2E Source Department ${suffix}`,
          nameEn: `E2E Source Department ${suffix}`,
          level: 1,
          sortOrder: 0,
        },
        {
          id: fixture.targetParentDepartmentId,
          companyId: fixture.companyId,
          code: `E2E-DEPT-PARENT-${suffix}`,
          name: `E2E Target Parent ${suffix}`,
          nameEn: `E2E Target Parent ${suffix}`,
          level: 1,
          sortOrder: 1,
        },
      ],
    })
    await tx.department.create({
      data: {
        id: fixture.departmentId,
        companyId: fixture.companyId,
        parentId: fixture.targetParentDepartmentId,
        code: `E2E-DEPT-TARGET-${suffix}`,
        name: `E2E Target Department ${suffix}`,
        nameEn: `E2E Target Department ${suffix}`,
        level: 2,
        sortOrder: 0,
      },
    })
    if (fixture.positionId) {
      await tx.position.create({
        data: {
          id: fixture.positionId,
          code: `E2E-POSITION-${suffix}`,
          titleKo: `E2E 포지션 ${suffix}`,
          titleEn: `E2E Position ${suffix}`,
          companyId: fixture.companyId,
        },
      })
    }
    await tx.employee.createMany({
      data: [
        {
          id: fixture.employeeId,
          employeeNo: `E2E-LOA-EMP-${suffix}`,
          name: 'LOA Concurrency Employee',
          email: `e2e-loa-employee-${suffix}@example.invalid`,
          hireDate: new Date('2020-01-01T00:00:00.000Z'),
          locale: 'ko',
          timezone: 'Asia/Seoul',
        },
        {
          id: fixture.actorId,
          employeeNo: `E2E-LOA-ACTOR-${suffix}`,
          name: 'LOA Concurrency Actor',
          email: `e2e-loa-actor-${suffix}@example.invalid`,
          hireDate: new Date('2020-01-01T00:00:00.000Z'),
          locale: 'ko',
          timezone: 'Asia/Seoul',
        },
      ],
    })
    await tx.leaveOfAbsenceType.create({
      data: {
        id: fixture.loaTypeId,
        companyId: fixture.companyId,
        code: `E2E_UNPAID_${suffix}`,
        name: 'E2E 무급휴직',
        nameEn: 'E2E Unpaid Leave',
        category: 'CONTRACTUAL',
        payType: 'UNPAID',
      },
    })
    await tx.employeeAssignment.create({
      data: {
        id: fixture.initialAssignmentId,
        employeeId: fixture.employeeId,
        effectiveDate:
          config.initialAssignmentStatus === 'ACTIVE'
            ? CURRENT_ASSIGNMENT_START
            : LOA_START,
        changeType:
          config.initialAssignmentStatus === 'ACTIVE' ? 'HIRE' : 'STATUS_CHANGE',
        companyId: fixture.companyId,
        departmentId: fixture.sourceDepartmentId,
        employmentType: 'FULL_TIME',
        status: config.initialAssignmentStatus,
        isPrimary: true,
        reason: 'E2E LOA concurrency fixture',
      },
    })
    if (fixture.futureAssignmentId) {
      await tx.employeeAssignment.create({
        data: {
          id: fixture.futureAssignmentId,
          employeeId: fixture.employeeId,
          effectiveDate: FUTURE_ASSIGNMENT_START,
          changeType: 'TRANSFER',
          companyId: fixture.futureCompanyId,
          employmentType: 'CONTRACT',
          status: 'ACTIVE',
          isPrimary: true,
          reason: 'E2E future assignment sentinel',
        },
      })
    }
    await tx.employeeAssignment.create({
      data: {
        id: randomUUID(),
        employeeId: fixture.actorId,
        effectiveDate: CURRENT_ASSIGNMENT_START,
        changeType: 'HIRE',
        companyId: fixture.companyId,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        isPrimary: true,
      },
    })
    await tx.employeeRole.create({
      data: {
        employeeId: fixture.actorId,
        roleId: role.id,
        companyId: fixture.companyId,
        startDate: new Date('2020-01-01T00:00:00.000Z'),
      },
    })
    await tx.compensationHistory.create({
      data: {
        employeeId: fixture.employeeId,
        companyId: fixture.companyId,
        changeType: 'HIRE',
        previousBaseSalary: ANNUAL_SALARY,
        newBaseSalary: ANNUAL_SALARY,
        currency: 'KRW',
        changePct: 0,
        effectiveDate: new Date('2024-01-01T00:00:00.000Z'),
        reason: 'E2E LOA concurrency fixture',
      },
    })
    await tx.leaveOfAbsence.create({
      data: {
        id: fixture.loaId,
        employeeId: fixture.employeeId,
        companyId: fixture.companyId,
        typeId: fixture.loaTypeId,
        startDate: LOA_START,
        expectedEndDate: LOA_EXPECTED_END,
        status: config.initialLoaStatus,
        payType: 'UNPAID',
        reason: 'E2E LOA concurrency fixture',
        approvedById: fixture.actorId,
        approvedAt: FIXED_AUDIT_TIME,
        loaAssignmentId: fixture.loaAssignmentId,
      },
    })
  })

  return fixture
}

async function cleanupFixtureOnce(db: Db, fixture: Fixture): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { companyId: fixture.companyId } })
    const runs = await tx.payrollRun.findMany({
      where: { companyId: fixture.companyId },
      select: { id: true },
    })
    const runIds = runs.map((run) => run.id)
    if (runIds.length > 0) {
      await tx.payrollApproval.deleteMany({ where: { payrollRunId: { in: runIds } } })
      await tx.payrollAnomaly.deleteMany({ where: { payrollRunId: { in: runIds } } })
      await tx.payrollItem.deleteMany({ where: { runId: { in: runIds } } })
    }
    await tx.payrollAdjustment.deleteMany({
      where: {
        OR: [
          { loaId: fixture.loaId },
          ...(runIds.length > 0 ? [{ payrollRunId: { in: runIds } }] : []),
        ],
      },
    })
    if (runIds.length > 0) {
      await tx.payrollRun.deleteMany({ where: { id: { in: runIds } } })
    }
    await tx.leaveOfAbsence.deleteMany({ where: { id: fixture.loaId } })
    await tx.leaveOfAbsenceType.deleteMany({ where: { id: fixture.loaTypeId } })
    await tx.compensationHistory.deleteMany({
      where: { employeeId: fixture.employeeId, companyId: fixture.companyId },
    })
    await tx.employeeAssignment.deleteMany({
      where: { companyId: { in: [fixture.companyId, fixture.futureCompanyId] } },
    })
    if (fixture.positionId) {
      await tx.position.deleteMany({
        where: {
          companyId: fixture.companyId,
          id: { not: fixture.positionId },
        },
      })
      await tx.position.deleteMany({ where: { id: fixture.positionId } })
    }
    await tx.department.deleteMany({ where: { id: fixture.departmentId } })
    await tx.department.deleteMany({
      where: {
        id: {
          in: [fixture.sourceDepartmentId, fixture.targetParentDepartmentId],
        },
      },
    })
    await tx.employeeRole.deleteMany({ where: { companyId: fixture.companyId } })
    await tx.employee.deleteMany({
      where: { id: { in: [fixture.employeeId, fixture.actorId] } },
    })
    await tx.company.deleteMany({
      where: { id: { in: [fixture.companyId, fixture.futureCompanyId] } },
    })
  })
}

async function cleanupFixture(db: Db, fixture: Fixture): Promise<void> {
  try {
    await cleanupFixtureOnce(db, fixture)
  } catch (firstError) {
    try {
      await cleanupFixtureOnce(db, fixture)
    } catch (secondError) {
      throw new Error(
        `Fixture cleanup failed twice: ${serializeError(firstError).message}; `
        + serializeError(secondError).message,
      )
    }
  }
}

function payrollRunInput(
  fixture: Fixture,
  yearMonth: string,
  actorId = fixture.actorId,
): PayrollRunCreationInput {
  const [year, month] = yearMonth.split('-').map(Number)
  return {
    companyId: fixture.companyId,
    actorId,
    name: `E2E LOA ${yearMonth}`,
    runType: 'MONTHLY',
    yearMonth,
    year,
    month,
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    periodEnd: new Date(Date.UTC(year, month, 0)),
    currency: 'KRW',
  }
}

async function createRun(
  db: Db,
  fixture: Fixture,
  yearMonth: string,
  deps: Omit<PayrollRunCreationDeps, 'db'> = {},
): Promise<Record<string, unknown>> {
  const run = await createPayrollRunWithInitialLoaChildren({
    input: payrollRunInput(fixture, yearMonth),
    deps: { ...deps, db },
  })
  return { id: run.id, status: run.status, yearMonth: run.yearMonth }
}

async function createRunThatRollsBack(
  db: Db,
  fixture: Fixture,
  deps: Omit<PayrollRunCreationDeps, 'db'> = {},
): Promise<Record<string, unknown>> {
  const input = payrollRunInput(fixture, SOURCE_YEAR_MONTH)
  return db.$transaction(async (tx) => {
    await acquirePayrollRunRegistryLock(tx, {
      companyId: fixture.companyId,
      operation: 'e2e-loa-obligation-rollback',
      deps,
    })
    await acquireExclusivePeriodLock(tx, {
      companyId: fixture.companyId,
      yearMonth: SOURCE_YEAR_MONTH,
      operation: 'e2e-loa-obligation-rollback',
      deps,
    })
    const run = await createPayrollRunWithInitialLoaChildrenLocked(tx, input)
    await tx.auditLog.create({
      data: {
        actorId: fixture.actorId,
        action: 'E2E_LOA_FORCE_ROLLBACK',
        resourceType: 'PayrollRun',
        resourceId: run.id,
        companyId: fixture.companyId,
        changes: { scenario: 'obligation-rollback-retry' },
      },
    })
    const forcedError = new Error('Forced rollback after LOA obligation consumption.') as Error & {
      code: string
    }
    forcedError.code = 'E2E_FORCED_ROLLBACK'
    throw forcedError
  }, { timeout: 60_000 })
}

async function transition(
  db: Db,
  fixture: Fixture,
  input: LoaTransitionInput,
  deps: Omit<LoaTransitionDeps, 'db'> = {},
): Promise<Record<string, unknown>> {
  const result = await transitionLeaveOfAbsence({
    id: fixture.loaId,
    companyId: fixture.companyId,
    actorId: fixture.actorId,
    input,
    deps: { ...deps, db },
  })
  return {
    id: result.id,
    status: result.status,
    deferredWarnings: result.deferredWarnings,
  }
}

async function createScheduledPrimaryAssignment(
  db: Db,
  fixture: Fixture,
  effectiveDate: Date,
  deps: PrimaryAssignmentLockHooks = {},
): Promise<Record<string, unknown>> {
  const assignment = await createAssignment({
    employeeId: fixture.employeeId,
    effectiveDate,
    changeType: 'TRANSFER',
    companyId: fixture.companyId,
    departmentId: fixture.departmentId,
    employmentType: 'FULL_TIME',
    status: 'ACTIVE',
    isPrimary: true,
    reason: 'E2E scheduled primary writer',
    approvedById: fixture.actorId,
  }, { ...deps, db })
  return {
    id: assignment.id,
    effectiveDate: assignment.effectiveDate.toISOString().slice(0, 10),
    departmentId: assignment.departmentId,
    status: assignment.status,
  }
}

async function createPrimaryAssignmentWithPositionFence(
  db: Db,
  fixture: Fixture,
  hold: (context: Record<string, unknown>) => Promise<void>,
): Promise<Record<string, unknown>> {
  if (!fixture.positionId) {
    throw new Error('Position master-data fence fixture is missing a position.')
  }
  const positionId = fixture.positionId

  return db.$transaction(async (tx) => {
    await revalidatePrimaryAssignmentMasterDataSet(tx, [
      {
        companyId: fixture.companyId,
        positionId,
      },
    ])
    await hold({
      positionId,
      lockMode: 'FOR SHARE',
    })

    const closed = await tx.employeeAssignment.updateMany({
      where: {
        id: fixture.initialAssignmentId,
        employeeId: fixture.employeeId,
        isPrimary: true,
        endDate: null,
      },
      data: { endDate: WRITER_AFTER_LOA_START },
    })
    if (closed.count !== 1) {
      throw conflict('주 발령 원본이 변경되었습니다. 다시 시도해 주세요.')
    }

    const assignment = await tx.employeeAssignment.create({
      data: {
        employeeId: fixture.employeeId,
        effectiveDate: WRITER_AFTER_LOA_START,
        changeType: 'TRANSFER',
        companyId: fixture.companyId,
        departmentId: fixture.sourceDepartmentId,
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        positionId,
        isPrimary: true,
        reason: 'E2E master-data row-lock fence',
        approvedById: fixture.actorId,
      },
    })

    return {
      id: assignment.id,
      positionId: assignment.positionId,
      effectiveDate: assignment.effectiveDate.toISOString().slice(0, 10),
    }
  }, { timeout: 60_000 })
}

async function softDeletePositionWithReferenceRecheck(
  db: Db,
  fixture: Fixture,
  deps: Omit<SoftDeletePositionMasterDeps, 'db'> = {},
): Promise<Record<string, unknown>> {
  if (!fixture.positionId) {
    throw new Error('Position master-data fence fixture is missing a position.')
  }

  return softDeletePositionMaster({
    positionId: fixture.positionId,
    companyId: fixture.companyId,
    deps: { ...deps, db },
  })
}

async function createHierarchyReferenceWithPositionFence(
  db: Db,
  fixture: Fixture,
): Promise<Record<string, unknown>> {
  if (!fixture.positionId) {
    throw new Error('Position hierarchy fence fixture is missing a position.')
  }

  return db.$transaction(async (tx) => {
    await lockActivePositionReferences(tx, {
      companyId: fixture.companyId,
      positionIds: [fixture.positionId],
    })
    const child = await tx.position.create({
      data: {
        code: `E2E-POSITION-CHILD-${randomUUID()}`,
        titleKo: 'E2E 하위 직위',
        titleEn: 'E2E Child Position',
        companyId: fixture.companyId,
        reportsToPositionId: fixture.positionId,
      },
    })
    return { id: child.id, reportsToPositionId: child.reportsToPositionId }
  }, { timeout: 60_000 })
}

function assignmentWriterDepartmentScopes(
  fixture: Fixture,
): PrimaryAssignmentDepartmentScope[] {
  return [
    { companyId: fixture.companyId, departmentId: fixture.sourceDepartmentId },
    { companyId: fixture.companyId, departmentId: fixture.departmentId },
  ]
}

function departmentDeleteScopes(
  fixture: Fixture,
): PrimaryAssignmentDepartmentScope[] {
  return [
    { companyId: fixture.companyId, departmentId: fixture.departmentId },
    {
      companyId: fixture.companyId,
      departmentId: fixture.targetParentDepartmentId,
    },
  ]
}

async function deleteTargetDepartment(
  db: Db,
  fixture: Fixture,
  deps: PrimaryAssignmentLockHooks = {},
): Promise<Record<string, unknown>> {
  const deleted = await softDeleteDepartment({
    id: fixture.departmentId,
    companyId: fixture.companyId,
    expectedParentId: fixture.targetParentDepartmentId,
  }, {
    ...deps,
    db,
    now: () => FIXED_AUDIT_TIME,
  })
  return { id: deleted.id, deleted: true }
}

function oneShotEmployeeLockHook(
  employeeId: string,
  hold: (context: Record<string, unknown>) => Promise<void>,
): NonNullable<PrimaryAssignmentLockHooks['afterPrimaryAssignmentEmployeeLock']> {
  let held = false
  return async (context) => {
    if (held || context.employeeId !== employeeId) return
    held = true
    await hold({ employeeId: context.employeeId, key: context.key })
  }
}

function oneShotFinalDepartmentLockHook(
  scopes: readonly PrimaryAssignmentDepartmentScope[],
  hold: (context: Record<string, unknown>) => Promise<void>,
): NonNullable<PrimaryAssignmentLockHooks['afterPrimaryAssignmentDepartmentLock']> {
  const finalKey = sortPrimaryAssignmentDepartmentScopes(scopes)
    .map(primaryAssignmentDepartmentScopeKey)
    .at(-1)
  if (!finalKey) throw new Error('Department lock hook requires at least one scope.')
  let held = false
  return async (context) => {
    if (held || context.key !== finalKey) return
    held = true
    await hold({ key: context.key })
  }
}

function oneShotLockHook(
  predicate: (context: PeriodLockHookContext) => boolean,
  hold: (context: Record<string, unknown>) => Promise<void>,
): NonNullable<LoaTransitionDeps['afterPeriodLock']> {
  let held = false
  return async (context) => {
    if (held || !predicate(context)) return
    held = true
    await hold({ operation: context.operation, key: context.key, mode: context.mode })
  }
}

async function waitForAdvisoryLockWait(
  observer: Db,
  applicationName: string,
): Promise<void> {
  const deadline = Date.now() + OBSERVATION_TIMEOUT_MS
  while (Date.now() < deadline) {
    const rows = await observer.$queryRaw<Array<{ waiting_count: number }>>`
      SELECT COUNT(*)::int AS waiting_count
      FROM pg_stat_activity
      WHERE application_name = ${applicationName}
        AND wait_event_type = 'Lock'
        AND wait_event = 'advisory'
    `
    if ((rows[0]?.waiting_count ?? 0) > 0) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Timed out waiting for advisory-lock contention (${applicationName}).`)
}

async function waitForDatabaseLockWait(
  observer: Db,
  applicationName: string,
): Promise<{ waitEventType: string; waitEvent: string }> {
  const deadline = Date.now() + OBSERVATION_TIMEOUT_MS
  while (Date.now() < deadline) {
    const rows = await observer.$queryRaw<
      Array<{ wait_event_type: string | null; wait_event: string | null }>
    >`
      SELECT wait_event_type, wait_event
      FROM pg_stat_activity
      WHERE application_name = ${applicationName}
        AND wait_event_type = 'Lock'
      LIMIT 1
    `
    const row = rows[0]
    if (row?.wait_event_type && row.wait_event) {
      return {
        waitEventType: row.wait_event_type,
        waitEvent: row.wait_event,
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Timed out waiting for database-lock contention (${applicationName}).`)
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
  contenderApplicationName: string
  primary: (
    hold: (context: Record<string, unknown>) => Promise<void>,
  ) => Promise<OperationOutcome>
  contender: () => Promise<OperationOutcome>
  observeContenderWait?: () => Promise<Record<string, unknown>>
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
    const waitContext = params.observeContenderWait
      ? await params.observeContenderWait()
      : await waitForAdvisoryLockWait(
          params.observer,
          params.contenderApplicationName,
        ).then(() => ({ waitEvent: 'advisory' }))
    await params.barriers.wait(
      params.scenarioId,
      'contender-blocked',
      waitContext,
    )
    const [primaryResult, contenderResult] = await Promise.all([primary, contender])
    return { primary: primaryResult, contender: contenderResult }
  } catch (error) {
    params.barriers.releaseAll()
    await Promise.allSettled([primary, ...(contender ? [contender] : [])])
    throw error
  }
}

function jsonString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === 'string' ? candidate : null
}

async function readFinalState(db: Db, fixture: Fixture): Promise<Record<string, unknown>> {
  const [
    loa,
    assignments,
    department,
    position,
    openPositionAssignments,
    openDeletedPositionReferences,
    activeChildPositions,
    targetDepartmentAssignments,
    runs,
    createdObligations,
    consumedObligations,
    transitionAudits,
  ] = await Promise.all([
      db.leaveOfAbsence.findUnique({
        where: { id: fixture.loaId },
        select: {
          status: true,
          actualEndDate: true,
          loaAssignmentId: true,
          returnAssignmentId: true,
        },
      }),
      db.employeeAssignment.findMany({
        where: { employeeId: fixture.employeeId },
        select: {
          id: true,
          companyId: true,
          status: true,
          effectiveDate: true,
          endDate: true,
          employmentType: true,
          isPrimary: true,
        },
        orderBy: [{ effectiveDate: 'asc' }, { id: 'asc' }],
      }),
      db.department.findUnique({
        where: { id: fixture.departmentId },
        select: { id: true, deletedAt: true },
      }),
      fixture.positionId
        ? db.position.findUnique({
            where: { id: fixture.positionId },
            select: { id: true, deletedAt: true },
          })
        : Promise.resolve(null),
      fixture.positionId
        ? db.employeeAssignment.findMany({
            where: {
              employeeId: fixture.employeeId,
              positionId: fixture.positionId,
              endDate: null,
            },
            select: { id: true },
            orderBy: { id: 'asc' },
          })
        : Promise.resolve([]),
      db.$queryRaw<Array<{ reference_count: number }>>`
        SELECT COUNT(*)::int AS reference_count
        FROM employee_assignments AS assignment
        JOIN positions AS position ON position.id = assignment.position_id
        WHERE assignment.employee_id = ${fixture.employeeId}
          AND assignment.end_date IS NULL
          AND position.deleted_at IS NOT NULL
      `,
      fixture.positionId
        ? db.position.findMany({
            where: {
              companyId: fixture.companyId,
              deletedAt: null,
              OR: [
                { reportsToPositionId: fixture.positionId },
                { dottedLinePositionId: fixture.positionId },
              ],
            },
            select: { id: true },
            orderBy: { id: 'asc' },
          })
        : Promise.resolve([]),
      db.employeeAssignment.findMany({
        where: {
          employeeId: fixture.employeeId,
          departmentId: fixture.departmentId,
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      db.payrollRun.findMany({
        where: { companyId: fixture.companyId },
        include: {
          adjustments: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: [{ yearMonth: 'asc' }, { id: 'asc' }],
      }),
      db.auditLog.findMany({
        where: {
          companyId: fixture.companyId,
          action: 'LOA_PAYROLL_OBLIGATION_CREATED',
          resourceType: 'LoaPayrollObligation',
        },
        select: { resourceId: true, changes: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      db.auditLog.findMany({
        where: {
          companyId: fixture.companyId,
          action: 'LOA_PAYROLL_OBLIGATION_CONSUMED',
          resourceType: 'LoaPayrollObligation',
        },
        select: { resourceId: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      db.auditLog.findMany({
        where: {
          companyId: fixture.companyId,
          action: {
            in: [
              'LEAVE_OF_ABSENCE_ACTIVATE',
              'LEAVE_OF_ABSENCE_COMPLETE',
              'LEAVE_OF_ABSENCE_CANCEL',
            ],
          },
        },
        select: { action: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ])

  const runStates = runs.map((run) => {
    const childTotal = run.adjustments.reduce(
      (sum, adjustment) => sum + Number(adjustment.amount),
      0,
    )
    return {
      id: run.id,
      yearMonth: run.yearMonth,
      status: run.status,
      adjustmentCount: run.adjustmentCount,
      adjustmentTotal: Number(run.adjustmentTotal),
      childCount: run.adjustments.length,
      childTotal,
      aggregateMatches:
        run.adjustmentCount === run.adjustments.length &&
        Number(run.adjustmentTotal) === childTotal,
      adjustments: run.adjustments.map((adjustment) => ({
        id: adjustment.id,
        type: adjustment.type,
        amount: Number(adjustment.amount),
        loaYearMonth: adjustment.loaYearMonth,
        description: adjustment.description,
      })),
    }
  })
  const openPrimaryAssignments = assignments.filter(
    (assignment) => assignment.isPrimary && assignment.endDate === null,
  )

  return {
    loaStatus: loa?.status ?? null,
    loaActualEndDate: loa?.actualEndDate?.toISOString().slice(0, 10) ?? null,
    loaAssignmentId: loa?.loaAssignmentId ?? null,
    returnAssignmentId: loa?.returnAssignmentId ?? null,
    companyId: fixture.companyId,
    futureCompanyId: fixture.futureCompanyId,
    departmentId: fixture.departmentId,
    departmentDeletedAt: department?.deletedAt?.toISOString() ?? null,
    positionId: fixture.positionId,
    positionDeletedAt: position?.deletedAt?.toISOString() ?? null,
    openPositionAssignmentIds: openPositionAssignments.map(
      (assignment) => assignment.id,
    ),
    openDeletedPositionReferenceCount:
      openDeletedPositionReferences[0]?.reference_count ?? 0,
    activeChildPositionIds: activeChildPositions.map((child) => child.id),
    targetDepartmentAssignmentIds: targetDepartmentAssignments.map(
      (assignment) => assignment.id,
    ),
    initialAssignmentId: fixture.initialAssignmentId,
    futureAssignmentId: fixture.futureAssignmentId,
    assignmentCount: assignments.length,
    openPrimaryAssignmentCount: openPrimaryAssignments.length,
    openPrimaryAssignmentStatuses: openPrimaryAssignments.map((value) => value.status),
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      companyId: assignment.companyId,
      status: assignment.status,
      effectiveDate: assignment.effectiveDate.toISOString().slice(0, 10),
      endDate: assignment.endDate?.toISOString().slice(0, 10) ?? null,
      employmentType: assignment.employmentType,
      isPrimary: assignment.isPrimary,
    })),
    runCount: runStates.length,
    runs: runStates,
    aggregatesMatch: runStates.every((run) => run.aggregateMatches),
    obligationCreatedCount: createdObligations.length,
    obligationConsumedCount: consumedObligations.length,
    obligationCreatedKeys: createdObligations.map((row) => row.resourceId),
    obligationConsumedKeys: consumedObligations.map((row) => row.resourceId),
    obligationKinds: createdObligations.map((row) => jsonString(row.changes, 'kind')),
    transitionAuditActions: transitionAudits.map((row) => row.action),
    rollbackAuditCount: await db.auditLog.count({
      where: { companyId: fixture.companyId, action: 'E2E_LOA_FORCE_ROLLBACK' },
    }),
  }
}

async function completedBeforeRunBase(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  contenderApplicationName: string,
  fixture: Fixture,
): Promise<Record<string, unknown>> {
  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    contenderApplicationName,
    primary: (hold) =>
      outcome(() =>
        transition(dbA, fixture, { action: 'complete', actualEndDate: LOA_ACTUAL_END }, {
          afterPeriodLock: oneShotLockHook(
            (context) => context.key.startsWith('payroll-run-registry:'),
            hold,
          ),
        }),
      ),
    contender: () => outcome(() => createRun(dbB, fixture, SOURCE_YEAR_MONTH)),
  })
  return {
    outcomes: { complete: race.primary, createRun: race.contender },
    final: await readFinalState(dbA, fixture),
  }
}

async function lockedSourceLaterCompensation(
  dbA: Db,
  fixture: Fixture,
): Promise<Record<string, unknown>> {
  const sourceRun = await outcome(() => createRun(dbA, fixture, SOURCE_YEAR_MONTH))
  if (!sourceRun.ok) throw new Error(sourceRun.error.message)
  const sourceRunId = String(sourceRun.value.id)
  await dbA.payrollRun.update({
    where: { id: sourceRunId },
    data: { status: 'REVIEW', attendanceClosedAt: FIXED_AUDIT_TIME },
  })
  const laterRun = await outcome(() => createRun(dbA, fixture, LATER_YEAR_MONTH))
  const returnRequest = await outcome(() => transition(dbA, fixture, { action: 'return' }))
  const complete = await outcome(() =>
    transition(dbA, fixture, { action: 'complete', actualEndDate: LOA_ACTUAL_END }),
  )
  return {
    outcomes: { sourceRun, laterRun, returnRequest, complete },
    final: await readFinalState(dbA, fixture),
  }
}

async function obligationRollbackRetry(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  contenderApplicationName: string,
  fixture: Fixture,
): Promise<Record<string, unknown>> {
  const complete = await outcome(() =>
    transition(dbA, fixture, { action: 'complete', actualEndDate: LOA_ACTUAL_END }),
  )
  if (!complete.ok) throw new Error(complete.error.message)

  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    contenderApplicationName,
    primary: (hold) =>
      outcome(() =>
        createRunThatRollsBack(dbA, fixture, {
          afterPeriodLock: oneShotLockHook(
            (context) => context.key.startsWith('attendance-period:'),
            hold,
          ),
        }),
      ),
    contender: () => outcome(() => createRun(dbB, fixture, SOURCE_YEAR_MONTH)),
  })
  return {
    outcomes: {
      complete,
      rolledBackRun: race.primary,
      retryRun: race.contender,
    },
    final: await readFinalState(dbA, fixture),
  }
}

async function cancelVsComplete(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  contenderApplicationName: string,
  fixture: Fixture,
  first: 'complete' | 'cancel',
): Promise<Record<string, unknown>> {
  const completeInput: LoaTransitionInput = {
    action: 'complete',
    actualEndDate: LOA_ACTUAL_END,
  }
  const cancelInput: LoaTransitionInput = { action: 'cancel' }
  const primaryInput = first === 'complete' ? completeInput : cancelInput
  const contenderInput = first === 'complete' ? cancelInput : completeInput

  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    contenderApplicationName,
    primary: (hold) =>
      outcome(() =>
        transition(dbA, fixture, primaryInput, {
          afterPeriodLock: oneShotLockHook(
            (context) => context.key.startsWith('payroll-run-registry:'),
            hold,
          ),
        }),
      ),
    contender: () => outcome(() => transition(dbB, fixture, contenderInput)),
  })
  return {
    outcomes:
      first === 'complete'
        ? { complete: race.primary, cancel: race.contender }
        : { cancel: race.primary, complete: race.contender },
    final: await readFinalState(dbA, fixture),
  }
}

async function futureAssignmentTransition(
  db: Db,
  fixture: Fixture,
  input: Extract<LoaTransitionInput, { action: 'activate' | 'complete' | 'cancel' }>,
): Promise<Record<string, unknown>> {
  const transitionOutcome = await outcome(() => transition(db, fixture, input))
  return {
    outcomes: { [input.action]: transitionOutcome },
    final: await readFinalState(db, fixture),
  }
}

async function loaVsScheduledPrimaryWriter(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  contenderApplicationName: string,
  fixture: Fixture,
  first: 'loa' | 'writer',
): Promise<Record<string, unknown>> {
  const race = first === 'loa'
    ? await heldFirstRace({
        scenarioId,
        barriers,
        observer: dbA,
        contenderApplicationName,
        primary: (hold) =>
          outcome(() =>
            transition(dbA, fixture, { action: 'activate' }, {
              afterPrimaryAssignmentEmployeeLock: oneShotEmployeeLockHook(
                fixture.employeeId,
                hold,
              ),
            }),
          ),
        contender: () =>
          outcome(() =>
            createScheduledPrimaryAssignment(
              dbB,
              fixture,
              WRITER_AFTER_LOA_START,
            ),
          ),
      })
    : await heldFirstRace({
        scenarioId,
        barriers,
        observer: dbA,
        contenderApplicationName,
        primary: (hold) =>
          outcome(() =>
            createScheduledPrimaryAssignment(
              dbA,
              fixture,
              WRITER_AFTER_LOA_START,
              {
                afterPrimaryAssignmentEmployeeLock: oneShotEmployeeLockHook(
                  fixture.employeeId,
                  hold,
                ),
              },
            ),
          ),
        contender: () =>
          outcome(() => transition(dbB, fixture, { action: 'activate' })),
      })

  return {
    outcomes:
      first === 'loa'
        ? { activate: race.primary, writer: race.contender }
        : { writer: race.primary, activate: race.contender },
    final: await readFinalState(dbA, fixture),
  }
}

async function departmentDeleteVsAssignmentWriter(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  contenderApplicationName: string,
  fixture: Fixture,
  first: 'delete' | 'writer',
): Promise<Record<string, unknown>> {
  const deleteScopes = departmentDeleteScopes(fixture)
  const writerScopes = assignmentWriterDepartmentScopes(fixture)
  const race = first === 'delete'
    ? await heldFirstRace({
        scenarioId,
        barriers,
        observer: dbA,
        contenderApplicationName,
        primary: (hold) =>
          outcome(() =>
            deleteTargetDepartment(dbA, fixture, {
              afterPrimaryAssignmentDepartmentLock:
                oneShotFinalDepartmentLockHook(deleteScopes, hold),
            }),
          ),
        contender: () =>
          outcome(() =>
            createScheduledPrimaryAssignment(
              dbB,
              fixture,
              WRITER_AFTER_LOA_START,
            ),
          ),
      })
    : await heldFirstRace({
        scenarioId,
        barriers,
        observer: dbA,
        contenderApplicationName,
        primary: (hold) =>
          outcome(() =>
            createScheduledPrimaryAssignment(
              dbA,
              fixture,
              WRITER_AFTER_LOA_START,
              {
                afterPrimaryAssignmentDepartmentLock:
                  oneShotFinalDepartmentLockHook(writerScopes, hold),
              },
            ),
          ),
        contender: () => outcome(() => deleteTargetDepartment(dbB, fixture)),
      })

  return {
    outcomes:
      first === 'delete'
        ? { deleteDepartment: race.primary, writer: race.contender }
        : { writer: race.primary, deleteDepartment: race.contender },
    final: await readFinalState(dbA, fixture),
  }
}

async function assignmentWriterVsPositionDelete(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  contenderApplicationName: string,
  fixture: Fixture,
): Promise<Record<string, unknown>> {
  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    contenderApplicationName,
    primary: (hold) =>
      outcome(() => createPrimaryAssignmentWithPositionFence(dbA, fixture, hold)),
    contender: () =>
      outcome(() => softDeletePositionWithReferenceRecheck(dbB, fixture)),
    observeContenderWait: async () => {
      const wait = await waitForDatabaseLockWait(dbA, contenderApplicationName)
      return {
        waitEventType: wait.waitEventType,
        waitEvent: wait.waitEvent,
        lockTarget: 'position',
      }
    },
  })

  return {
    outcomes: {
      writer: race.primary,
      deletePosition: race.contender,
    },
    final: await readFinalState(dbA, fixture),
  }
}

async function positionDeleteVsHierarchyWriter(
  scenarioId: string,
  barriers: BarrierController,
  dbA: Db,
  dbB: Db,
  contenderApplicationName: string,
  fixture: Fixture,
): Promise<Record<string, unknown>> {
  const race = await heldFirstRace({
    scenarioId,
    barriers,
    observer: dbA,
    contenderApplicationName,
    primary: (hold) =>
      outcome(() => softDeletePositionWithReferenceRecheck(dbA, fixture, {
        afterPositionDeleteLock: (context) => hold({
          ...context,
          lockMode: 'FOR UPDATE',
        }),
      })),
    contender: () =>
      outcome(() => createHierarchyReferenceWithPositionFence(dbB, fixture)),
    observeContenderWait: async () => {
      const wait = await waitForDatabaseLockWait(dbA, contenderApplicationName)
      return {
        waitEventType: wait.waitEventType,
        waitEvent: wait.waitEvent,
        lockTarget: 'position',
      }
    },
  })

  return {
    outcomes: {
      deletePosition: race.primary,
      hierarchyWriter: race.contender,
    },
    final: await readFinalState(dbA, fixture),
  }
}

function fixtureConfigForScenario(name: ScenarioName): FixtureConfig {
  switch (name) {
    case 'future-assignment-activate':
      return {
        initialLoaStatus: 'APPROVED',
        initialAssignmentStatus: 'ACTIVE',
        includeFutureAssignment: true,
      }
    case 'future-assignment-complete':
      return {
        initialLoaStatus: 'RETURN_REQUESTED',
        initialAssignmentStatus: 'ON_LEAVE',
        includeFutureAssignment: true,
      }
    case 'future-assignment-cancel':
      return {
        initialLoaStatus: 'ACTIVE',
        initialAssignmentStatus: 'ON_LEAVE',
        includeFutureAssignment: true,
      }
    case 'loa-first-vs-scheduled-primary-writer':
    case 'scheduled-primary-writer-first-vs-loa-activate':
    case 'department-delete-first-vs-assignment-writer':
    case 'assignment-writer-first-vs-department-delete':
      return {
        initialLoaStatus: 'APPROVED',
        initialAssignmentStatus: 'ACTIVE',
      }
    case 'assignment-writer-first-vs-position-delete':
    case 'position-delete-first-vs-hierarchy-writer':
      return {
        initialLoaStatus: 'APPROVED',
        initialAssignmentStatus: 'ACTIVE',
        includePosition: true,
      }
    default:
      return {
        initialLoaStatus:
          name === 'locked-source-later-compensation' ? 'ACTIVE' : 'RETURN_REQUESTED',
        initialAssignmentStatus: 'ON_LEAVE',
      }
  }
}

async function executeScenario(
  command: ScenarioCommand,
  barriers: BarrierController,
  clientA: OwnedClient,
  clientB: OwnedClient,
): Promise<Record<string, unknown>> {
  const fixture = await createFixture(
    clientA.db,
    fixtureConfigForScenario(command.name),
  )
  try {
    switch (command.name) {
      case 'completed-before-run-base':
        return await completedBeforeRunBase(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
        )
      case 'locked-source-later-compensation':
        return await lockedSourceLaterCompensation(clientA.db, fixture)
      case 'obligation-rollback-retry':
        return await obligationRollbackRetry(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
        )
      case 'cancel-vs-complete-complete-first':
        return await cancelVsComplete(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
          'complete',
        )
      case 'cancel-vs-complete-cancel-first':
        return await cancelVsComplete(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
          'cancel',
        )
      case 'future-assignment-activate':
        return await futureAssignmentTransition(
          clientA.db,
          fixture,
          { action: 'activate' },
        )
      case 'future-assignment-complete':
        return await futureAssignmentTransition(
          clientA.db,
          fixture,
          { action: 'complete', actualEndDate: LOA_ACTUAL_END },
        )
      case 'future-assignment-cancel':
        return await futureAssignmentTransition(
          clientA.db,
          fixture,
          { action: 'cancel' },
        )
      case 'loa-first-vs-scheduled-primary-writer':
        return await loaVsScheduledPrimaryWriter(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
          'loa',
        )
      case 'scheduled-primary-writer-first-vs-loa-activate':
        return await loaVsScheduledPrimaryWriter(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
          'writer',
        )
      case 'department-delete-first-vs-assignment-writer':
        return await departmentDeleteVsAssignmentWriter(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
          'delete',
        )
      case 'assignment-writer-first-vs-department-delete':
        return await departmentDeleteVsAssignmentWriter(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
          'writer',
        )
      case 'assignment-writer-first-vs-position-delete':
        return await assignmentWriterVsPositionDelete(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
        )
      case 'position-delete-first-vs-hierarchy-writer':
        return await positionDeleteVsHierarchyWriter(
          command.id,
          barriers,
          clientA.db,
          clientB.db,
          clientB.applicationName,
          fixture,
        )
    }
  } finally {
    await cleanupFixture(clientA.db, fixture)
  }
}

async function main(): Promise<void> {
  if (process.env.RUN_DB_CONCURRENCY_TESTS !== '1') {
    emit({
      type: 'ready',
      ok: false,
      error: 'RUN_DB_CONCURRENCY_TESTS=1 is required by the LOA concurrency harness.',
    })
    return
  }
  const connectionString = process.env.TEST_DATABASE_URL
  if (!connectionString) {
    emit({
      type: 'ready',
      ok: false,
      error: 'TEST_DATABASE_URL is required by the LOA concurrency harness.',
    })
    return
  }

  let parsedDatabaseUrl: URL
  try {
    parsedDatabaseUrl = assertSafeTestDatabaseUrl(
      connectionString,
      process.env.LOA_CONCURRENCY_PRIMARY_DATABASE_URL || undefined,
    )
  } catch (error) {
    emit({ type: 'ready', ok: false, error: serializeError(error) })
    return
  }

  const clientA = createOwnedClient(connectionString, 'a')
  const clientB = createOwnedClient(connectionString, 'b')
  const barriers = new BarrierController()
  let active: Promise<void> | null = null
  let shuttingDown = false

  const disconnect = async (): Promise<void> => {
    await Promise.allSettled([clientA.raw.$disconnect(), clientB.raw.$disconnect()])
  }
  const shutdown = async (id: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    barriers.releaseAll()
    if (active) await active
    await disconnect()
    emit({ type: 'teardown', id, ok: true })
  }

  process.once('SIGTERM', () => {
    void shutdown('signal').finally(() => process.exit(0))
  })
  process.once('SIGINT', () => {
    void shutdown('signal').finally(() => process.exit(0))
  })

  try {
    await Promise.all([clientA.raw.$connect(), clientB.raw.$connect()])
    const expectedDatabaseName = decodeURIComponent(parsedDatabaseUrl.pathname.slice(1))
    await Promise.all([
      assertConnectedDatabase(clientA.db, expectedDatabaseName),
      assertConnectedDatabase(clientB.db, expectedDatabaseName),
    ])
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
        const data = await executeScenario(command, barriers, clientA, clientB)
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
    if (!shuttingDown) void shutdown('stdin-closed')
  })

  emit({ type: 'ready', ok: true, protocol: 1, scenarios: SCENARIOS })
}

void main().catch((error) => {
  emit({ type: 'ready', ok: false, error: serializeError(error) })
  process.exitCode = 1
})
