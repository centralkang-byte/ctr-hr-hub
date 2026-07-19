// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LOA Payroll Adjustment Service
// 휴직 급여 조정: 월별 분리, 차감 계산, 소급 정산
// ═══════════════════════════════════════════════════════════

import type { PayrollRun, Prisma } from '@/generated/prisma/client'
import { conflict } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import type { PrismaTx } from '@/lib/prisma-rls'
import { getWeekdaysInMonth, getWeekdaysBetween } from '@/lib/payroll/kr-tax'

const LOA_OBLIGATION_RESOURCE = 'LoaPayrollObligation'
const LOA_OBLIGATION_CREATED = 'LOA_PAYROLL_OBLIGATION_CREATED'
const LOA_OBLIGATION_CONSUMED = 'LOA_PAYROLL_OBLIGATION_CONSUMED'

export type LoaPayrollObligationKind = 'BASE_DEDUCTION' | 'COMPENSATION'

export interface LoaPayrollObligation {
  idempotencyKey: string
  kind: LoaPayrollObligationKind
  companyId: string
  loaId: string
  employeeId: string
  sourceYearMonth: string
  amount: number
  description: string
}

export interface LoaPayrollDeferredWarning {
  kind: LoaPayrollObligationKind
  sourceYearMonth: string
  amount: number
  reason: 'MISSING_MONTHLY_RUN' | 'LOCKED_MONTHLY_RUN'
  idempotencyKey: string
}

// ─── Types ──────────────────────────────────────────────────

export interface LoaRecord {
  id: string
  employeeId: string
  companyId: string
  startDate: Date | string
  expectedEndDate: Date | string | null
  payType: string | null
  payRate: number | null
  type: { payType: string | null; payRate: number | null; name: string }
}

export interface LoaMonthRange {
  yearMonth: string            // "2025-03"
  loaStartInMonth: Date        // max(월1일, LOA시작)
  loaEndInMonth: Date          // min(월말, LOA종료)
  loaDaysInMonth: number       // 해당 월 내 휴직 평일 수
  totalWorkdaysInMonth: number // 해당 월 총 평일 수
}

// ─── 함수 1: 월별 범위 분리 ─────────────────────────────────

/**
 * LOA 기간을 월별로 분리. 각 월에서의 휴직 평일 수 계산.
 */
export function generateLoaMonthlyRanges(startDate: Date, endDate: Date): LoaMonthRange[] {
  const ranges: LoaMonthRange[] = []
  const cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1))
  const endMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1))

  while (cur <= endMonth) {
    const year = cur.getUTCFullYear()
    const month = cur.getUTCMonth() + 1
    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    const monthEnd = new Date(Date.UTC(year, month, 0))

    const loaStartInMonth = startDate > monthStart ? startDate : monthStart
    const loaEndInMonth = endDate < monthEnd ? endDate : monthEnd
    const loaDaysInMonth = getWeekdaysBetween(loaStartInMonth, loaEndInMonth)
    const totalWorkdaysInMonth = getWeekdaysInMonth(year, month)

    const ym = `${year}-${String(month).padStart(2, '0')}`
    ranges.push({ yearMonth: ym, loaStartInMonth, loaEndInMonth, loaDaysInMonth, totalWorkdaysInMonth })
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return ranges
}

// ─── 함수 2: 차감액 계산 ────────────────────────────────────

/**
 * 월급 대비 휴직 차감액 계산. 음수(차감) 반환.
 * PAID → 0, UNPAID/INSURANCE → 전액 차감, PARTIAL/MIXED → 비율 차감
 */
export function calculateLoaDeduction(
  monthlySalary: number,
  loaDays: number,
  totalWorkdays: number,
  payType: string,
  payRate: number | null,
): number {
  if (totalWorkdays === 0) return 0
  const ratio = loaDays / totalWorkdays
  switch (payType) {
    case 'PAID':
      return 0
    case 'UNPAID':
    case 'INSURANCE': // 고용보험 지급 → 회사측 전액 차감
      return -Math.round(monthlySalary * ratio)
    case 'PARTIAL':
    case 'MIXED':
      return -Math.round(monthlySalary * ratio * (1 - (payRate ?? 100) / 100))
    default:
      return 0
  }
}

// ─── 함수 3: 직원 월급 조회 ─────────────────────────────────

/**
 * CompensationHistory에서 asOfDate 기준 최신 연봉 → 월급 환산
 */
export async function getEmployeeMonthlySalary(
  employeeId: string,
  companyId: string,
  asOfDate: Date,
  client: PrismaTx = prisma,
): Promise<number> {
  const comp = await client.compensationHistory.findFirst({
    where: { employeeId, companyId, effectiveDate: { lte: asOfDate } },
    orderBy: { effectiveDate: 'desc' },
    select: { newBaseSalary: true },
  })
  if (!comp) return 0
  return Math.round(Number(comp.newBaseSalary) / 12) // 연봉 → 월급
}

/**
 * Rebuilds PayrollRun adjustment aggregates from the committed child set.
 * Call this in the same transaction as every adjustment mutation.
 */
export async function recomputePayrollAdjustmentAggregates(
  client: PrismaTx,
  payrollRunId: string,
): Promise<void> {
  const aggregate = await client.payrollAdjustment.aggregate({
    where: { payrollRunId },
    _count: { _all: true },
    _sum: { amount: true },
  })

  await client.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      adjustmentCount: aggregate._count._all,
      adjustmentTotal: aggregate._sum.amount ?? 0,
    },
  })
}

function parseLoaPayrollObligation(
  changes: Prisma.JsonValue | null,
): LoaPayrollObligation | null {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null
  const value = changes as Record<string, Prisma.JsonValue>
  if (
    (value.kind !== 'BASE_DEDUCTION' && value.kind !== 'COMPENSATION') ||
    typeof value.idempotencyKey !== 'string' ||
    typeof value.companyId !== 'string' ||
    typeof value.loaId !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.sourceYearMonth !== 'string' ||
    typeof value.amount !== 'number' ||
    typeof value.description !== 'string'
  ) {
    return null
  }
  return {
    idempotencyKey: value.idempotencyKey,
    kind: value.kind,
    companyId: value.companyId,
    loaId: value.loaId,
    employeeId: value.employeeId,
    sourceYearMonth: value.sourceYearMonth,
    amount: value.amount,
    description: value.description,
  }
}

function uniqueObligations(
  obligations: readonly LoaPayrollObligation[],
): LoaPayrollObligation[] {
  const seen = new Set<string>()
  return obligations.filter((obligation) => {
    if (seen.has(obligation.idempotencyKey)) return false
    seen.add(obligation.idempotencyKey)
    return true
  })
}

export async function getUnconsumedDeferredLoaObligationsForLoa(
  client: PrismaTx,
  companyId: string,
  loaId: string,
): Promise<LoaPayrollObligation[]> {
  const createdRows = await client.auditLog.findMany({
    where: {
      companyId,
      action: LOA_OBLIGATION_CREATED,
      resourceType: LOA_OBLIGATION_RESOURCE,
    },
    select: { resourceId: true, changes: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const obligations = uniqueObligations(
    createdRows
      .map((row) => parseLoaPayrollObligation(row.changes))
      .filter(
        (value): value is LoaPayrollObligation =>
          value?.companyId === companyId && value.loaId === loaId,
      ),
  )
  if (obligations.length === 0) return []

  const consumedRows = await client.auditLog.findMany({
    where: {
      companyId,
      action: LOA_OBLIGATION_CONSUMED,
      resourceType: LOA_OBLIGATION_RESOURCE,
      resourceId: { in: obligations.map((value) => value.idempotencyKey) },
    },
    select: { resourceId: true },
  })
  const consumedKeys = new Set(consumedRows.map((row) => row.resourceId))
  return obligations.filter((value) => !consumedKeys.has(value.idempotencyKey))
}

async function resolveDeferredLoaObligation(
  client: PrismaTx,
  obligation: LoaPayrollObligation,
  actorId: string,
  reason: string,
): Promise<void> {
  const existing = await client.auditLog.findFirst({
    where: {
      companyId: obligation.companyId,
      action: LOA_OBLIGATION_CONSUMED,
      resourceType: LOA_OBLIGATION_RESOURCE,
      resourceId: obligation.idempotencyKey,
    },
    select: { id: true },
  })
  if (existing) return

  await client.auditLog.create({
    data: {
      actorId,
      action: LOA_OBLIGATION_CONSUMED,
      resourceType: LOA_OBLIGATION_RESOURCE,
      resourceId: obligation.idempotencyKey,
      companyId: obligation.companyId,
      changes: { version: 1, reason },
      sensitivityLevel: 'HIGH',
    },
  })
}

/**
 * AuditLog-backed durable obligation. Callers hold the company registry lock,
 * which provides exactly-once creation despite AuditLog lacking a unique key.
 */
export async function persistDeferredLoaObligation(
  client: PrismaTx,
  obligation: LoaPayrollObligation,
  actorId: string,
): Promise<boolean> {
  const existing = await client.auditLog.findFirst({
    where: {
      companyId: obligation.companyId,
      action: LOA_OBLIGATION_CREATED,
      resourceType: LOA_OBLIGATION_RESOURCE,
      resourceId: obligation.idempotencyKey,
    },
    select: { id: true },
  })
  if (existing) return false

  await client.auditLog.create({
    data: {
      actorId,
      action: LOA_OBLIGATION_CREATED,
      resourceType: LOA_OBLIGATION_RESOURCE,
      resourceId: obligation.idempotencyKey,
      companyId: obligation.companyId,
      changes: { version: 1, ...obligation },
      sensitivityLevel: 'HIGH',
    },
  })
  return true
}

/**
 * Consumes obligations eligible for a MONTHLY run. The caller must hold the
 * registry lock, target period lock, and PayrollRun row lock (or be creating
 * the run in that same locked transaction).
 */
export async function consumeDeferredLoaObligationsForRun(
  client: PrismaTx,
  params: {
    run: Pick<
      PayrollRun,
      'id' | 'companyId' | 'yearMonth' | 'runType' | 'status' | 'attendanceClosedAt'
    >
    actorId: string
    projectedStatus?: 'DRAFT' | 'ADJUSTMENT'
    projectedAttendanceClosedAt?: Date | null
  },
): Promise<number> {
  if (params.run.runType !== 'MONTHLY') return 0
  const targetStatus = params.projectedStatus ?? params.run.status
  const targetAttendanceClosedAt =
    params.projectedAttendanceClosedAt === undefined
      ? params.run.attendanceClosedAt
      : params.projectedAttendanceClosedAt
  if (
    targetStatus !== 'ADJUSTMENT' &&
    !(targetStatus === 'DRAFT' && targetAttendanceClosedAt === null)
  ) {
    return 0
  }

  const createdRows = await client.auditLog.findMany({
    where: {
      companyId: params.run.companyId,
      action: LOA_OBLIGATION_CREATED,
      resourceType: LOA_OBLIGATION_RESOURCE,
    },
    select: { resourceId: true, changes: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const obligations = uniqueObligations(
    createdRows
      .map((row) => parseLoaPayrollObligation(row.changes))
      .filter(
        (value): value is LoaPayrollObligation =>
          value?.companyId === params.run.companyId,
      )
      .filter((value) =>
        value.kind === 'BASE_DEDUCTION'
          ? value.sourceYearMonth === params.run.yearMonth
          : value.sourceYearMonth < params.run.yearMonth,
      ),
  )
  if (obligations.length === 0) return 0

  const consumedRows = await client.auditLog.findMany({
    where: {
      companyId: params.run.companyId,
      action: LOA_OBLIGATION_CONSUMED,
      resourceType: LOA_OBLIGATION_RESOURCE,
      resourceId: { in: obligations.map((value) => value.idempotencyKey) },
    },
    select: { resourceId: true },
  })
  const consumedKeys = new Set(consumedRows.map((row) => row.resourceId))

  let consumedCount = 0
  for (const obligation of obligations) {
    if (consumedKeys.has(obligation.idempotencyKey)) continue

    const obligationTag = `[LOA obligation:${obligation.idempotencyKey}]`
    const existing = await client.payrollAdjustment.findFirst({
      where:
        obligation.kind === 'BASE_DEDUCTION'
          ? {
              payrollRunId: params.run.id,
              loaId: obligation.loaId,
              loaYearMonth: obligation.sourceYearMonth,
            }
          : {
              payrollRunId: params.run.id,
              description: { contains: obligationTag },
            },
      select: { id: true },
    })
    if (!existing) {
      await client.payrollAdjustment.create({
        data: {
          payrollRunId: params.run.id,
          employeeId: obligation.employeeId,
          type: obligation.kind === 'COMPENSATION' ? 'CORRECTION' : 'DEDUCTION',
          category: 'LOA_PAY_ADJUSTMENT',
          description: `${obligation.description} ${obligationTag}`,
          amount: obligation.amount,
          loaId: obligation.loaId,
          loaYearMonth: obligation.sourceYearMonth,
          createdById: params.actorId,
        },
      })
    }
    await client.auditLog.create({
      data: {
        actorId: params.actorId,
        action: LOA_OBLIGATION_CONSUMED,
        resourceType: LOA_OBLIGATION_RESOURCE,
        resourceId: obligation.idempotencyKey,
        companyId: params.run.companyId,
        changes: {
          version: 1,
          payrollRunId: params.run.id,
          targetYearMonth: params.run.yearMonth,
        },
        sensitivityLevel: 'HIGH',
      },
    })
    consumedKeys.add(obligation.idempotencyKey)
    consumedCount++
  }

  if (consumedCount > 0) {
    await recomputePayrollAdjustmentAggregates(client, params.run.id)
  }
  return consumedCount
}

// ─── Locked LOA payroll reconciliation ───────────────────────

export function isEditableLoaPayrollRun(
  run: Pick<PayrollRun, 'runType' | 'status' | 'attendanceClosedAt'>,
): boolean {
  return (
    run.runType === 'MONTHLY' &&
    (run.status === 'ADJUSTMENT' ||
      (run.status === 'DRAFT' && run.attendanceClosedAt === null))
  )
}

export async function buildLoaDesiredAmounts(
  client: PrismaTx,
  record: LoaRecord,
  endDate: Date,
): Promise<Map<string, number>> {
  const startDate = new Date(record.startDate)
  const monthlySalary = await getEmployeeMonthlySalary(
    record.employeeId,
    record.companyId,
    startDate,
    client,
  )
  const payType = record.payType ?? record.type.payType ?? 'UNPAID'
  const payRate = record.payRate ?? record.type.payRate
  return new Map(
    generateLoaMonthlyRanges(startDate, endDate).map((range) => [
      range.yearMonth,
      calculateLoaDeduction(
        monthlySalary,
        range.loaDaysInMonth,
        range.totalWorkdaysInMonth,
        payType,
        payRate,
      ),
    ]),
  )
}

function obligationKey(params: {
  record: LoaRecord
  kind: LoaPayrollObligationKind
  sourceYearMonth: string
  reconciliationKey: string
  amount: number
}): string {
  const normalizedKey = params.reconciliationKey.replace(/[^a-zA-Z0-9:_-]/g, '-')
  return [
    'loa',
    params.record.id,
    params.kind.toLowerCase(),
    params.sourceYearMonth,
    normalizedKey,
    String(params.amount),
  ].join(':')
}

function settlementDescription(params: {
  record: LoaRecord
  sourceYearMonth: string
  kind: LoaPayrollObligationKind
  reconciliationKey: string
}): string {
  const label = params.kind === 'BASE_DEDUCTION' ? '휴직 급여 조정' : '휴직 소급 정산'
  return `[${label}] ${params.record.type.name} — ${params.sourceYearMonth} (${params.reconciliationKey})`
}

/**
 * The caller must hold registry -> sorted period -> LOA row -> PayrollRun row
 * locks. Immutable runs remain untouched; their delta moves to the earliest
 * later editable MONTHLY run or becomes a durable deferred obligation.
 */
export async function reconcileLockedLoaPayroll(
  client: PrismaTx,
  params: {
    record: LoaRecord
    actorId: string
    sourceYearMonths: readonly string[]
    desiredAmounts: ReadonlyMap<string, number>
    lockedRuns: readonly PayrollRun[]
    reconciliationKey: string
    createZeroBaseRows?: boolean
  },
): Promise<LoaPayrollDeferredWarning[]> {
  const lockedRunById = new Map(params.lockedRuns.map((run) => [run.id, run]))
  const sourceRunByMonth = new Map(
    params.lockedRuns
      .filter((run) => run.runType === 'MONTHLY')
      .map((run) => [run.yearMonth, run]),
  )
  const existingAdjustments = await client.payrollAdjustment.findMany({
    where: { loaId: params.record.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  for (const adjustment of existingAdjustments) {
    if (!lockedRunById.has(adjustment.payrollRunId)) {
      throw conflict('휴직 급여 실행 잠금 범위가 변경되었습니다.')
    }
  }

  const obligations = await getUnconsumedDeferredLoaObligationsForLoa(
    client,
    params.record.companyId,
    params.record.id,
  )
  const warnings: LoaPayrollDeferredWarning[] = []
  const touchedRunIds = new Set<string>()
  const sourceMonths = [...new Set([
    ...params.sourceYearMonths,
    ...params.desiredAmounts.keys(),
    ...existingAdjustments.flatMap((value) =>
      value.loaYearMonth ? [value.loaYearMonth] : [],
    ),
    ...obligations.map((value) => value.sourceYearMonth),
  ])].sort()

  for (const sourceYearMonth of sourceMonths) {
    const desiredAmount = params.desiredAmounts.get(sourceYearMonth) ?? 0
    const sourceRun = sourceRunByMonth.get(sourceYearMonth)
    const sourceAdjustments = existingAdjustments.filter(
      (value) => value.loaYearMonth === sourceYearMonth,
    )
    const mutableAdjustments = sourceAdjustments.filter((value) => {
      const run = lockedRunById.get(value.payrollRunId)
      return run ? isEditableLoaPayrollRun(run) : false
    })
    const mutableIds = new Set(mutableAdjustments.map((value) => value.id))
    const fixedAmount = sourceAdjustments
      .filter((value) => !mutableIds.has(value.id))
      .reduce((sum, value) => sum + Number(value.amount), 0)

    for (const obligation of obligations.filter(
      (value) => value.sourceYearMonth === sourceYearMonth,
    )) {
      await resolveDeferredLoaObligation(
        client,
        obligation,
        params.actorId,
        `superseded:${params.reconciliationKey}`,
      )
    }

    const remainingAmount = desiredAmount - fixedAmount
    const editableSourceRun =
      sourceRun && isEditableLoaPayrollRun(sourceRun) ? sourceRun : null
    const laterEditableRun = params.lockedRuns
      .filter(
        (run) =>
          run.runType === 'MONTHLY' &&
          run.yearMonth > sourceYearMonth &&
          isEditableLoaPayrollRun(run),
      )
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))[0]
    const targetRun = editableSourceRun ?? (sourceRun ? laterEditableRun : null)
    const preferredAdjustment = targetRun
      ? mutableAdjustments.find((value) => value.payrollRunId === targetRun.id) ?? null
      : null

    for (const adjustment of mutableAdjustments) {
      const isPreferred = preferredAdjustment?.id === adjustment.id
      const nextAmount = isPreferred ? remainingAmount : 0
      const targetIsSource =
        lockedRunById.get(adjustment.payrollRunId)?.yearMonth === sourceYearMonth
      await client.payrollAdjustment.update({
        where: { id: adjustment.id },
        data: {
          amount: nextAmount,
          type: targetIsSource ? 'DEDUCTION' : 'CORRECTION',
          description: settlementDescription({
            record: params.record,
            sourceYearMonth,
            kind: targetIsSource ? 'BASE_DEDUCTION' : 'COMPENSATION',
            reconciliationKey: params.reconciliationKey,
          }),
        },
      })
      touchedRunIds.add(adjustment.payrollRunId)
    }

    if (
      targetRun &&
      !preferredAdjustment &&
      (remainingAmount !== 0 ||
        (params.createZeroBaseRows && targetRun.yearMonth === sourceYearMonth))
    ) {
      const targetIsSource = targetRun.yearMonth === sourceYearMonth
      await client.payrollAdjustment.create({
        data: {
          payrollRunId: targetRun.id,
          employeeId: params.record.employeeId,
          type: targetIsSource ? 'DEDUCTION' : 'CORRECTION',
          category: 'LOA_PAY_ADJUSTMENT',
          description: settlementDescription({
            record: params.record,
            sourceYearMonth,
            kind: targetIsSource ? 'BASE_DEDUCTION' : 'COMPENSATION',
            reconciliationKey: params.reconciliationKey,
          }),
          amount: remainingAmount,
          loaId: params.record.id,
          loaYearMonth: sourceYearMonth,
          createdById: params.actorId,
        },
      })
      touchedRunIds.add(targetRun.id)
    }

    if (!targetRun && remainingAmount !== 0) {
      const kind: LoaPayrollObligationKind = sourceRun
        ? 'COMPENSATION'
        : 'BASE_DEDUCTION'
      const idempotencyKey = obligationKey({
        record: params.record,
        kind,
        sourceYearMonth,
        reconciliationKey: params.reconciliationKey,
        amount: remainingAmount,
      })
      const description = settlementDescription({
        record: params.record,
        sourceYearMonth,
        kind,
        reconciliationKey: params.reconciliationKey,
      })
      await persistDeferredLoaObligation(
        client,
        {
          idempotencyKey,
          kind,
          companyId: params.record.companyId,
          loaId: params.record.id,
          employeeId: params.record.employeeId,
          sourceYearMonth,
          amount: remainingAmount,
          description,
        },
        params.actorId,
      )
      warnings.push({
        kind,
        sourceYearMonth,
        amount: remainingAmount,
        reason: sourceRun ? 'LOCKED_MONTHLY_RUN' : 'MISSING_MONTHLY_RUN',
        idempotencyKey,
      })
    }
  }

  for (const runId of touchedRunIds) {
    await recomputePayrollAdjustmentAggregates(client, runId)
  }
  return warnings
}

// ─── Helper: 새 PayrollRun에 LOA 조정 자동 주입 ─────────────

/**
 * HR이 새 PayrollRun 생성 시 호출. 해당 yearMonth에 ACTIVE LOA가
 * 있으면 자동으로 PayrollAdjustment를 생성.
 */
export async function injectLoaAdjustmentsForNewRun(
  runId: string,
  companyId: string,
  yearMonth: string,
  actorId: string,
  client: PrismaTx,
): Promise<number> {
  const [y, m] = yearMonth.split('-').map(Number)
  const monthStart = new Date(Date.UTC(y, m - 1, 1))
  const monthEnd = new Date(Date.UTC(y, m, 0))

  const run = await client.payrollRun.findFirst({
    where: {
      id: runId,
      companyId,
      yearMonth,
      runType: 'MONTHLY',
      status: 'DRAFT',
      attendanceClosedAt: null,
    },
    select: { id: true },
  })
  if (!run) {
    throw conflict('휴직 급여 조정은 편집 가능한 월 정기 급여 실행에서만 생성할 수 있습니다.')
  }

  const activeLoas = await client.leaveOfAbsence.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { in: ['ACTIVE', 'RETURN_REQUESTED'] },
      startDate: { lte: monthEnd },
      OR: [
        { expectedEndDate: null },
        { expectedEndDate: { gte: monthStart } },
      ],
    },
    include: { type: { select: { name: true, payType: true, payRate: true } } },
  })

  // Issue #6: N+1 쿼리 제거 — LOA ID 목록으로 한 번에 조회
  const loaIds = activeLoas.map(l => l.id)
  const existingAdjs = await client.payrollAdjustment.findMany({
    where: {
      payrollRunId: runId,
      loaId: { in: loaIds },
      loaYearMonth: yearMonth,
    },
    select: { loaId: true },
  })
  const existingLoaIds = new Set(existingAdjs.map(a => a.loaId))

  let injectedCount = 0
  for (const loa of activeLoas) {
    // 이미 해당 월에 조정이 있으면 skip (O(1) Set 체크)
    if (existingLoaIds.has(loa.id)) continue

    const endDate = loa.expectedEndDate ? new Date(loa.expectedEndDate) : monthEnd
    const ranges = generateLoaMonthlyRanges(new Date(loa.startDate), endDate)
    const range = ranges.find(r => r.yearMonth === yearMonth)
    if (!range) continue

    const monthlySalary = await getEmployeeMonthlySalary(
      loa.employeeId,
      companyId,
      new Date(loa.startDate),
      client,
    )
    const payType = loa.payType ?? loa.type.payType ?? 'UNPAID'
    const payRate = loa.payRate ?? loa.type.payRate
    const amount = calculateLoaDeduction(
      monthlySalary, range.loaDaysInMonth, range.totalWorkdaysInMonth, payType, payRate,
    )

    await client.payrollAdjustment.create({
      data: {
        payrollRunId: runId,
        employeeId: loa.employeeId,
        type: 'DEDUCTION',
        category: 'LOA_PAY_ADJUSTMENT',
        description: `[휴직 급여 조정] ${loa.type.name} (${payType}) — ${yearMonth} 휴직 ${range.loaDaysInMonth}/${range.totalWorkdaysInMonth}일 [자동 주입]`,
        amount,
        loaId: loa.id,
        loaYearMonth: yearMonth,
        createdById: actorId,
      },
    })
    injectedCount++
  }
  await recomputePayrollAdjustmentAggregates(client, runId)
  return injectedCount
}
