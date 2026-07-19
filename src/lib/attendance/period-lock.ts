// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance/Payroll Period Concurrency Boundary
// Lock order: registry -> period -> parent row -> child rows.
// ═══════════════════════════════════════════════════════════

import 'server-only'

import type { Attendance, PayrollRun } from '@/generated/prisma/client'
import { AppError, badRequest } from '@/lib/errors'
import type { PrismaTx } from '@/lib/prisma-rls'

export type PeriodLockMode = 'shared' | 'exclusive'

export interface PeriodLockHookContext {
  operation: string
  key: string
  mode: PeriodLockMode
}

/**
 * Test-only seams are passed as service dependencies. They must never be
 * populated from request input or environment flags.
 */
export interface PeriodLockHooks {
  afterPeriodLock?: (context: PeriodLockHookContext) => Promise<void>
  afterAttendanceRowLock?: (context: {
    operation: string
    attendanceId: string
  }) => Promise<void>
  afterPayrollRunLock?: (context: {
    operation: string
    runId: string
    status: string
  }) => Promise<void>
}

interface PeriodLockOptions {
  companyId: string
  yearMonth: string
  operation: string
  mode: PeriodLockMode
  deps?: PeriodLockHooks
}

type SharedPeriodLockOptions = Omit<PeriodLockOptions, 'mode'>

interface RegistryLockOptions {
  companyId: string
  operation: string
  deps?: PeriodLockHooks
}

interface AttendanceRowLockOptions {
  companyId: string
  attendanceId: string
  operation: string
  deps?: PeriodLockHooks
}

interface PayrollRunRowLockOptions {
  companyId: string
  runId: string
  operation: string
  deps?: PeriodLockHooks
}

const YEAR_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/
const PERIOD_LOCK_NAMESPACE = 'attendance-period'
const RUN_REGISTRY_LOCK_NAMESPACE = 'payroll-run-registry'

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw badRequest(`${field} 값이 필요합니다.`)
  }
  return normalized
}

export function validateYearMonth(yearMonth: string): string {
  const normalized = yearMonth.trim()
  if (!YEAR_MONTH_PATTERN.test(normalized)) {
    throw badRequest('yearMonth는 YYYY-MM 형식이어야 합니다.')
  }
  return normalized
}

/** Attendance.workDate uses the UTC-midnight date-only convention. */
export function yearMonthFromWorkDate(workDate: Date): string {
  if (Number.isNaN(workDate.getTime())) {
    throw badRequest('유효한 workDate가 필요합니다.')
  }
  return workDate.toISOString().slice(0, 7)
}

export function attendancePeriodLockKey(
  companyId: string,
  yearMonth: string,
): string {
  return `${PERIOD_LOCK_NAMESPACE}:${requireNonEmpty(companyId, 'companyId')}:${validateYearMonth(yearMonth)}`
}

export function payrollRunRegistryLockKey(companyId: string): string {
  return `${RUN_REGISTRY_LOCK_NAMESPACE}:${requireNonEmpty(companyId, 'companyId')}`
}

function assertTransactionClient(tx: PrismaTx): void {
  const candidate = tx as unknown as {
    $connect?: unknown
    $disconnect?: unknown
  }
  // Prisma 7's pg adapter still exposes `$transaction` on the interactive
  // transaction proxy. Root clients retain connection lifecycle methods;
  // transaction clients do not.
  if (
    typeof candidate.$connect === 'function' ||
    typeof candidate.$disconnect === 'function'
  ) {
    throw new AppError(
      500,
      'ATTENDANCE_TRANSACTION_REQUIRED',
      '근태 기간 잠금에는 데이터베이스 트랜잭션이 필요합니다.',
    )
  }
}

async function acquireAdvisoryTransactionLock(
  tx: PrismaTx,
  key: string,
  mode: PeriodLockMode,
  operation: string,
  deps?: PeriodLockHooks,
): Promise<void> {
  assertTransactionClient(tx)

  if (mode === 'shared') {
    // Advisory lock functions return PostgreSQL `void`. Prisma 7's pg adapter
    // cannot deserialize that type through $queryRaw, so execute the SELECT
    // without materializing its result row.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock_shared(hashtextextended(${key}, 0))
    `
  } else {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))
    `
  }

  await deps?.afterPeriodLock?.({ operation, key, mode })
}

/**
 * Acquires the company/month transaction-level lock.
 * Attendance writers use shared mode; payroll phase writers use exclusive.
 */
export async function acquirePeriodLock(
  tx: PrismaTx,
  options: PeriodLockOptions,
): Promise<string> {
  const key = attendancePeriodLockKey(options.companyId, options.yearMonth)
  await acquireAdvisoryTransactionLock(
    tx,
    key,
    options.mode,
    options.operation,
    options.deps,
  )
  return key
}

export async function acquireSharedPeriodLock(
  tx: PrismaTx,
  options: SharedPeriodLockOptions,
): Promise<string> {
  return acquirePeriodLock(tx, { ...options, mode: 'shared' })
}

export async function acquireExclusivePeriodLock(
  tx: PrismaTx,
  options: SharedPeriodLockOptions,
): Promise<string> {
  return acquirePeriodLock(tx, { ...options, mode: 'exclusive' })
}

/**
 * Serializes MONTHLY run creation and LOA candidate-set selection per company.
 * Acquire this before any period lock when an operation needs both.
 */
export async function acquirePayrollRunRegistryLock(
  tx: PrismaTx,
  options: RegistryLockOptions,
): Promise<string> {
  const key = payrollRunRegistryLockKey(options.companyId)
  await acquireAdvisoryTransactionLock(
    tx,
    key,
    'exclusive',
    options.operation,
    options.deps,
  )
  return key
}

/**
 * Locks and re-reads an attendance row after its shared period lock.
 * Returns null when the tenant-scoped row does not exist.
 */
export async function lockAttendanceForUpdate(
  tx: PrismaTx,
  options: AttendanceRowLockOptions,
): Promise<Attendance | null> {
  assertTransactionClient(tx)
  const companyId = requireNonEmpty(options.companyId, 'companyId')
  const attendanceId = requireNonEmpty(options.attendanceId, 'attendanceId')

  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM attendances
    WHERE id = ${attendanceId}
      AND company_id = ${companyId}
    FOR UPDATE
  `
  if (locked.length === 0) return null

  const attendance = await tx.attendance.findFirst({
    where: { id: attendanceId, companyId },
  })
  if (!attendance) {
    throw new AppError(
      409,
      'ATTENDANCE_LOCK_TARGET_CHANGED',
      '잠금 처리 중 근태 기록이 변경되었습니다.',
      { attendanceId },
    )
  }

  await options.deps?.afterAttendanceRowLock?.({
    operation: options.operation,
    attendanceId,
  })
  return attendance
}

/**
 * Locks and re-reads a PayrollRun before any child-table read or mutation.
 * Returns null when the tenant-scoped row does not exist.
 */
export async function lockPayrollRunForUpdate(
  tx: PrismaTx,
  options: PayrollRunRowLockOptions,
): Promise<PayrollRun | null> {
  assertTransactionClient(tx)
  const companyId = requireNonEmpty(options.companyId, 'companyId')
  const runId = requireNonEmpty(options.runId, 'runId')

  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM payroll_runs
    WHERE id = ${runId}
      AND company_id = ${companyId}
    FOR UPDATE
  `
  if (locked.length === 0) return null

  const run = await tx.payrollRun.findFirst({
    where: { id: runId, companyId },
  })
  if (!run) {
    throw new AppError(
      409,
      'PAYROLL_LOCK_TARGET_CHANGED',
      '잠금 처리 중 급여 실행 정보가 변경되었습니다.',
      { runId },
    )
  }

  await options.deps?.afterPayrollRunLock?.({
    operation: options.operation,
    runId,
    status: run.status,
  })
  return run
}

type PayrollEditabilitySnapshot = Pick<
  PayrollRun,
  'id' | 'runType' | 'status' | 'attendanceClosedAt'
>

export function isAttendancePeriodEditable(
  run: PayrollEditabilitySnapshot | null,
): boolean {
  return (
    run === null ||
    run.runType !== 'MONTHLY' ||
    (run.status === 'DRAFT' && run.attendanceClosedAt === null)
  )
}

/**
 * Must be called after the shared period lock. BONUS and other non-MONTHLY
 * runs do not lock attendance for the month.
 */
export async function assertAttendancePeriodEditable(
  tx: PrismaTx,
  params: { companyId: string; yearMonth: string },
): Promise<PayrollEditabilitySnapshot | null> {
  assertTransactionClient(tx)
  const companyId = requireNonEmpty(params.companyId, 'companyId')
  const yearMonth = validateYearMonth(params.yearMonth)
  const run = await tx.payrollRun.findUnique({
    where: {
      companyId_yearMonth_runType: {
        companyId,
        yearMonth,
        runType: 'MONTHLY',
      },
    },
    select: {
      id: true,
      runType: true,
      status: true,
      attendanceClosedAt: true,
    },
  })

  if (run && !isAttendancePeriodEditable(run)) {
    throw new AppError(
      409,
      'ATTENDANCE_PERIOD_LOCKED',
      '급여 처리가 시작된 기간은 근태를 변경할 수 없습니다.',
      {
        yearMonth,
        payrollRunId: run.id,
        payrollStatus: run.status,
      },
    )
  }

  return run
}
