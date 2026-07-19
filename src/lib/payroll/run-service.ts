// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PayrollRun Creation Boundary
// Registry lock -> period lock -> run create -> initial children.
// ═══════════════════════════════════════════════════════════

import 'server-only'

import type { PayrollRun, PayrollRunType, Prisma } from '@/generated/prisma/client'
import {
  acquireExclusivePeriodLock,
  acquirePayrollRunRegistryLock,
  type PeriodLockHooks,
} from '@/lib/attendance/period-lock'
import { badRequest, conflict } from '@/lib/errors'
import {
  consumeDeferredLoaObligationsForRun,
  injectLoaAdjustmentsForNewRun,
} from '@/lib/loa/payroll-adjustment'
import { prisma } from '@/lib/prisma'
import type { PrismaTx } from '@/lib/prisma-rls'

const PAYROLL_RUN_CREATION_TIMEOUT_MS = 60_000

export interface PayrollRunCreationInput {
  companyId: string
  actorId: string
  name: string
  runType: PayrollRunType
  yearMonth: string
  periodStart: Date
  periodEnd: Date
  payDate?: Date | null
  currency?: string
  year?: number | null
  month?: number | null
  excludedEmployeeIds?: string[]
}

interface PayrollRunCreationAudit {
  action: string
  changes: Prisma.InputJsonValue
  ip?: string
  userAgent?: string
}

export interface PayrollRunCreationDeps extends PeriodLockHooks {
  db?: typeof prisma
}

export function assertPayrollRunPeriodMatchesYearMonth(
  input: Pick<PayrollRunCreationInput, 'runType' | 'yearMonth' | 'periodStart' | 'periodEnd'>,
): void {
  if (
    Number.isNaN(input.periodStart.getTime()) ||
    Number.isNaN(input.periodEnd.getTime()) ||
    input.periodStart > input.periodEnd
  ) {
    throw badRequest('급여 계산 기간이 올바르지 않습니다.')
  }
  if (input.runType !== 'MONTHLY') return

  const startYearMonth = input.periodStart.toISOString().slice(0, 7)
  const endYearMonth = input.periodEnd.toISOString().slice(0, 7)
  if (startYearMonth !== input.yearMonth || endYearMonth !== input.yearMonth) {
    throw badRequest('MONTHLY 급여 실행의 계산 기간은 yearMonth 안에 있어야 합니다.')
  }
}

/**
 * The caller must already hold this company's registry lock followed by the
 * target period's exclusive lock in the current transaction.
 */
export async function createPayrollRunWithInitialLoaChildrenLocked(
  tx: PrismaTx,
  input: PayrollRunCreationInput,
): Promise<PayrollRun> {
  assertPayrollRunPeriodMatchesYearMonth(input)

  const existing = await tx.payrollRun.findUnique({
    where: {
      companyId_yearMonth_runType: {
        companyId: input.companyId,
        yearMonth: input.yearMonth,
        runType: input.runType,
      },
    },
    select: { id: true },
  })
  if (existing) {
    throw conflict(`이미 ${input.yearMonth} 급여 실행이 존재합니다. 기존 실행을 사용하세요.`)
  }

  const run = await tx.payrollRun.create({
    data: {
      companyId: input.companyId,
      createdById: input.actorId,
      name: input.name,
      runType: input.runType,
      yearMonth: input.yearMonth,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payDate: input.payDate ?? null,
      currency: input.currency ?? 'KRW',
      year: input.year ?? null,
      month: input.month ?? null,
      status: 'DRAFT',
      excludedEmployeeIds: input.excludedEmployeeIds ?? [],
    },
  })

  if (run.runType === 'MONTHLY') {
    await injectLoaAdjustmentsForNewRun(
      run.id,
      run.companyId,
      run.yearMonth,
      input.actorId,
      tx,
    )
    await consumeDeferredLoaObligationsForRun(tx, {
      run,
      actorId: input.actorId,
    })
  }

  return tx.payrollRun.findUniqueOrThrow({ where: { id: run.id } })
}

export async function createPayrollRunWithInitialLoaChildren(params: {
  input: PayrollRunCreationInput
  audit?: PayrollRunCreationAudit
  deps?: PayrollRunCreationDeps
}): Promise<PayrollRun> {
  const { input } = params
  const db = params.deps?.db ?? prisma

  return db.$transaction(async (tx) => {
    await acquirePayrollRunRegistryLock(tx, {
      companyId: input.companyId,
      operation: 'payroll-run-create',
      deps: params.deps,
    })
    await acquireExclusivePeriodLock(tx, {
      companyId: input.companyId,
      yearMonth: input.yearMonth,
      operation: 'payroll-run-create',
      deps: params.deps,
    })

    const run = await createPayrollRunWithInitialLoaChildrenLocked(tx, input)

    if (params.audit) {
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: params.audit.action,
          resourceType: 'PayrollRun',
          resourceId: run.id,
          companyId: input.companyId,
          changes: params.audit.changes,
          ipAddress: params.audit.ip ?? null,
          userAgent: params.audit.userAgent ?? null,
        },
      })
    }

    return run
  }, { timeout: PAYROLL_RUN_CREATION_TIMEOUT_MS })
}
