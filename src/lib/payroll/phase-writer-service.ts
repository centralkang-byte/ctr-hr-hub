import 'server-only'

import type { PayrollRun, PayrollStatus, Prisma } from '@/generated/prisma/client'
import {
  acquireExclusivePeriodLock,
  lockPayrollRunForUpdate,
  type PeriodLockHooks,
} from '@/lib/attendance/period-lock'
import { badRequest, conflict, notFound } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { PrismaTx } from '@/lib/prisma-rls'

const PHASE_WRITER_TIMEOUT_MS = 60_000

export type PayrollRunCandidate = Pick<
  PayrollRun,
  'id' | 'companyId' | 'yearMonth'
>

export interface PayrollPhaseWriterDeps extends PeriodLockHooks {
  db?: typeof prisma
}

export async function withLockedPayrollRunPhase<T>(params: {
  candidate: PayrollRunCandidate
  expectedStatus: PayrollStatus
  operation: string
  statusError: string | ((status: PayrollStatus) => string)
  deps?: PayrollPhaseWriterDeps
  mutate: (tx: PrismaTx, run: PayrollRun) => Promise<T>
}): Promise<T> {
  const db = params.deps?.db ?? prisma
  return db.$transaction(
    async (tx) => {
      await acquireExclusivePeriodLock(tx, {
        companyId: params.candidate.companyId,
        yearMonth: params.candidate.yearMonth,
        operation: params.operation,
        deps: params.deps,
      })
      const run = await lockPayrollRunForUpdate(tx, {
        companyId: params.candidate.companyId,
        runId: params.candidate.id,
        operation: params.operation,
        deps: params.deps,
      })
      if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
      if (run.status !== params.expectedStatus) {
        const message =
          typeof params.statusError === 'function'
            ? params.statusError(run.status)
            : params.statusError
        throw badRequest(message)
      }
      return params.mutate(tx, run)
    },
    { timeout: PHASE_WRITER_TIMEOUT_MS },
  )
}

/**
 * Every child writer finishes with an exact source-state CAS. A zero-count CAS
 * rolls the preceding child and audit writes back with the transaction.
 */
export async function updatePayrollRunInPhase(
  tx: PrismaTx,
  run: Pick<PayrollRun, 'id' | 'companyId'>,
  expectedStatus: PayrollStatus,
  data: Prisma.PayrollRunUpdateManyMutationInput,
): Promise<void> {
  const transition = await tx.payrollRun.updateMany({
    where: {
      id: run.id,
      companyId: run.companyId,
      status: expectedStatus,
    },
    data,
  })
  if (transition.count !== 1) {
    throw conflict('급여 실행 상태가 변경되었습니다.')
  }
}

export async function readAdjustmentAggregate(
  tx: PrismaTx,
  runId: string,
): Promise<{ adjustmentCount: number; adjustmentTotal: number }> {
  const adjustments = await tx.payrollAdjustment.findMany({
    where: { payrollRunId: runId },
    select: { amount: true },
  })
  return {
    adjustmentCount: adjustments.length,
    adjustmentTotal: adjustments.reduce(
      (total, adjustment) => total + Number(adjustment.amount),
      0,
    ),
  }
}

export async function readPayrollItemAggregate(
  tx: PrismaTx,
  runId: string,
): Promise<{
  totalGross: number
  totalDeductions: number
  totalNet: number
}> {
  const items = await tx.payrollItem.findMany({
    where: { runId },
    select: { grossPay: true, deductions: true, netPay: true },
  })
  return items.reduce(
    (total, item) => ({
      totalGross: total.totalGross + Number(item.grossPay),
      totalDeductions: total.totalDeductions + Number(item.deductions),
      totalNet: total.totalNet + Number(item.netPay),
    }),
    { totalGross: 0, totalDeductions: 0, totalNet: 0 },
  )
}

export async function readAnomalyAggregate(
  tx: PrismaTx,
  runId: string,
): Promise<{ anomalyCount: number; allAnomaliesResolved: boolean }> {
  const [anomalyCount, openCount] = await Promise.all([
    tx.payrollAnomaly.count({ where: { payrollRunId: runId } }),
    tx.payrollAnomaly.count({
      where: { payrollRunId: runId, status: 'OPEN' },
    }),
  ])
  return { anomalyCount, allAnomaliesResolved: openCount === 0 }
}
