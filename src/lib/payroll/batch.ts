// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Payroll Batch Calculation
// Both calculation entry points share the same period/run lock contract.
// ═══════════════════════════════════════════════════════════

import 'server-only'

import type { PayrollRun, PayrollStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import type { PrismaTx } from '@/lib/prisma-rls'
import { AppError, badRequest, conflict, notFound } from '@/lib/errors'
import {
  acquireExclusivePeriodLock,
  acquirePayrollRunRegistryLock,
  lockPayrollRunForUpdate,
  type PeriodLockHooks,
} from '@/lib/attendance/period-lock'
import { consumeDeferredLoaObligationsForRun } from '@/lib/loa/payroll-adjustment'
import { calculatePayrollForEmployee } from './calculator'
import { resolvePayrollCalculationPeriod } from './period'
import type { PayrollItemDetail } from './types'

const CONCURRENCY = 10
const TERMINAL_TRANSACTION_TIMEOUT_MS = 60_000

type CalculationMode = 'legacy' | 'gp3'
type CalculationSourceStatus = 'DRAFT' | 'ATTENDANCE_CLOSED'

export interface PayrollCalculationDeps extends PeriodLockHooks {
  db?: typeof prisma
  afterCandidateRead?: (context: {
    operation: string
    runId: string
  }) => Promise<void>
}

export interface PayrollCalculationOptions {
  mode: CalculationMode
  authorizedCompanyId: string
  actorId: string
  deps?: PayrollCalculationDeps
}

export interface PayrollCalculationResult {
  payrollRun: PayrollRun
  sourceStatus: CalculationSourceStatus
  summary: {
    headcount: number
    totalGross: number
    totalDeductions: number
    totalNet: number
    previousRunId: string | null
  }
}

interface CalculationPolicy {
  operationPrefix: string
  allowedSources: readonly CalculationSourceStatus[]
  successStatus: Extract<PayrollStatus, 'ADJUSTMENT' | 'REVIEW'>
  applyExcludedEmployees: boolean
  resolvePreviousRun: boolean
}

const CALCULATION_POLICIES: Record<CalculationMode, CalculationPolicy> = {
  legacy: {
    operationPrefix: 'payroll-legacy-calculate',
    allowedSources: ['DRAFT', 'ATTENDANCE_CLOSED'],
    successStatus: 'REVIEW',
    applyExcludedEmployees: false,
    resolvePreviousRun: false,
  },
  gp3: {
    operationPrefix: 'payroll-gp3-calculate',
    allowedSources: ['ATTENDANCE_CLOSED'],
    successStatus: 'ADJUSTMENT',
    applyExcludedEmployees: true,
    resolvePreviousRun: true,
  },
}

async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

function monthBounds(yearMonth: string): { start: Date; endExclusive: Date } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth)
  if (!match) throw badRequest('yearMonth는 YYYY-MM 형식이어야 합니다.')
  const year = Number(match[1])
  const month = Number(match[2])
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    endExclusive: new Date(Date.UTC(year, month, 1)),
  }
}

async function assertNoPendingAttendanceCorrection(
  tx: PrismaTx,
  run: Pick<PayrollRun, 'companyId' | 'yearMonth'>,
): Promise<void> {
  const bounds = monthBounds(run.yearMonth)
  const [pendingCorrection] = await tx.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM attendance_approval_requests request
      JOIN attendances attendance
        ON attendance.id::text = request.reference_id
       AND attendance.company_id = request.company_id
      WHERE request.company_id = ${run.companyId}
        AND request.request_type = 'attendance_correction'
        AND request.status = 'pending'
        AND attendance.work_date >= ${bounds.start}
        AND attendance.work_date < ${bounds.endExclusive}
    ) AS exists
  `
  if (pendingCorrection?.exists) {
    throw new AppError(
      409,
      'ATTENDANCE_CORRECTION_PENDING',
      '처리 중인 근태 보정 요청이 있어 급여 계산을 시작할 수 없습니다.',
    )
  }
}

async function startCalculation(params: {
  db: typeof prisma
  candidate: Pick<PayrollRun, 'id' | 'companyId' | 'yearMonth' | 'status'>
  policy: CalculationPolicy
  deps?: PayrollCalculationDeps
}): Promise<{ run: PayrollRun; sourceStatus: CalculationSourceStatus }> {
  return params.db.$transaction(
    async (tx) => {
      const operation = `${params.policy.operationPrefix}-start`
      await acquireExclusivePeriodLock(tx, {
        companyId: params.candidate.companyId,
        yearMonth: params.candidate.yearMonth,
        operation,
        deps: params.deps,
      })
      const run = await lockPayrollRunForUpdate(tx, {
        companyId: params.candidate.companyId,
        runId: params.candidate.id,
        operation,
        deps: params.deps,
      })
      if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
      if (run.status !== params.candidate.status) {
        throw conflict(
          `급여 계산 대기 중 실행 상태가 변경되었습니다. (현재: ${run.status})`,
        )
      }
      if (!params.policy.allowedSources.includes(run.status as CalculationSourceStatus)) {
        throw badRequest(
          `${params.policy.allowedSources.join(' 또는 ')} 상태에서만 급여 계산을 시작할 수 있습니다. (현재: ${run.status})`,
        )
      }

      // Validate the calculation identity without rejecting legacy MONTHLY
      // timestamps; MONTHLY boundaries are reconstructed from yearMonth.
      resolvePayrollCalculationPeriod(run)

      if (run.runType === 'MONTHLY') {
        await assertNoPendingAttendanceCorrection(tx, run)
      }
      const sourceStatus = run.status as CalculationSourceStatus
      const transition = await tx.payrollRun.updateMany({
        where: {
          id: run.id,
          companyId: run.companyId,
          status: sourceStatus,
        },
        data: { status: 'CALCULATING' },
      })
      if (transition.count !== 1) {
        throw conflict('급여 실행 상태가 변경되었습니다.')
      }
      return { run, sourceStatus }
    },
    { timeout: TERMINAL_TRANSACTION_TIMEOUT_MS },
  )
}

async function resolvePreviousRunId(
  run: PayrollRun,
  db: typeof prisma,
): Promise<string | null> {
  const [year, month] = run.yearMonth.split('-').map(Number)
  const previousMonth = new Date(Date.UTC(year, month - 2, 1))
  const previousYearMonth = `${previousMonth.getUTCFullYear()}-${String(
    previousMonth.getUTCMonth() + 1,
  ).padStart(2, '0')}`
  const previousRun = await db.payrollRun.findFirst({
    where: {
      companyId: run.companyId,
      yearMonth: previousYearMonth,
      runType: run.runType,
      status: { not: 'CANCELLED' },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  return previousRun?.id ?? null
}

async function commitCalculation(params: {
  db: typeof prisma
  run: PayrollRun
  results: Array<{ employeeId: string; detail: PayrollItemDetail }>
  totals: {
    totalGross: number
    totalDeductions: number
    totalNet: number
  }
  previousRunId: string | null
  actorId: string
  policy: CalculationPolicy
  deps?: PayrollCalculationDeps
}): Promise<PayrollRun> {
  return params.db.$transaction(
    async (tx) => {
      const operation = `${params.policy.operationPrefix}-success`
      if (params.policy.successStatus === 'ADJUSTMENT') {
        await acquirePayrollRunRegistryLock(tx, {
          companyId: params.run.companyId,
          operation,
          deps: params.deps,
        })
      }
      await acquireExclusivePeriodLock(tx, {
        companyId: params.run.companyId,
        yearMonth: params.run.yearMonth,
        operation,
        deps: params.deps,
      })
      const lockedRun = await lockPayrollRunForUpdate(tx, {
        companyId: params.run.companyId,
        runId: params.run.id,
        operation,
        deps: params.deps,
      })
      if (!lockedRun) throw notFound('급여 실행을 찾을 수 없습니다.')
      if (lockedRun.status !== 'CALCULATING') {
        throw conflict(`계산 완료 전에 급여 실행 상태가 변경되었습니다. (현재: ${lockedRun.status})`)
      }

      if (params.policy.successStatus === 'ADJUSTMENT') {
        await consumeDeferredLoaObligationsForRun(tx, {
          run: lockedRun,
          actorId: params.actorId,
          projectedStatus: 'ADJUSTMENT',
        })
      }

      for (const { employeeId, detail } of params.results) {
        await tx.payrollItem.upsert({
          where: { id: `${params.run.id}-${employeeId}` },
          create: {
            id: `${params.run.id}-${employeeId}`,
            runId: params.run.id,
            employeeId,
            baseSalary: detail.earnings.baseSalary,
            overtimePay: detail.earnings.overtimePay,
            bonus: detail.earnings.bonuses,
            allowances:
              detail.earnings.mealAllowance +
              detail.earnings.transportAllowance +
              detail.earnings.fixedOvertimeAllowance +
              detail.earnings.otherEarnings,
            grossPay: detail.grossPay,
            deductions: detail.totalDeductions,
            netPay: detail.netPay,
            currency: 'KRW',
            detail: JSON.parse(JSON.stringify(detail)),
          },
          update: {
            baseSalary: detail.earnings.baseSalary,
            overtimePay: detail.earnings.overtimePay,
            bonus: detail.earnings.bonuses,
            allowances:
              detail.earnings.mealAllowance +
              detail.earnings.transportAllowance +
              detail.earnings.fixedOvertimeAllowance +
              detail.earnings.otherEarnings,
            grossPay: detail.grossPay,
            deductions: detail.totalDeductions,
            netPay: detail.netPay,
            detail: JSON.parse(JSON.stringify(detail)),
            isManuallyAdjusted: false,
            adjustmentReason: null,
          },
        })
      }

      const transition = await tx.payrollRun.updateMany({
        where: {
          id: lockedRun.id,
          companyId: lockedRun.companyId,
          status: 'CALCULATING',
        },
        data: {
          ...params.totals,
          headcount: params.results.length,
          status: params.policy.successStatus,
          ...(params.policy.resolvePreviousRun
            ? { previousMonthRunId: params.previousRunId }
            : {}),
        },
      })
      if (transition.count !== 1) {
        throw conflict('급여 계산 완료 상태가 변경되었습니다.')
      }

      return tx.payrollRun.findUniqueOrThrow({ where: { id: lockedRun.id } })
    },
    { timeout: TERMINAL_TRANSACTION_TIMEOUT_MS },
  )
}

async function recoverCalculation(params: {
  db: typeof prisma
  run: PayrollRun
  sourceStatus: CalculationSourceStatus
  actorId: string
  policy: CalculationPolicy
  deps?: PayrollCalculationDeps
}): Promise<boolean> {
  return params.db.$transaction(
    async (tx) => {
      const operation = `${params.policy.operationPrefix}-failure`
      if (params.sourceStatus === 'DRAFT') {
        await acquirePayrollRunRegistryLock(tx, {
          companyId: params.run.companyId,
          operation,
          deps: params.deps,
        })
      }
      await acquireExclusivePeriodLock(tx, {
        companyId: params.run.companyId,
        yearMonth: params.run.yearMonth,
        operation,
        deps: params.deps,
      })
      const lockedRun = await lockPayrollRunForUpdate(tx, {
        companyId: params.run.companyId,
        runId: params.run.id,
        operation,
        deps: params.deps,
      })
      if (!lockedRun || lockedRun.status !== 'CALCULATING') return false

      if (params.sourceStatus === 'DRAFT') {
        await consumeDeferredLoaObligationsForRun(tx, {
          run: lockedRun,
          actorId: params.actorId,
          projectedStatus: 'DRAFT',
          projectedAttendanceClosedAt: null,
        })
      }

      const transition = await tx.payrollRun.updateMany({
        where: {
          id: lockedRun.id,
          companyId: lockedRun.companyId,
          status: 'CALCULATING',
        },
        data: { status: params.sourceStatus },
      })
      if (transition.count !== 1) {
        throw conflict('급여 계산 실패 복구 상태가 변경되었습니다.')
      }
      return true
    },
    { timeout: TERMINAL_TRANSACTION_TIMEOUT_MS },
  )
}

/**
 * Legacy defaults preserve DRAFT | ATTENDANCE_CLOSED -> REVIEW. GP#3 selects
 * ATTENDANCE_CLOSED -> ADJUSTMENT through the explicit mode option.
 */
export async function calculatePayrollRun(
  runId: string,
  options: PayrollCalculationOptions,
): Promise<PayrollCalculationResult> {
  const mode = options.mode
  const policy = CALCULATION_POLICIES[mode]
  const db = options.deps?.db ?? prisma
  const candidate = await db.payrollRun.findFirst({
    where: { id: runId, companyId: options.authorizedCompanyId },
  })
  if (!candidate) throw notFound('급여 실행을 찾을 수 없습니다.')
  await options.deps?.afterCandidateRead?.({
    operation: `${policy.operationPrefix}-start`,
    runId,
  })

  const started = await startCalculation({
    db,
    candidate,
    policy,
    deps: options.deps,
  })

  try {
    const calculationPeriod = resolvePayrollCalculationPeriod(started.run)
    const excludedIds = policy.applyExcludedEmployees
      ? started.run.excludedEmployeeIds
      : []
    const employees = await db.employee.findMany({
      where: {
        id: { notIn: excludedIds },
        hireDate: { lte: calculationPeriod.periodEndDate },
        assignments: {
          some: {
            companyId: started.run.companyId,
            isPrimary: true,
            effectiveDate: { lte: calculationPeriod.periodEndDate },
            OR: [
              { endDate: null },
              { endDate: { gt: calculationPeriod.periodStartDate } },
            ],
          },
        },
      },
      select: { id: true },
    })

    const results = await processInBatches(employees, CONCURRENCY, async (employee) => {
      const detail = await calculatePayrollForEmployee(
        employee.id,
        started.run.companyId,
        calculationPeriod,
      )
      return { employeeId: employee.id, detail }
    })
    const totals = results.reduce(
      (sum, result) => ({
        totalGross: sum.totalGross + result.detail.grossPay,
        totalDeductions: sum.totalDeductions + result.detail.totalDeductions,
        totalNet: sum.totalNet + result.detail.netPay,
      }),
      { totalGross: 0, totalDeductions: 0, totalNet: 0 },
    )
    const previousRunId = policy.resolvePreviousRun
      ? await resolvePreviousRunId(started.run, db)
      : null
    const payrollRun = await commitCalculation({
      db,
      run: started.run,
      results,
      totals,
      previousRunId,
      actorId: options.actorId,
      policy,
      deps: options.deps,
    })

    return {
      payrollRun,
      sourceStatus: started.sourceStatus,
      summary: {
        headcount: employees.length,
        ...totals,
        previousRunId,
      },
    }
  } catch (error) {
    await recoverCalculation({
      db,
      run: started.run,
      sourceStatus: started.sourceStatus,
      actorId: options.actorId,
      policy,
      deps: options.deps,
    })
    throw error
  }
}
