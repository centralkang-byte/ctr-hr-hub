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
  'e2e/harness/attendance-period-concurrency-harness.ts',
)
const SERVER_ONLY_SHIM_PATH = path.join(
  process.cwd(),
  'e2e/harness/server-only-shim.cjs',
)
const PROTOCOL_TIMEOUT_MS = 25_000
const TEARDOWN_TIMEOUT_MS = 15_000
const SAFE_TEST_DATABASE_PATTERN = /(^|[_-])test($|[_-])/i

type ScenarioName =
  | 'duplicate-correction-create'
  | 'approve-vs-clock-out-approve-first'
  | 'approve-vs-clock-out-clock-out-first'
  | 'concurrent-clock-out'
  | 'approve-vs-direct-correction-approve-first'
  | 'approve-vs-direct-correction-direct-first'
  | 'close-vs-correction-create-close-first'
  | 'close-vs-correction-create-create-first'
  | 'close-vs-correction-approve-close-first'
  | 'close-vs-correction-approve-approve-first'
  | 'calculate-start-vs-reopen-calculate-first'
  | 'calculate-start-vs-reopen-reopen-first'
  | 'phase-writer-vs-reopen-writer-first'
  | 'phase-writer-vs-reopen-reopen-first'
  | 'tenant-boundary-decoy'

interface HarnessEvent {
  type: string
  id?: string
  ok?: boolean
  token?: string
  label?: string
  error?: unknown
  data?: unknown
  databaseName?: string
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

interface FinalState {
  attendanceClockIn: string | null
  attendanceClockOut: string | null
  attendanceTotalMinutes: number | null
  attendanceOvertimeMinutes: number | null
  attendanceNote: string | null
  attendanceMutationAuditCount: number
  correctionCreateAuditCount: number
  correctionApprovalAuditCount: number
  directCorrectionAuditCount: number
  requestStatus: string | null
  requestStepStatuses: string[]
  pendingCorrectionCount: number
  payrollRunId: string | null
  payrollStatus: string | null
  payrollItemCount: number
  decoyAttendanceClockIn: string | null
  decoyAttendanceClockOut: string | null
  decoyAttendanceNote: string | null
  decoyPayrollStatus: string | null
}

interface ScenarioData {
  outcomes: Record<string, OperationOutcome>
  final: FinalState
}

function requireSafeTestDatabaseUrl(): {
  connectionString: string
  databaseName: string
} {
  const connectionString = process.env.TEST_DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error(
      'RUN_DB_CONCURRENCY_TESTS=1 requires a dedicated TEST_DATABASE_URL.',
    )
  }
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
  if (
    !databaseName ||
    databaseName.includes('/') ||
    !SAFE_TEST_DATABASE_PATTERN.test(databaseName)
  ) {
    throw new Error(
      `Refusing DB concurrency tests: database "${databaseName || 'unknown'}" lacks a standalone test marker.`,
    )
  }
  return { connectionString, databaseName }
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
        `Concurrency harness exited (code=${String(code)}, signal=${String(signal)}).${suffix}`,
      )
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer)
        waiter.reject(error)
      }
    })
  }

  static async start(
    databaseUrl: string,
    expectedDatabaseName: string,
  ): Promise<HarnessDriver> {
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
          RUN_DB_CONCURRENCY_TESTS: '1',
          TEST_DATABASE_URL: databaseUrl,
          DATABASE_URL: databaseUrl,
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
    if (ready.databaseName !== expectedDatabaseName) {
      await driver.stop().catch(() => undefined)
      throw new Error(
        `Harness database marker mismatch: expected ${expectedDatabaseName}, received ${ready.databaseName ?? 'unknown'}.`,
      )
    }
    return driver
  }

  private accept(event: HarnessEvent): void {
    const waiterIndex = this.waiters.findIndex((waiter) =>
      waiter.predicate(event),
    )
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
      return Promise.reject(new Error('Concurrency harness is not running.'))
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex(
          (candidate) => candidate.resolve === resolve,
        )
        if (index !== -1) this.waiters.splice(index, 1)
        const suffix = this.stderr ? `\nHarness stderr:\n${this.stderr}` : ''
        reject(
          new Error(
            `Timed out waiting for harness ${description}.${suffix}`,
          ),
        )
      }, timeoutMs)
      this.waiters.push({ predicate, resolve, reject, timer })
    })
  }

  private send(command: Record<string, unknown>): void {
    if (this.exited) throw new Error('Concurrency harness is not running.')
    this.child.stdin.write(`${JSON.stringify(command)}\n`)
  }

  async waitForBarrier(id: string, label: string): Promise<HarnessEvent> {
    return this.waitFor(
      (event) =>
        event.type === 'barrier' && event.id === id && event.label === label,
      `barrier ${label}`,
    )
  }

  release(event: HarnessEvent): void {
    if (!event.id || !event.token) {
      throw new Error('Cannot release a barrier without id and token.')
    }
    this.send({ type: 'release', id: event.id, token: event.token })
  }

  async run(
    name: ScenarioName,
    drive: (id: string) => Promise<void>,
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
    try {
      await drive(id)
    } catch (error) {
      this.send({ type: 'cancel', id })
      throw error
    }
    const result = await this.waitFor(
      (event) => event.type === 'result' && event.id === id,
      `result for ${name}`,
    )
    if (!result.ok) {
      throw new Error(`Harness scenario ${name} failed: ${formatProtocolError(result.error)}`)
    }
    const data = result.data as ScenarioData
    expect(data.final.decoyAttendanceClockIn).toBe(
      '2026-07-14T23:15:00.000Z',
    )
    expect(data.final.decoyAttendanceClockOut).toBeNull()
    expect(data.final.decoyAttendanceNote).toBe(
      'tenant decoy - must remain unchanged',
    )
    expect(data.final.decoyPayrollStatus).toBe('ATTENDANCE_CLOSED')
    return data
  }

  private waitForExit(timeoutMs: number): Promise<boolean> {
    if (this.exited) return Promise.resolve(true)
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.child.off('exit', onExit)
        resolve(false)
      }, timeoutMs)
      const onExit = () => {
        clearTimeout(timer)
        resolve(true)
      }
      this.child.once('exit', onExit)
    })
  }

  private async forceStop(): Promise<void> {
    if (this.exited) return
    this.child.kill('SIGTERM')
    if (await this.waitForExit(3_000)) return
    this.child.kill('SIGKILL')
    if (!(await this.waitForExit(2_000))) {
      throw new Error('Concurrency harness did not exit after SIGKILL.')
    }
  }

  async stop(): Promise<void> {
    if (this.exited) return
    const id = randomUUID()
    let teardownError: unknown
    try {
      this.send({ type: 'teardown', id })
      const teardown = await this.waitFor(
        (event) => event.type === 'teardown' && event.id === id,
        'teardown acknowledgement',
        TEARDOWN_TIMEOUT_MS,
      )
      if (!teardown.ok) {
        throw new Error(
          `Harness teardown failed: ${formatProtocolError(teardown.error)}`,
        )
      }
      this.child.stdin.end()
      if (!(await this.waitForExit(2_000))) await this.forceStop()
    } catch (error) {
      teardownError = error
      await this.forceStop()
    } finally {
      this.output.close()
    }
    if (teardownError) throw teardownError
  }
}

async function driveHeldFirst(
  harness: HarnessDriver,
  id: string,
): Promise<void> {
  const winner = await harness.waitForBarrier(id, 'winner-held')
  const contender = await harness.waitForBarrier(id, 'contender-blocked')
  harness.release(contender)
  harness.release(winner)
}

async function driveApproveFirst(
  harness: HarnessDriver,
  id: string,
): Promise<void> {
  const approval = await harness.waitForBarrier(id, 'approve-row-held')
  const clockCandidate = await harness.waitForBarrier(
    id,
    'clock-candidate-held',
  )
  harness.release(clockCandidate)
  const contender = await harness.waitForBarrier(id, 'contender-blocked')
  harness.release(contender)
  harness.release(approval)
}

async function driveApprovalBeforeDirectCorrection(
  harness: HarnessDriver,
  id: string,
): Promise<void> {
  const approval = await harness.waitForBarrier(id, 'approval-row-held')
  const directCandidate = await harness.waitForBarrier(
    id,
    'direct-candidate-held',
  )
  harness.release(directCandidate)
  const contender = await harness.waitForBarrier(id, 'contender-blocked')
  harness.release(contender)
  harness.release(approval)
}

async function driveClockOutWinner(
  harness: HarnessDriver,
  id: string,
): Promise<void> {
  const winner = await harness.waitForBarrier(id, 'winner-held')
  const contenderCandidate = await harness.waitForBarrier(
    id,
    'contender-candidate-held',
  )
  harness.release(contenderCandidate)
  const contender = await harness.waitForBarrier(id, 'contender-blocked')
  harness.release(contender)
  harness.release(winner)
}

async function driveCalculateFirst(
  harness: HarnessDriver,
  id: string,
): Promise<void> {
  const calculation = await harness.waitForBarrier(id, 'calculation-run-held')
  const reopenRegistry = await harness.waitForBarrier(
    id,
    'reopen-registry-held',
  )
  harness.release(calculation)
  const calculationStarted = await harness.waitForBarrier(
    id,
    'calculation-started',
  )
  harness.release(calculationStarted)
  harness.release(reopenRegistry)
}

async function driveReopenFirstCalculation(
  harness: HarnessDriver,
  id: string,
): Promise<void> {
  const calculationCandidate = await harness.waitForBarrier(
    id,
    'calculation-candidate-held',
  )
  const reopen = await harness.waitForBarrier(id, 'reopen-run-held')
  harness.release(reopen)
  const committed = await harness.waitForBarrier(id, 'reopen-committed')
  harness.release(committed)
  harness.release(calculationCandidate)
}

function operation(data: ScenarioData, name: string): OperationOutcome {
  const result = data.outcomes[name]
  expect(result, `missing operation outcome: ${name}`).toBeDefined()
  return result
}

function expectSuccess(result: OperationOutcome): void {
  expect(result.ok, result.ok ? undefined : result.error.message).toBe(true)
}

function expectFailure(result: OperationOutcome, code: string): void {
  expect(result.ok).toBe(false)
  if (result.ok) return
  expect(result.error.code).toBe(code)
}

const runDbConcurrencyTests = process.env.RUN_DB_CONCURRENCY_TESTS === '1'

test.describe('attendance/payroll period concurrency boundaries', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(
    !runDbConcurrencyTests,
    'Set RUN_DB_CONCURRENCY_TESTS=1 and TEST_DATABASE_URL to run DB-writing concurrency tests.',
  )

  let harness: HarnessDriver | undefined

  test.beforeAll(async () => {
    const database = requireSafeTestDatabaseUrl()
    harness = await HarnessDriver.start(
      database.connectionString,
      database.databaseName,
    )
  })

  test.afterAll(async () => {
    await harness?.stop()
  })

  test('serializes duplicate correction creation to one pending request', async () => {
    const data = await harness!.run('duplicate-correction-create', (id) =>
      driveHeldFirst(harness!, id),
    )

    expectSuccess(operation(data, 'primary'))
    expectFailure(operation(data, 'contender'), 'ATTENDANCE_CORRECTION_DUPLICATE')
    expect(data.final.pendingCorrectionCount).toBe(1)
    expect(data.final.requestStatus).toBe('pending')
    expect(data.final.requestStepStatuses).toEqual(['pending'])
    expect(data.final.correctionCreateAuditCount).toBe(1)
    expect(data.final.correctionApprovalAuditCount).toBe(0)
  })

  test('serializes correction approval against clock-out in both orders', async () => {
    const approveFirst = await harness!.run(
      'approve-vs-clock-out-approve-first',
      (id) => driveApproveFirst(harness!, id),
    )
    expectSuccess(operation(approveFirst, 'approval'))
    expectSuccess(operation(approveFirst, 'clockOut'))
    expect(approveFirst.final.requestStatus).toBe('approved')
    expect(approveFirst.final.attendanceClockIn).toBe(
      '2026-07-14T23:20:00.000Z',
    )
    expect(approveFirst.final.attendanceClockOut).toBe(
      '2026-07-15T08:45:00.000Z',
    )
    expect(approveFirst.final.attendanceTotalMinutes).toBe(565)
    expect(approveFirst.final.requestStepStatuses).toEqual(['approved'])
    expect(approveFirst.final.correctionCreateAuditCount).toBe(1)
    expect(approveFirst.final.correctionApprovalAuditCount).toBe(1)
    expect(approveFirst.final.directCorrectionAuditCount).toBe(0)

    const clockOutFirst = await harness!.run(
      'approve-vs-clock-out-clock-out-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectSuccess(operation(clockOutFirst, 'clockOut'))
    expectFailure(
      operation(clockOutFirst, 'approval'),
      'ATTENDANCE_CORRECTION_STALE',
    )
    expect(clockOutFirst.final.requestStatus).toBe('pending')
    expect(clockOutFirst.final.attendanceClockIn).toBe(
      '2026-07-14T23:30:00.000Z',
    )
    expect(clockOutFirst.final.attendanceClockOut).toBe(
      '2026-07-15T08:45:00.000Z',
    )
    expect(clockOutFirst.final.attendanceTotalMinutes).toBe(555)
    expect(clockOutFirst.final.requestStepStatuses).toEqual(['pending'])
    expect(clockOutFirst.final.correctionCreateAuditCount).toBe(1)
    expect(clockOutFirst.final.correctionApprovalAuditCount).toBe(0)
  })

  test('allows exactly one mutation when approval races HR direct correction', async () => {
    const approvalFirst = await harness!.run(
      'approve-vs-direct-correction-approve-first',
      (id) => driveApprovalBeforeDirectCorrection(harness!, id),
    )
    expectSuccess(operation(approvalFirst, 'approval'))
    expectFailure(
      operation(approvalFirst, 'directCorrection'),
      'ATTENDANCE_CORRECTION_STALE',
    )
    expect(approvalFirst.final.requestStatus).toBe('approved')
    expect(approvalFirst.final.attendanceClockIn).toBe(
      '2026-07-14T23:20:00.000Z',
    )
    expect(approvalFirst.final.attendanceClockOut).toBeNull()
    expect(approvalFirst.final.attendanceNote).toBeNull()
    expect(approvalFirst.final.attendanceMutationAuditCount).toBe(1)
    expect(approvalFirst.final.requestStepStatuses).toEqual(['approved'])
    expect(approvalFirst.final.correctionApprovalAuditCount).toBe(1)
    expect(approvalFirst.final.directCorrectionAuditCount).toBe(0)

    const directFirst = await harness!.run(
      'approve-vs-direct-correction-direct-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectSuccess(operation(directFirst, 'directCorrection'))
    expectFailure(
      operation(directFirst, 'approval'),
      'ATTENDANCE_CORRECTION_STALE',
    )
    expect(directFirst.final.requestStatus).toBe('pending')
    expect(directFirst.final.attendanceClockIn).toBe(
      '2026-07-14T23:30:00.000Z',
    )
    expect(directFirst.final.attendanceClockOut).toBe(
      '2026-07-15T08:40:00.000Z',
    )
    expect(directFirst.final.attendanceNote).toBe(
      'deterministic direct correction',
    )
    expect(directFirst.final.attendanceMutationAuditCount).toBe(1)
    expect(directFirst.final.requestStepStatuses).toEqual(['pending'])
    expect(directFirst.final.correctionApprovalAuditCount).toBe(0)
    expect(directFirst.final.directCorrectionAuditCount).toBe(1)
  })

  test('allows exactly one winner for concurrent web and terminal clock-out', async () => {
    const data = await harness!.run('concurrent-clock-out', (id) =>
      driveClockOutWinner(harness!, id),
    )

    expectSuccess(operation(data, 'webClockOut'))
    expectFailure(operation(data, 'terminalClockOut'), 'ATTENDANCE_CLOCK_RACE')
    expect(data.final.attendanceClockOut).toBe('2026-07-15T08:45:00.000Z')
  })

  test('serializes attendance close against correction creation in both orders', async () => {
    const closeFirst = await harness!.run(
      'close-vs-correction-create-close-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectSuccess(operation(closeFirst, 'close'))
    expectFailure(operation(closeFirst, 'create'), 'ATTENDANCE_PERIOD_LOCKED')
    expect(closeFirst.final.payrollStatus).toBe('ATTENDANCE_CLOSED')
    expect(closeFirst.final.pendingCorrectionCount).toBe(0)

    const createFirst = await harness!.run(
      'close-vs-correction-create-create-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectSuccess(operation(createFirst, 'create'))
    expectFailure(operation(createFirst, 'close'), 'ATTENDANCE_CORRECTION_PENDING')
    expect(createFirst.final.payrollStatus).toBeNull()
    expect(createFirst.final.pendingCorrectionCount).toBe(1)
  })

  test('serializes attendance close against correction approval in both orders', async () => {
    const closeFirst = await harness!.run(
      'close-vs-correction-approve-close-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectFailure(operation(closeFirst, 'close'), 'ATTENDANCE_CORRECTION_PENDING')
    expectSuccess(operation(closeFirst, 'approval'))
    expect(closeFirst.final.requestStatus).toBe('approved')
    expect(closeFirst.final.payrollStatus).toBeNull()
    expect(closeFirst.final.requestStepStatuses).toEqual(['approved'])
    expect(closeFirst.final.correctionApprovalAuditCount).toBe(1)

    const approveFirst = await harness!.run(
      'close-vs-correction-approve-approve-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectSuccess(operation(approveFirst, 'approval'))
    expectSuccess(operation(approveFirst, 'close'))
    expect(approveFirst.final.requestStatus).toBe('approved')
    expect(approveFirst.final.payrollStatus).toBe('ATTENDANCE_CLOSED')
    expect(approveFirst.final.requestStepStatuses).toEqual(['approved'])
    expect(approveFirst.final.correctionApprovalAuditCount).toBe(1)
  })

  test('serializes calculation start against attendance reopen in both orders', async () => {
    const calculateFirst = await harness!.run(
      'calculate-start-vs-reopen-calculate-first',
      (id) => driveCalculateFirst(harness!, id),
    )
    expectSuccess(operation(calculateFirst, 'calculation'))
    expectFailure(operation(calculateFirst, 'reopen'), 'BAD_REQUEST')
    expect(calculateFirst.final.payrollStatus).toBe('ADJUSTMENT')

    const reopenFirst = await harness!.run(
      'calculate-start-vs-reopen-reopen-first',
      (id) => driveReopenFirstCalculation(harness!, id),
    )
    expectSuccess(operation(reopenFirst, 'reopen'))
    expectFailure(operation(reopenFirst, 'calculation'), 'CONFLICT')
    expect(reopenFirst.final.payrollStatus).toBe('DRAFT')
  })

  test('serializes a phase writer against reopen without orphan child rows', async () => {
    const writerFirst = await harness!.run(
      'phase-writer-vs-reopen-writer-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectSuccess(operation(writerFirst, 'writer'))
    expectSuccess(operation(writerFirst, 'reopen'))
    expect(writerFirst.final.payrollStatus).toBe('DRAFT')
    expect(writerFirst.final.payrollItemCount).toBe(0)

    const reopenFirst = await harness!.run(
      'phase-writer-vs-reopen-reopen-first',
      (id) => driveHeldFirst(harness!, id),
    )
    expectSuccess(operation(reopenFirst, 'reopen'))
    expectFailure(operation(reopenFirst, 'writer'), 'BAD_REQUEST')
    expect(reopenFirst.final.payrollStatus).toBe('DRAFT')
    expect(reopenFirst.final.payrollItemCount).toBe(0)
  })

  test('rejects cross-tenant attendance and payroll mutations', async () => {
    const data = await harness!.run('tenant-boundary-decoy', async () => {})

    expectFailure(operation(data, 'correctionCreate'), 'NOT_FOUND')
    expectFailure(operation(data, 'directCorrection'), 'NOT_FOUND')
    expectFailure(operation(data, 'calculation'), 'NOT_FOUND')
    expectFailure(operation(data, 'phaseWriter'), 'NOT_FOUND')
    expect(data.final.pendingCorrectionCount).toBe(0)
    expect(data.final.correctionCreateAuditCount).toBe(0)
    expect(data.final.correctionApprovalAuditCount).toBe(0)
    expect(data.final.directCorrectionAuditCount).toBe(0)
  })
})
