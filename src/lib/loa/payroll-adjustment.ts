// ═══════════════════════════════════════════════════════════
// CTR HR Hub — LOA Payroll Adjustment Service
// 휴직 급여 조정: 월별 분리, 차감 계산, 소급 정산
// ═══════════════════════════════════════════════════════════

import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import type { PrismaTx } from '@/lib/prisma-rls'
import { getWeekdaysInMonth, getWeekdaysBetween } from '@/lib/payroll/kr-tax'

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
export async function getEmployeeMonthlySalary(employeeId: string, asOfDate: Date): Promise<number> {
  const comp = await prisma.compensationHistory.findFirst({
    where: { employeeId, effectiveDate: { lte: asOfDate } },
    orderBy: { effectiveDate: 'desc' },
    select: { newBaseSalary: true },
  })
  if (!comp) return 0
  return Math.round(Number(comp.newBaseSalary) / 12) // 연봉 → 월급
}

// ─── 공통 헬퍼: 월별 adjustment 생성 ─────────────────────────

/**
 * 단일 월 범위에 대해 PayrollAdjustment 생성 (Issue #3: 코드 중복 제거).
 * createCrossMonthLoaAdjustments / reconcileLoaAdjustments 양쪽에서 재사용.
 *
 * Phase 6A: PrismaLike union (Prisma.TransactionClient | typeof prisma) caused
 * "Excessive stack depth" errors once the top-level client was extended via
 * $extends. PrismaTx (Omit<typeof prisma, $connect|$disconnect|$on|$transaction|$use|$extends>)
 * covers both call paths without the problematic union.
 */
interface AdjustmentRangeOpts {
  companyId: string
  employeeId: string
  loaId: string
  loaTypeName: string
  yearMonth: string
  monthlySalary: number
  loaDays: number
  totalWorkdays: number
  payType: string
  payRate: number | null
  userId: string
  descSuffix?: string
}

async function createAdjustmentForRange(
  client: PrismaTx,
  opts: AdjustmentRangeOpts,
): Promise<boolean> {
  const payrollRun = await client.payrollRun.findFirst({
    where: {
      companyId: opts.companyId,
      yearMonth: opts.yearMonth,
      status: { notIn: ['PAID', 'CANCELLED'] },
    },
  })
  if (!payrollRun) return false

  // Issue #4: idempotent 체크 — 이미 해당 월에 adjustment가 존재하면 skip
  const existing = await client.payrollAdjustment.findFirst({
    where: { loaId: opts.loaId, loaYearMonth: opts.yearMonth },
  })
  if (existing) {
    console.warn(`[LOA] idempotent skip: loaId=${opts.loaId}, yearMonth=${opts.yearMonth} — adjustment already exists`)
    return false
  }

  const amount = calculateLoaDeduction(
    opts.monthlySalary, opts.loaDays, opts.totalWorkdays, opts.payType, opts.payRate,
  )

  const suffix = opts.descSuffix ? ` [${opts.descSuffix}]` : ''
  await client.payrollAdjustment.create({
    data: {
      payrollRunId: payrollRun.id,
      employeeId: opts.employeeId,
      type: 'DEDUCTION',
      category: 'LOA_PAY_ADJUSTMENT',
      description: `[휴직 급여 조정] ${opts.loaTypeName} (${opts.payType}${opts.payRate ? `, ${opts.payRate}%` : ''}) — ${opts.yearMonth} 휴직 ${opts.loaDays}/${opts.totalWorkdays}일${suffix}`,
      amount,
      loaId: opts.loaId,
      loaYearMonth: opts.yearMonth,
      createdById: opts.userId,
    },
  })
  await client.payrollRun.update({
    where: { id: payrollRun.id },
    data: { adjustmentCount: { increment: 1 } },
  })
  return true
}

// ─── 함수 4: 월별 LOA 급여 조정 생성 ────────────────────────

/**
 * LOA 활성화 시 월별 PayrollAdjustment 생성.
 * - expectedEndDate null → 단일 플레이스홀더 (amount=0, Phase 2 호환)
 * - expectedEndDate 있음 → 월별 범위별 차감액 계산 후 생성
 */
export async function createCrossMonthLoaAdjustments(
  record: LoaRecord,
  userId: string,
): Promise<void> {
  const startDate = new Date(record.startDate)
  const payType = record.payType ?? record.type.payType ?? 'UNPAID'
  const payRate = record.payRate ?? record.type.payRate

  // expectedEndDate 없으면 단일 플레이스홀더 (Phase 2 backward compat)
  if (!record.expectedEndDate) {
    await createSingleMonthPlaceholder(record, startDate, payType, payRate, userId)
    return
  }

  const endDate = new Date(record.expectedEndDate)
  const ranges = generateLoaMonthlyRanges(startDate, endDate)
  const monthlySalary = await getEmployeeMonthlySalary(record.employeeId, startDate)

  for (const range of ranges) {
    await createAdjustmentForRange(prisma, {
      companyId: record.companyId,
      employeeId: record.employeeId,
      loaId: record.id,
      loaTypeName: record.type.name,
      yearMonth: range.yearMonth,
      monthlySalary,
      loaDays: range.loaDaysInMonth,
      totalWorkdays: range.totalWorkdaysInMonth,
      payType,
      payRate,
      userId,
    })
  }
}

/**
 * Phase 2 호환 플레이스홀더: amount=0, loaId/loaYearMonth 포함
 */
async function createSingleMonthPlaceholder(
  record: LoaRecord,
  startDate: Date,
  payType: string,
  payRate: number | null,
  userId: string,
): Promise<void> {
  const yearMonth = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}`

  const payrollRun = await prisma.payrollRun.findFirst({
    where: {
      companyId: record.companyId,
      yearMonth,
      status: { notIn: ['PAID', 'CANCELLED'] },
    },
  })
  if (!payrollRun) return

  // Issue #1: toLocaleDateString 타임존 의존 제거 → ISO 날짜 문자열 사용
  const startStr = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}-${String(startDate.getUTCDate()).padStart(2, '0')}`
  const endStr = '미정'

  await prisma.$transaction([
    prisma.payrollAdjustment.create({
      data: {
        payrollRunId: payrollRun.id,
        employeeId: record.employeeId,
        type: 'DEDUCTION',
        category: 'LOA_PAY_ADJUSTMENT',
        description: `[휴직 급여 조정] ${record.type.name} (${payType}${payRate ? `, ${payRate}%` : ''}) — 휴직 기간: ${startStr} ~ ${endStr} — 이후 급여 차감/일할 계산 필수`,
        amount: 0,
        loaId: record.id,
        loaYearMonth: yearMonth,
        createdById: userId,
      },
    }),
    prisma.payrollRun.update({
      where: { id: payrollRun.id },
      data: { adjustmentCount: { increment: 1 } },
    }),
  ])
}

// ─── 내부 타입: PayrollAdjustment + PayrollRun join ──────────

type AdjWithRun = Prisma.PayrollAdjustmentGetPayload<{
  include: { payrollRun: { select: { companyId: true; yearMonth: true; status: true } } }
}>

// ─── 함수 5: 복직 시 소급 정산 ──────────────────────────────

/**
 * 복직(handleComplete) 시 호출. Prisma 트랜잭션 내에서 실행.
 *
 * - expectedEndDate 없었음 → 전체 기간 조정 새로 생성
 * - Case A (같은 날짜) → 변경 없음
 * - Case B (조기 복직) → 초과 월 취소/환불
 * - Case C (연장) → 추가 월 조정 생성
 * - 마지막 월 일수 변경 → 금액 재계산
 */
export async function reconcileLoaAdjustments(
  tx: PrismaTx,
  record: LoaRecord,
  actualEndDate: Date,
  userId: string,
): Promise<void> {
  const startDate = new Date(record.startDate)
  const payType = record.payType ?? record.type.payType ?? 'UNPAID'
  const payRate = record.payRate ?? record.type.payRate
  const monthlySalary = await getEmployeeMonthlySalary(record.employeeId, startDate)

  const actualRanges = generateLoaMonthlyRanges(startDate, actualEndDate)
  const actualYearMonths = new Set(actualRanges.map(r => r.yearMonth))

  // expectedEndDate 없었으면: 기존 조정 전부 조회 후 실제 기간에 맞게 생성
  if (!record.expectedEndDate) {
    // 기존 플레이스홀더(amount=0) 삭제 또는 업데이트
    const existing = await tx.payrollAdjustment.findMany({
      where: { loaId: record.id },
      include: { payrollRun: { select: { companyId: true, yearMonth: true, status: true } } },
    })

    // Issue #5: guard clause로 반전 — 빈 if 블록 제거
    // 기존 플레이스홀더 취소 (PAID 런이면 amount=0이므로 보정 불필요, 아니면 삭제)
    for (const adj of existing) {
      if (adj.payrollRun.status !== 'PAID') {
        await tx.payrollAdjustment.delete({ where: { id: adj.id } })
        await tx.payrollRun.update({
          where: { id: adj.payrollRunId },
          data: { adjustmentCount: { decrement: 1 } },
        })
      }
    }

    // Issue #3: 공통 헬퍼로 실제 기간에 맞게 새 조정 생성
    for (const range of actualRanges) {
      await createAdjustmentForRange(tx, {
        companyId: record.companyId,
        employeeId: record.employeeId,
        loaId: record.id,
        loaTypeName: record.type.name,
        yearMonth: range.yearMonth,
        monthlySalary,
        loaDays: range.loaDaysInMonth,
        totalWorkdays: range.totalWorkdaysInMonth,
        payType,
        payRate,
        userId,
        descSuffix: '복직 정산',
      })
    }
    return
  }

  // expectedEndDate가 있는 경우
  const expectedEndDate = new Date(record.expectedEndDate)
  const expectedRanges = generateLoaMonthlyRanges(startDate, expectedEndDate)
  const expectedYearMonths = new Set(expectedRanges.map(r => r.yearMonth))

  // 기존 조정 전체 조회
  const existingAdjs = await tx.payrollAdjustment.findMany({
    where: { loaId: record.id },
    include: { payrollRun: { select: { companyId: true, yearMonth: true, status: true } } },
  })
  // Issue #2: 중복 키 방어 — 같은 loaYearMonth가 2개 이상이면 경고 로깅
  const adjByYearMonth = new Map<string | null, typeof existingAdjs[number]>()
  for (const a of existingAdjs) {
    if (adjByYearMonth.has(a.loaYearMonth)) {
      console.warn(`[LOA] 중복 loaYearMonth 감지: loaId=${record.id}, yearMonth=${a.loaYearMonth}, adjId=${a.id} (기존 adjId=${adjByYearMonth.get(a.loaYearMonth)?.id})`)
    }
    adjByYearMonth.set(a.loaYearMonth, a)
  }

  // Case A: 같은 날짜 → 변경 없음
  if (actualEndDate.getTime() === expectedEndDate.getTime()) return

  // Case B: 조기 복직 — 실제 기간에 포함되지 않는 월 취소
  for (const adj of existingAdjs) {
    if (!adj.loaYearMonth) continue
    if (actualYearMonths.has(adj.loaYearMonth)) continue

    // 이 월은 더 이상 휴직 기간이 아님 → 취소
    if (adj.payrollRun.status === 'PAID') {
      // PAID 런 → 다음 런에 환불 보정
      await createCorrectionInNextRun(tx, adj as AdjWithRun, record, userId)
    } else {
      // Open 런 → amount=0 + 취소 노트
      await tx.payrollAdjustment.update({
        where: { id: adj.id },
        data: {
          amount: 0,
          description: `[조기복직 정산 — 취소] 원래: ${adj.description}`,
        },
      })
    }
  }

  // Case C: 연장 — 추가 월에 대한 조정 생성 (Issue #3: 공통 헬퍼 사용)
  for (const range of actualRanges) {
    if (expectedYearMonths.has(range.yearMonth)) continue

    await createAdjustmentForRange(tx, {
      companyId: record.companyId,
      employeeId: record.employeeId,
      loaId: record.id,
      loaTypeName: record.type.name,
      yearMonth: range.yearMonth,
      monthlySalary,
      loaDays: range.loaDaysInMonth,
      totalWorkdays: range.totalWorkdaysInMonth,
      payType,
      payRate,
      userId,
      descSuffix: '연장 정산',
    })
  }

  // 마지막 월 일수 변경 재계산 (실제 종료일이 예정 종료일과 같은 월이지만 다른 날인 경우)
  const lastActualRange = actualRanges[actualRanges.length - 1]
  const existingLastAdj = adjByYearMonth.get(lastActualRange?.yearMonth ?? '')

  if (lastActualRange && existingLastAdj && actualYearMonths.has(lastActualRange.yearMonth)) {
    const newAmount = calculateLoaDeduction(
      monthlySalary, lastActualRange.loaDaysInMonth, lastActualRange.totalWorkdaysInMonth, payType, payRate,
    )
    const oldAmount = Number(existingLastAdj.amount)

    if (newAmount !== oldAmount) {
      if (existingLastAdj.payrollRun.status === 'PAID') {
        // PAID → 차액만큼 보정
        const diff = newAmount - oldAmount // 조기복직이면 양수(환불), 연장이면 음수(추가차감)
        await createCorrectionInNextRun(tx, existingLastAdj as AdjWithRun, record, userId, diff)
      } else {
        await tx.payrollAdjustment.update({
          where: { id: existingLastAdj.id },
          data: {
            amount: newAmount,
            description: `[휴직 급여 조정] ${record.type.name} (${payType}) — ${lastActualRange.yearMonth} 휴직 ${lastActualRange.loaDaysInMonth}/${lastActualRange.totalWorkdaysInMonth}일 [정산 재계산]`,
          },
        })
      }
    }
  }
}

// ─── 함수 6: 보정 조정 생성 ─────────────────────────────────

/**
 * PAID 상태 런의 차감을 취소/보정하기 위해 다음 오픈 런에 CORRECTION 생성.
 *
 * CRITICAL: 원 차감이 음수(-3,000,000)이면 보정은 양수(+3,000,000).
 * diffAmount가 제공되면 해당 금액 사용, 없으면 전액 취소(부호 반전).
 */
async function createCorrectionInNextRun(
  tx: PrismaTx,
  originalAdj: AdjWithRun,
  record: LoaRecord,
  userId: string,
  diffAmount?: number,
): Promise<void> {
  // 전액 취소: 부호 반전 (e.g., -3M → +3M 환불)
  // 부분 조정: diffAmount 직접 사용
  const correctionAmount = diffAmount ?? -Number(originalAdj.amount)

  const nextRun = await tx.payrollRun.findFirst({
    where: {
      companyId: originalAdj.payrollRun.companyId,
      yearMonth: { gt: originalAdj.payrollRun.yearMonth },
      status: { notIn: ['PAID', 'CANCELLED'] },
    },
    orderBy: { yearMonth: 'asc' },
  })

  if (!nextRun) {
    console.warn(`[LOA Phase 3] 미정산: LOA ${record.id}, ${originalAdj.loaYearMonth}, amount=${correctionAmount}`)
    return
  }

  await tx.payrollAdjustment.create({
    data: {
      payrollRunId: nextRun.id,
      employeeId: record.employeeId,
      type: 'CORRECTION',
      category: 'LOA_PAY_ADJUSTMENT',
      description: `[휴직 소급 정산] ${record.type.name} — ${originalAdj.loaYearMonth} 분 보정 (원 차감: ${originalAdj.amount}원)`,
      amount: correctionAmount,
      loaId: record.id,
      loaYearMonth: originalAdj.loaYearMonth,
      createdById: userId,
    },
  })
  await tx.payrollRun.update({
    where: { id: nextRun.id },
    data: { adjustmentCount: { increment: 1 } },
  })
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
): Promise<number> {
  const [y, m] = yearMonth.split('-').map(Number)
  const monthStart = new Date(Date.UTC(y, m - 1, 1))
  const monthEnd = new Date(Date.UTC(y, m, 0))

  const activeLoas = await prisma.leaveOfAbsence.findMany({
    where: {
      companyId,
      status: 'ACTIVE',
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
  const existingAdjs = await prisma.payrollAdjustment.findMany({
    where: { loaId: { in: loaIds }, loaYearMonth: yearMonth },
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

    const monthlySalary = await getEmployeeMonthlySalary(loa.employeeId, new Date(loa.startDate))
    const payType = loa.payType ?? loa.type.payType ?? 'UNPAID'
    const payRate = loa.payRate ?? loa.type.payRate
    const amount = calculateLoaDeduction(
      monthlySalary, range.loaDaysInMonth, range.totalWorkdaysInMonth, payType, payRate,
    )

    await prisma.$transaction([
      prisma.payrollAdjustment.create({
        data: {
          payrollRunId: runId,
          employeeId: loa.employeeId,
          type: 'DEDUCTION',
          category: 'LOA_PAY_ADJUSTMENT',
          description: `[휴직 급여 조정] ${loa.type.name} (${payType}) — ${yearMonth} 휴직 ${range.loaDaysInMonth}/${range.totalWorkdaysInMonth}일 [자동 주입]`,
          amount,
          loaId: loa.id,
          loaYearMonth: yearMonth,
          createdById: 'system',
        },
      }),
      prisma.payrollRun.update({
        where: { id: runId },
        data: { adjustmentCount: { increment: 1 } },
      }),
    ])
    injectedCount++
  }
  return injectedCount
}
