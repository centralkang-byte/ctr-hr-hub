import { randomUUID } from 'node:crypto'
import path from 'node:path'
import readline from 'node:readline'
import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process'

import { expect, test } from '@playwright/test'

const HARNESS_PATH = path.join(
  process.cwd(),
  'e2e/harness/loa-payroll-concurrency-harness.ts',
)
const SERVER_ONLY_SHIM_PATH = path.join(
  process.cwd(),
  'e2e/harness/server-only-shim.cjs',
)
const PROTOCOL_TIMEOUT_MS = 30_000
const SOURCE_YEAR_MONTH = '2025-01'
const LATER_YEAR_MONTH = '2025-02'
const TEST_DATABASE_MARKERS = new Set(['test', 'e2e', 'ci', 'sandbox'])
const REQUIRED_APPLICATION_NAME = 'ctr-hr-hub-e2e'

type ScenarioName =
  | 'completed-before-run-base'
  | 'locked-source-later-compensation'
  | 'obligation-rollback-retry'
  | 'cancel-vs-complete-complete-first'
  | 'cancel-vs-complete-cancel-first'
  | 'future-assignment-activate'
  | 'future-assignment-complete'
  | 'future-assignment-cancel'
  | 'loa-first-vs-scheduled-primary-writer'
  | 'scheduled-primary-writer-first-vs-loa-activate'
  | 'department-delete-first-vs-assignment-writer'
  | 'assignment-writer-first-vs-department-delete'
  | 'assignment-writer-first-vs-position-delete'
  | 'position-delete-first-vs-hierarchy-writer'

interface HarnessEvent {
  type: string
  id?: string
  ok?: boolean
  token?: string
  label?: string
  context?: Record<string, unknown>
  error?: unknown
  data?: unknown
}

interface HarnessWaiter {
  predicate: (event: HarnessEvent) => boolean
  resolve: (event: HarnessEvent) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface SerializedError {
  name: string
  message: string
  code?: string
  statusCode?: number
}

type OperationOutcome =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: SerializedError }

interface AssignmentState {
  id: string
  companyId: string
  status: string
  effectiveDate: string
  endDate: string | null
  employmentType: string
  isPrimary: boolean
}

interface AdjustmentState {
  id: string
  type: string
  amount: number
  loaYearMonth: string | null
  description: string
}

interface RunState {
  id: string
  yearMonth: string
  status: string
  adjustmentCount: number
  adjustmentTotal: number
  childCount: number
  childTotal: number
  aggregateMatches: boolean
  adjustments: AdjustmentState[]
}

interface FinalState {
  loaStatus: string | null
  loaActualEndDate: string | null
  loaAssignmentId: string | null
  returnAssignmentId: string | null
  companyId: string
  futureCompanyId: string
  departmentId: string
  departmentDeletedAt: string | null
  positionId: string | null
  positionDeletedAt: string | null
  openPositionAssignmentIds: string[]
  openDeletedPositionReferenceCount: number
  activeChildPositionIds: string[]
  targetDepartmentAssignmentIds: string[]
  initialAssignmentId: string
  futureAssignmentId: string | null
  assignmentCount: number
  openPrimaryAssignmentCount: number
  openPrimaryAssignmentStatuses: string[]
  assignments: AssignmentState[]
  runCount: number
  runs: RunState[]
  aggregatesMatch: boolean
  obligationCreatedCount: number
  obligationConsumedCount: number
  obligationCreatedKeys: string[]
  obligationConsumedKeys: string[]
  obligationKinds: Array<string | null>
  transitionAuditActions: string[]
  rollbackAuditCount: number
}

interface ScenarioData {
  outcomes: Record<string, OperationOutcome>
  final: FinalState
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

function assertSafeTestDatabaseUrl(value: string): string {
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
  const primaryDatabaseUrl = process.env.DATABASE_URL
  if (
    primaryDatabaseUrl &&
    databaseIdentity(primaryDatabaseUrl) === databaseIdentity(value)
  ) {
    throw new Error('TEST_DATABASE_URL must not point to the same database as DATABASE_URL.')
  }
  return value
}

function formatProtocolError(error: unknown): string {
  return typeof error === 'string' ? error : JSON.stringify(error)
}

class HarnessDriver {
  private readonly child: ChildProcessWithoutNullStreams
  private readonly output: readline.Interface
  private readonly queued: HarnessEvent[] = []
  private readonly waiters: HarnessWaiter[] = []
  private stderr = ''
  private exited = false

  private constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child
    this.output = readline.createInterface({ input: child.stdout })
    this.output.on('line', (line) => {
      let event: HarnessEvent
      try {
        event = JSON.parse(line) as HarnessEvent
      } catch {
        event = {
          type: 'protocol-error',
          error: `Non-JSON harness output: ${line}`,
        }
      }
      this.accept(event)
    })
    child.stderr.on('data', (chunk: Buffer | string) => {
      this.stderr = `${this.stderr}${chunk.toString()}`.slice(-12_000)
    })
    child.once('exit', (code, signal) => {
      this.exited = true
      const suffix = this.stderr ? `\nHarness stderr:\n${this.stderr}` : ''
      const error = new Error(
        `LOA concurrency harness exited (code=${String(code)}, signal=${String(signal)}).${suffix}`,
      )
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer)
        waiter.reject(error)
      }
    })
  }

  static async start(databaseUrl: string): Promise<HarnessDriver> {
    const child = spawn(
      process.execPath,
      [
        '--require',
        SERVER_ONLY_SHIM_PATH,
        '--import',
        'tsx',
        HARNESS_PATH,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          TEST_DATABASE_URL: databaseUrl,
          RUN_DB_CONCURRENCY_TESTS: '1',
          LOA_CONCURRENCY_PRIMARY_DATABASE_URL: process.env.DATABASE_URL ?? '',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    const driver = new HarnessDriver(child)
    const ready = await driver.waitFor(
      (event) => event.type === 'ready',
      'ready handshake',
    )
    if (!ready.ok) {
      await driver.stop().catch(() => undefined)
      throw new Error(`Harness failed to start: ${formatProtocolError(ready.error)}`)
    }
    return driver
  }

  private accept(event: HarnessEvent): void {
    const waiterIndex = this.waiters.findIndex((waiter) => waiter.predicate(event))
    if (waiterIndex === -1) {
      this.queued.push(event)
      return
    }
    const [waiter] = this.waiters.splice(waiterIndex, 1)
    clearTimeout(waiter.timer)
    waiter.resolve(event)
  }

  private waitFor(
    predicate: (event: HarnessEvent) => boolean,
    description: string,
    timeoutMs = PROTOCOL_TIMEOUT_MS,
  ): Promise<HarnessEvent> {
    const queuedIndex = this.queued.findIndex(predicate)
    if (queuedIndex !== -1) {
      const [event] = this.queued.splice(queuedIndex, 1)
      return Promise.resolve(event)
    }
    if (this.exited) {
      return Promise.reject(new Error('LOA concurrency harness is not running.'))
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex(
          (candidate) => candidate.resolve === resolve,
        )
        if (index !== -1) this.waiters.splice(index, 1)
        const suffix = this.stderr ? `\nHarness stderr:\n${this.stderr}` : ''
        reject(new Error(`Timed out waiting for harness ${description}.${suffix}`))
      }, timeoutMs)
      this.waiters.push({ predicate, resolve, reject, timer })
    })
  }

  private send(command: Record<string, unknown>): void {
    if (this.exited) throw new Error('LOA concurrency harness is not running.')
    this.child.stdin.write(`${JSON.stringify(command)}\n`)
  }

  async waitForBarrier(id: string, label: string): Promise<HarnessEvent> {
    const event = await this.waitFor(
      (candidate) =>
        candidate.id === id &&
        ((candidate.type === 'barrier' && candidate.label === label) ||
          candidate.type === 'result'),
      `barrier ${label}`,
    )
    if (event.type === 'result') {
      const detail = event.ok
        ? 'scenario completed before reaching the barrier'
        : formatProtocolError(event.error)
      throw new Error(`Harness failed before barrier ${label}: ${detail}`)
    }
    return event
  }

  release(event: HarnessEvent): void {
    if (!event.id || !event.token) {
      throw new Error('Cannot release a barrier without id and token.')
    }
    this.send({ type: 'release', id: event.id, token: event.token })
  }

  async run(
    name: ScenarioName,
    drive: (id: string) => Promise<void> = async () => undefined,
  ): Promise<ScenarioData> {
    const id = randomUUID()
    this.send({ type: 'scenario', id, name })
    const accepted = await this.waitFor(
      (event) => event.type === 'scenario' && event.id === id,
      `scenario acknowledgement for ${name}`,
    )
    if (!accepted.ok) {
      throw new Error(`Harness rejected ${name}: ${formatProtocolError(accepted.error)}`)
    }
    await drive(id)
    const result = await this.waitFor(
      (event) => event.type === 'result' && event.id === id,
      `result for ${name}`,
    )
    if (!result.ok) {
      throw new Error(`Harness scenario ${name} failed: ${formatProtocolError(result.error)}`)
    }
    return result.data as ScenarioData
  }

  async stop(): Promise<void> {
    if (this.exited) return
    const id = randomUUID()
    this.send({ type: 'teardown', id })
    try {
      await this.waitFor(
        (event) => event.type === 'teardown' && event.id === id,
        'teardown acknowledgement',
        10_000,
      )
      this.child.stdin.end()
      await new Promise<void>((resolve) => {
        if (this.exited) {
          resolve()
          return
        }
        const timer = setTimeout(() => {
          this.child.kill('SIGTERM')
          resolve()
        }, 2_000)
        this.child.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    } catch (error) {
      this.child.kill('SIGTERM')
      throw error
    } finally {
      this.output.close()
    }
  }
}

async function driveHeldFirst(harness: HarnessDriver, id: string): Promise<void> {
  const winner = await harness.waitForBarrier(id, 'winner-held')
  const contender = await harness.waitForBarrier(id, 'contender-blocked')
  harness.release(contender)
  harness.release(winner)
}

async function driveMasterRowLock(harness: HarnessDriver, id: string): Promise<void> {
  const winner = await harness.waitForBarrier(id, 'winner-held')
  const contender = await harness.waitForBarrier(id, 'contender-blocked')
  try {
    expect(winner.context).toMatchObject({ lockMode: 'FOR SHARE' })
    expect(typeof winner.context?.positionId).toBe('string')
    expect(contender.context).toMatchObject({
      waitEventType: 'Lock',
      lockTarget: 'position',
    })
    expect(typeof contender.context?.waitEvent).toBe('string')
  } finally {
    harness.release(contender)
    harness.release(winner)
  }
}

async function driveMasterDeleteRowLock(harness: HarnessDriver, id: string): Promise<void> {
  const winner = await harness.waitForBarrier(id, 'winner-held')
  const contender = await harness.waitForBarrier(id, 'contender-blocked')
  try {
    expect(winner.context).toMatchObject({ lockMode: 'FOR UPDATE' })
    expect(typeof winner.context?.positionId).toBe('string')
    expect(contender.context).toMatchObject({
      waitEventType: 'Lock',
      lockTarget: 'position',
    })
    expect(typeof contender.context?.waitEvent).toBe('string')
  } finally {
    harness.release(contender)
    harness.release(winner)
  }
}

function operation(data: ScenarioData, name: string): OperationOutcome {
  const result = data.outcomes[name]
  expect(result, `missing operation outcome: ${name}`).toBeDefined()
  return result
}

function expectSuccess(result: OperationOutcome): void {
  expect(result.ok, result.ok ? undefined : result.error.message).toBe(true)
}

function expectFailure(result: OperationOutcome, code?: string): void {
  expect(result.ok).toBe(false)
  if (result.ok || !code) return
  expect(result.error.code).toBe(code)
}

function successfulString(result: OperationOutcome, key: string): string {
  expectSuccess(result)
  if (!result.ok) throw new Error(result.error.message)
  const value = result.value[key]
  expect(typeof value, `expected ${key} to be a string`).toBe('string')
  return value as string
}

function runFor(data: ScenarioData, yearMonth: string): RunState {
  const run = data.final.runs.find((candidate) => candidate.yearMonth === yearMonth)
  expect(run, `missing payroll run for ${yearMonth}`).toBeDefined()
  return run as RunState
}

function expectAggregateEquality(data: ScenarioData): void {
  expect(data.final.aggregatesMatch).toBe(true)
  for (const run of data.final.runs) {
    expect(run.aggregateMatches, `aggregate mismatch for ${run.yearMonth}`).toBe(true)
    expect(run.adjustmentCount).toBe(run.childCount)
    expect(run.adjustmentTotal).toBe(run.childTotal)
  }
}

function expectExactlyOneRestoredAssignment(data: ScenarioData): void {
  expect(data.final.assignmentCount).toBe(2)
  expect(data.final.openPrimaryAssignmentCount).toBe(1)
  expect(data.final.openPrimaryAssignmentStatuses).toEqual(['ACTIVE'])
  expect(data.final.returnAssignmentId).not.toBeNull()
  const restored = data.final.assignments.find(
    (assignment) => assignment.id === data.final.returnAssignmentId,
  )
  expect(restored).toMatchObject({ status: 'ACTIVE', endDate: null })
  const loaAssignment = data.final.assignments.find(
    (assignment) => assignment.id === data.final.loaAssignmentId,
  )
  expect(loaAssignment?.status).toBe('ON_LEAVE')
  expect(loaAssignment?.endDate).not.toBeNull()
}

function assignmentFor(
  data: ScenarioData,
  id: string | null,
  label: string,
): AssignmentState {
  expect(id, `missing ${label} id`).not.toBeNull()
  const assignment = data.final.assignments.find((candidate) => candidate.id === id)
  expect(assignment, `missing ${label} assignment`).toBeDefined()
  return assignment as AssignmentState
}

function expectFutureAssignmentPreserved(data: ScenarioData): void {
  expect(data.final.futureCompanyId).not.toBe(data.final.companyId)
  const future = assignmentFor(
    data,
    data.final.futureAssignmentId,
    'future sentinel',
  )
  expect(future).toEqual({
    id: data.final.futureAssignmentId,
    companyId: data.final.futureCompanyId,
    status: 'ACTIVE',
    effectiveDate: '2099-01-01',
    endDate: null,
    employmentType: 'CONTRACT',
    isPrimary: true,
  })
}

function expectAssignmentsUnchangedAfterFutureConflict(
  data: ScenarioData,
  initialStatus: 'ACTIVE' | 'ON_LEAVE',
): void {
  expectFutureAssignmentPreserved(data)
  expect(data.final.assignmentCount).toBe(2)
  expect(data.final.assignments).toHaveLength(2)
  expect(data.final.openPrimaryAssignmentCount).toBe(2)
  expect(data.final.openPrimaryAssignmentStatuses).toEqual(
    initialStatus === 'ACTIVE' ? ['ACTIVE', 'ACTIVE'] : ['ON_LEAVE', 'ACTIVE'],
  )
  expect(data.final.assignments.map((assignment) => assignment.id).sort()).toEqual(
    [data.final.initialAssignmentId, data.final.futureAssignmentId].sort(),
  )
  expect(assignmentFor(data, data.final.initialAssignmentId, 'initial')).toEqual({
    id: data.final.initialAssignmentId,
    companyId: data.final.companyId,
    status: initialStatus,
    effectiveDate: initialStatus === 'ACTIVE' ? '2020-01-01' : '2025-01-06',
    endDate: null,
    employmentType: 'FULL_TIME',
    isPrimary: true,
  })
  expect(data.final.transitionAuditActions).toEqual([])
}

const optedIn =
  process.env.RUN_DB_CONCURRENCY_TESTS === '1' &&
  Boolean(process.env.TEST_DATABASE_URL)

test.describe('LOA/payroll database concurrency boundaries', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(
    !optedIn,
    'Set RUN_DB_CONCURRENCY_TESTS=1 and TEST_DATABASE_URL to run destructive-isolated DB tests.',
  )

  let harness: HarnessDriver | undefined

  test.beforeAll(async () => {
    const databaseUrl = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL as string)
    harness = await HarnessDriver.start(databaseUrl)
  })

  test.afterAll(async () => {
    await harness?.stop()
  })

  test('consumes a completed-before-run obligation as one BASE deduction', async () => {
    const data = await harness!.run('completed-before-run-base', (id) =>
      driveHeldFirst(harness!, id),
    )

    expectSuccess(operation(data, 'complete'))
    expectSuccess(operation(data, 'createRun'))
    expect(data.final.loaStatus).toBe('COMPLETED')
    expect(data.final.obligationCreatedCount).toBe(1)
    expect(data.final.obligationConsumedCount).toBe(1)
    expect(data.final.obligationKinds).toEqual(['BASE_DEDUCTION'])
    expect(data.final.obligationConsumedKeys).toEqual(data.final.obligationCreatedKeys)

    const run = runFor(data, SOURCE_YEAR_MONTH)
    expect(run.adjustments).toHaveLength(1)
    expect(run.adjustments[0]).toMatchObject({
      type: 'DEDUCTION',
      loaYearMonth: SOURCE_YEAR_MONTH,
    })
    expect(run.adjustments[0].amount).toBeLessThan(0)
    expectAggregateEquality(data)
  })

  test('routes a locked-source delta only to a strictly later COMPENSATION run', async () => {
    const data = await harness!.run('locked-source-later-compensation')

    for (const name of ['sourceRun', 'laterRun', 'returnRequest', 'complete']) {
      expectSuccess(operation(data, name))
    }
    expect(data.final.loaStatus).toBe('COMPLETED')
    expect(data.final.obligationCreatedCount).toBe(0)

    const sourceRun = runFor(data, SOURCE_YEAR_MONTH)
    const laterRun = runFor(data, LATER_YEAR_MONTH)
    expect(sourceRun.status).toBe('REVIEW')
    expect(laterRun.yearMonth > sourceRun.yearMonth).toBe(true)
    expect(sourceRun.adjustments).toHaveLength(1)
    expect(sourceRun.adjustments[0].type).toBe('DEDUCTION')
    expect(sourceRun.adjustments[0].amount).toBeLessThan(0)
    expect(laterRun.adjustments).toHaveLength(1)
    expect(laterRun.adjustments[0]).toMatchObject({
      type: 'CORRECTION',
      loaYearMonth: SOURCE_YEAR_MONTH,
    })
    expect(laterRun.adjustments[0].amount).toBeGreaterThan(0)
    expect(laterRun.adjustments[0].description).toContain('휴직 소급 정산')
    expectAggregateEquality(data)
  })

  test('rolls back obligation consumption and retries each marker exactly once', async () => {
    const data = await harness!.run('obligation-rollback-retry', (id) =>
      driveHeldFirst(harness!, id),
    )

    expectSuccess(operation(data, 'complete'))
    expectFailure(operation(data, 'rolledBackRun'), 'E2E_FORCED_ROLLBACK')
    expectSuccess(operation(data, 'retryRun'))
    expect(data.final.runCount).toBe(1)
    expect(data.final.rollbackAuditCount).toBe(0)
    expect(data.final.obligationCreatedCount).toBe(1)
    expect(data.final.obligationConsumedCount).toBe(1)
    expect(new Set(data.final.obligationCreatedKeys).size).toBe(1)
    expect(new Set(data.final.obligationConsumedKeys).size).toBe(1)
    expect(data.final.obligationConsumedKeys).toEqual(data.final.obligationCreatedKeys)
    expect(runFor(data, SOURCE_YEAR_MONTH).adjustments).toHaveLength(1)
    expectAggregateEquality(data)
  })

  test('CAS allows one assignment restoration in both cancel-vs-complete orders', async () => {
    const completeFirst = await harness!.run(
      'cancel-vs-complete-complete-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectSuccess(operation(completeFirst, 'complete'))
    expectFailure(operation(completeFirst, 'cancel'), 'CONFLICT')
    expect(completeFirst.final.loaStatus).toBe('COMPLETED')
    expect(completeFirst.final.transitionAuditActions).toEqual([
      'LEAVE_OF_ABSENCE_COMPLETE',
    ])
    expectExactlyOneRestoredAssignment(completeFirst)
    expectAggregateEquality(completeFirst)

    const cancelFirst = await harness!.run(
      'cancel-vs-complete-cancel-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectSuccess(operation(cancelFirst, 'cancel'))
    expectFailure(operation(cancelFirst, 'complete'), 'CONFLICT')
    expect(cancelFirst.final.loaStatus).toBe('CANCELLED')
    expect(cancelFirst.final.transitionAuditActions).toEqual([
      'LEAVE_OF_ABSENCE_CANCEL',
    ])
    expectExactlyOneRestoredAssignment(cancelFirst)
    expectAggregateEquality(cancelFirst)
  })

  test('LOA-first makes the stale scheduled primary writer roll back', async () => {
    const data = await harness!.run(
      'loa-first-vs-scheduled-primary-writer',
      (id) => driveHeldFirst(harness!, id),
    )

    expectSuccess(operation(data, 'activate'))
    expectFailure(operation(data, 'writer'), 'CONFLICT')
    expect(data.final.loaStatus).toBe('ACTIVE')
    expect(data.final.loaActualEndDate).toBeNull()
    expect(data.final.returnAssignmentId).toBeNull()
    expect(data.final.transitionAuditActions).toEqual([
      'LEAVE_OF_ABSENCE_ACTIVATE',
    ])
    const loaAssignmentId = data.final.loaAssignmentId
    expect(loaAssignmentId).not.toBeNull()
    if (!loaAssignmentId) throw new Error('Missing activated LOA assignment id.')
    expect(data.final.assignments).toEqual([
      {
        id: data.final.initialAssignmentId,
        companyId: data.final.companyId,
        status: 'ACTIVE',
        effectiveDate: '2020-01-01',
        endDate: '2025-01-06',
        employmentType: 'FULL_TIME',
        isPrimary: true,
      },
      {
        id: loaAssignmentId,
        companyId: data.final.companyId,
        status: 'ON_LEAVE',
        effectiveDate: '2025-01-06',
        endDate: null,
        employmentType: 'FULL_TIME',
        isPrimary: true,
      },
    ])
    expect(data.final.assignmentCount).toBe(2)
    expect(data.final.openPrimaryAssignmentCount).toBe(1)
    expect(data.final.openPrimaryAssignmentStatuses).toEqual(['ON_LEAVE'])
    expect(data.final.departmentDeletedAt).toBeNull()
    expect(data.final.targetDepartmentAssignmentIds).toEqual([])
  })

  test('scheduled primary writer-first makes LOA activation roll back', async () => {
    const data = await harness!.run(
      'scheduled-primary-writer-first-vs-loa-activate',
      (id) => driveHeldFirst(harness!, id),
    )

    const writerId = successfulString(operation(data, 'writer'), 'id')
    expectFailure(operation(data, 'activate'), 'CONFLICT')
    expect(data.final.loaStatus).toBe('APPROVED')
    expect(data.final.loaActualEndDate).toBeNull()
    expect(data.final.loaAssignmentId).toBeNull()
    expect(data.final.returnAssignmentId).toBeNull()
    expect(data.final.transitionAuditActions).toEqual([])
    expect(data.final.assignments).toEqual([
      {
        id: data.final.initialAssignmentId,
        companyId: data.final.companyId,
        status: 'ACTIVE',
        effectiveDate: '2020-01-01',
        endDate: '2025-01-07',
        employmentType: 'FULL_TIME',
        isPrimary: true,
      },
      {
        id: writerId,
        companyId: data.final.companyId,
        status: 'ACTIVE',
        effectiveDate: '2025-01-07',
        endDate: null,
        employmentType: 'FULL_TIME',
        isPrimary: true,
      },
    ])
    expect(data.final.assignmentCount).toBe(2)
    expect(data.final.openPrimaryAssignmentCount).toBe(1)
    expect(data.final.openPrimaryAssignmentStatuses).toEqual(['ACTIVE'])
    expect(data.final.departmentDeletedAt).toBeNull()
    expect(data.final.targetDepartmentAssignmentIds).toEqual([writerId])
  })

  test('department delete-first rejects a waiting assignment writer', async () => {
    const data = await harness!.run(
      'department-delete-first-vs-assignment-writer',
      (id) => driveHeldFirst(harness!, id),
    )

    expectSuccess(operation(data, 'deleteDepartment'))
    expectFailure(operation(data, 'writer'), 'CONFLICT')
    expect(data.final.departmentDeletedAt).toBe('2025-02-03T00:00:00.000Z')
    expect(data.final.targetDepartmentAssignmentIds).toEqual([])
    expect(data.final.assignments).toEqual([
      {
        id: data.final.initialAssignmentId,
        companyId: data.final.companyId,
        status: 'ACTIVE',
        effectiveDate: '2020-01-01',
        endDate: null,
        employmentType: 'FULL_TIME',
        isPrimary: true,
      },
    ])
    expect(data.final.assignmentCount).toBe(1)
    expect(data.final.openPrimaryAssignmentCount).toBe(1)
    expect(data.final.openPrimaryAssignmentStatuses).toEqual(['ACTIVE'])
    expect(data.final.loaStatus).toBe('APPROVED')
    expect(data.final.loaAssignmentId).toBeNull()
    expect(data.final.transitionAuditActions).toEqual([])
  })

  test('assignment writer-first keeps its department live', async () => {
    const data = await harness!.run(
      'assignment-writer-first-vs-department-delete',
      (id) => driveHeldFirst(harness!, id),
    )

    const writerId = successfulString(operation(data, 'writer'), 'id')
    expectFailure(operation(data, 'deleteDepartment'), 'CONFLICT')
    expect(data.final.departmentDeletedAt).toBeNull()
    expect(data.final.targetDepartmentAssignmentIds).toEqual([writerId])
    expect(data.final.assignments).toEqual([
      {
        id: data.final.initialAssignmentId,
        companyId: data.final.companyId,
        status: 'ACTIVE',
        effectiveDate: '2020-01-01',
        endDate: '2025-01-07',
        employmentType: 'FULL_TIME',
        isPrimary: true,
      },
      {
        id: writerId,
        companyId: data.final.companyId,
        status: 'ACTIVE',
        effectiveDate: '2025-01-07',
        endDate: null,
        employmentType: 'FULL_TIME',
        isPrimary: true,
      },
    ])
    expect(data.final.assignmentCount).toBe(2)
    expect(data.final.openPrimaryAssignmentCount).toBe(1)
    expect(data.final.openPrimaryAssignmentStatuses).toEqual(['ACTIVE'])
    expect(data.final.loaStatus).toBe('APPROVED')
    expect(data.final.loaAssignmentId).toBeNull()
    expect(data.final.transitionAuditActions).toEqual([])
  })

  test('assignment master-data lock makes position deletion wait and recheck', async () => {
    const data = await harness!.run(
      'assignment-writer-first-vs-position-delete',
      (id) => driveMasterRowLock(harness!, id),
    )

    const writerId = successfulString(operation(data, 'writer'), 'id')
    expectFailure(operation(data, 'deletePosition'), 'CONFLICT')
    expect(data.final.positionId).not.toBeNull()
    expect(data.final.positionDeletedAt).toBeNull()
    expect(data.final.openPositionAssignmentIds).toEqual([writerId])
    expect(data.final.openDeletedPositionReferenceCount).toBe(0)
    expect(data.final.assignmentCount).toBe(2)
    expect(data.final.openPrimaryAssignmentCount).toBe(1)
    expect(data.final.openPrimaryAssignmentStatuses).toEqual(['ACTIVE'])
    expect(assignmentFor(data, data.final.initialAssignmentId, 'initial')).toEqual({
      id: data.final.initialAssignmentId,
      companyId: data.final.companyId,
      status: 'ACTIVE',
      effectiveDate: '2020-01-01',
      endDate: '2025-01-07',
      employmentType: 'FULL_TIME',
      isPrimary: true,
    })
    expect(assignmentFor(data, writerId, 'master-fenced writer')).toEqual({
      id: writerId,
      companyId: data.final.companyId,
      status: 'ACTIVE',
      effectiveDate: '2025-01-07',
      endDate: null,
      employmentType: 'FULL_TIME',
      isPrimary: true,
    })
  })

  test('position delete-first rejects a waiting hierarchy writer', async () => {
    const data = await harness!.run(
      'position-delete-first-vs-hierarchy-writer',
      (id) => driveMasterDeleteRowLock(harness!, id),
    )

    expectSuccess(operation(data, 'deletePosition'))
    expectFailure(operation(data, 'hierarchyWriter'), 'CONFLICT')
    expect(data.final.positionId).not.toBeNull()
    expect(data.final.positionDeletedAt).not.toBeNull()
    expect(data.final.activeChildPositionIds).toEqual([])
    expect(data.final.openDeletedPositionReferenceCount).toBe(0)
  })

  test('rolls back activation when a future cross-company primary assignment exists', async () => {
    const data = await harness!.run('future-assignment-activate')

    expectFailure(operation(data, 'activate'), 'CONFLICT')
    expect(data.final.loaStatus).toBe('APPROVED')
    expect(data.final.loaActualEndDate).toBeNull()
    expect(data.final.loaAssignmentId).toBeNull()
    expect(data.final.returnAssignmentId).toBeNull()
    expectAssignmentsUnchangedAfterFutureConflict(data, 'ACTIVE')
  })

  test('rolls back completion when a future cross-company primary assignment exists', async () => {
    const data = await harness!.run('future-assignment-complete')

    expectFailure(operation(data, 'complete'), 'CONFLICT')
    expect(data.final.loaStatus).toBe('RETURN_REQUESTED')
    expect(data.final.loaActualEndDate).toBeNull()
    expect(data.final.loaAssignmentId).toBe(data.final.initialAssignmentId)
    expect(data.final.returnAssignmentId).toBeNull()
    expectAssignmentsUnchangedAfterFutureConflict(data, 'ON_LEAVE')
  })

  test('rolls back cancellation when a future cross-company primary assignment exists', async () => {
    const data = await harness!.run('future-assignment-cancel')

    expectFailure(operation(data, 'cancel'), 'CONFLICT')
    expect(data.final.loaStatus).toBe('ACTIVE')
    expect(data.final.loaActualEndDate).toBeNull()
    expect(data.final.loaAssignmentId).toBe(data.final.initialAssignmentId)
    expect(data.final.returnAssignmentId).toBeNull()
    expectAssignmentsUnchangedAfterFutureConflict(data, 'ON_LEAVE')
  })
})
