/**
 * B6-2 Leave Accrual Engine
 *
 * 지원 accrualBasis:
 *   calendar_year           — 매년 1월 1일 기준 부여
 *   hire_date_anniversary   — 입사 기념일 기준 부여 (한국 근로기준법)
 *
 * 지원 accrualType:
 *   annual                  — 연 1회 일괄 부여
 *   monthly                 — 매월 1회 부여 (첫 해 적용)
 *   manual                  — 수동 부여 (HR 직접 입력)
 *
 * 한국 근로기준법 로직:
 * TODO: Move to Settings (Attendance) — 연차 기본 부여일수 1년 이상 15일 (근로기준법 §60①)
 * TODO: Move to Settings (Attendance) — 연차 최대 부여일수 25일 (근로기준법 §60②)
 * TODO: Move to Settings (Attendance) — 연차 첫해 월별 부여 최대 11일 (근로기준법 §60②)
 *   - 입사 첫 해: 개근 월마다 1일 (최대 11일)
 *   - 1년 이상: 15일/년
 *   - 3년 이상: 2년마다 +1일 가산 (최대 25일)
 */

import { prisma } from '@/lib/prisma'
import { differenceInMonths, differenceInYears, startOfYear, endOfYear, parseISO } from 'date-fns'

// ─── 타입 정의 ─────────────────────────────────────────────────────────────

interface AccrualRule {
  minTenureMonths?: number
  maxTenureMonths?: number | null
  daysPerYear?: number
  daysPerMonth?: number
  bonusPerTwoYears?: number
  maxDays?: number
  type?: string
}

interface LeaveAccrualRuleData {
  accrualType: string
  accrualBasis: string
  rules: AccrualRule[]
  carryOverType: string
  carryOverMaxDays: number | null
  carryOverExpiryMonths: number | null
}

interface EntitlementResult {
  entitled: number
  accrualType: string
  accrualBasis: string
  hireDate: Date
  tenureMonths: number
  tenureYears: number
  calculationNotes: string
}

// ─── 핵심 함수: 연간 부여 일수 계산 ────────────────────────────────────────

/**
 * 직원 1명 + 특정 휴가 유형에 대해 해당 연도 부여 일수 계산
 */
export async function calculateEntitlement(
  employeeId: string,
  leaveTypeDefId: string,
  year: number
): Promise<EntitlementResult | null> {
  // 직원 입사일 조회 (EmployeeAssignment primary)
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { hireDate: true },
  })

  if (!employee) return null

  const hireDateRaw = employee.hireDate
  if (!hireDateRaw) return null

  const hireDate = hireDateRaw instanceof Date ? hireDateRaw : parseISO(String(hireDateRaw))
  const referenceDate = new Date(year, 11, 31) // 연말 기준 근속 계산

  const tenureMonths = differenceInMonths(referenceDate, hireDate)
  const tenureYears = differenceInYears(referenceDate, hireDate)

  // 휴가 유형 + 부여 규칙 조회
  const leaveTypeDef = await prisma.leaveTypeDef.findUnique({
    where: { id: leaveTypeDefId },
    include: {
      accrualRules: {
        where: { isActive: true },
        take: 1,
      },
    },
  })

  if (!leaveTypeDef || leaveTypeDef.accrualRules.length === 0) return null

  const ruleRecord = leaveTypeDef.accrualRules[0]
  const ruleData: LeaveAccrualRuleData = {
    accrualType: ruleRecord.accrualType,
    accrualBasis: ruleRecord.accrualBasis,
    rules: (ruleRecord.rules as AccrualRule[]) ?? [],
    carryOverType: ruleRecord.carryOverType,
    carryOverMaxDays: ruleRecord.carryOverMaxDays,
    carryOverExpiryMonths: ruleRecord.carryOverExpiryMonths,
  }

  const entitled = computeEntitledDays(ruleData, tenureMonths, tenureYears, hireDate, year)
  const notes = buildNotes(ruleData, tenureMonths, tenureYears, entitled)

  return {
    entitled,
    accrualType: ruleData.accrualType,
    accrualBasis: ruleData.accrualBasis,
    hireDate,
    tenureMonths,
    tenureYears,
    calculationNotes: notes,
  }
}

// ─── 내부: 부여 일수 계산 로직 ─────────────────────────────────────────────

function computeEntitledDays(
  rule: LeaveAccrualRuleData,
  tenureMonths: number,
  tenureYears: number,
  hireDate: Date,
  year: number
): number {
  if (rule.accrualType === 'manual') return 0

  const tiers = rule.rules

  // 월별 부여 (첫 해 Korean 방식)
  if (rule.accrualType === 'monthly') {
    const monthlyTier = tiers.find((t) => t.type === 'monthly')
    if (monthlyTier?.daysPerMonth) {
      // 해당 연도에 근무한 월 수 (최대 11개월)
      const yearStart = new Date(year, 0, 1)
      const yearEnd = new Date(year, 11, 31)
      const effectiveStart = hireDate > yearStart ? hireDate : yearStart
      const months = Math.min(differenceInMonths(yearEnd, effectiveStart), 11)
      return months * monthlyTier.daysPerMonth
    }
    return 0
  }

  // 연별 부여 — 티어 순회
  if (rule.accrualType === 'annual') {
    // hire_date_anniversary: 아직 1년 미만이면 0
    if (rule.accrualBasis === 'hire_date_anniversary' && tenureMonths < 12) {
      return 0
    }

    // 적합한 tier 탐색 (근속월 기준)
    const matchedTier = tiers.find((t) => {
      const minOk = (t.minTenureMonths ?? 0) <= tenureMonths
      const maxOk = t.maxTenureMonths == null || tenureMonths <= t.maxTenureMonths
      return minOk && maxOk
    })

    if (!matchedTier) return 0

    let base = matchedTier.daysPerYear ?? 0

    // 2년마다 가산 (bonusPerTwoYears)
    if (matchedTier.bonusPerTwoYears && tenureYears >= 3) {
      const extraPeriods = Math.floor((tenureYears - 1) / 2)
      base = Math.min(base + extraPeriods * matchedTier.bonusPerTwoYears, matchedTier.maxDays ?? Infinity)
    }

    return base
  }

  return 0
}

function buildNotes(
  rule: LeaveAccrualRuleData,
  tenureMonths: number,
  tenureYears: number,
  entitled: number
): string {
  return `accrualBasis=${rule.accrualBasis}, tenure=${tenureYears}년${tenureMonths % 12}개월, entitled=${entitled}일`
}

// ─── 일괄 처리: 법인 전체 연간 부여 ────────────────────────────────────────

/**
 * 특정 법인의 모든 재직자에게 해당 연도 연간 휴가를 일괄 부여/갱신
 * - LeaveYearBalance upsert (entitled 갱신, used/carriedOver 보존)
 * - carryOver 처리: 전년도 잔여를 이월
 */
export async function processAnnualAccrual(companyId: string, year: number): Promise<{
  processed: number
  errors: number
}> {
  // 법인 소속 재직자 목록
  const employees = await prisma.employee.findMany({
    where: {
      assignments: {
        some: { companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
      },
    },
    select: { id: true },
  })

  // 법인 활성 휴가 유형 조회 (법인 전용 + 글로벌 공통)
  const leaveTypeDefs = await prisma.leaveTypeDef.findMany({
    where: {
      isActive: true,
      OR: [{ companyId }, { companyId: null }],
    },
    include: {
      accrualRules: { where: { isActive: true }, take: 1 },
    },
  })

  let processed = 0
  let errors = 0

  for (const emp of employees) {
    for (const ltd of leaveTypeDefs) {
      if (ltd.accrualRules.length === 0) continue

      try {
        const result = await calculateEntitlement(emp.id, ltd.id, year)
        if (!result) continue

        // 이월 처리 — 전년도 잔여 조회
        let carriedOver = 0
        const rule = ltd.accrualRules[0]
        if (rule.carryOverType !== 'none') {
          const prevBalance = await prisma.leaveYearBalance.findUnique({
            where: { employeeId_leaveTypeDefId_year: { employeeId: emp.id, leaveTypeDefId: ltd.id, year: year - 1 } },
          })
          if (prevBalance) {
            const remaining = prevBalance.entitled + prevBalance.carriedOver + prevBalance.adjusted - prevBalance.used
            if (rule.carryOverType === 'unlimited') {
              carriedOver = Math.max(0, remaining)
            } else if (rule.carryOverType === 'limited' && rule.carryOverMaxDays != null) {
              carriedOver = Math.min(Math.max(0, remaining), rule.carryOverMaxDays)
            }
          }
        }

        // 이월 만료일 계산
        let expiresAt: Date | null = null
        if (rule.carryOverExpiryMonths != null && carriedOver > 0) {
          const yearStart = new Date(year, 0, 1)
          expiresAt = new Date(yearStart)
          expiresAt.setMonth(expiresAt.getMonth() + rule.carryOverExpiryMonths)
        }

        // Upsert LeaveYearBalance
        await prisma.leaveYearBalance.upsert({
          where: { employeeId_leaveTypeDefId_year: { employeeId: emp.id, leaveTypeDefId: ltd.id, year } },
          update: { entitled: result.entitled, carriedOver, expiresAt },
          create: {
            employeeId: emp.id,
            leaveTypeDefId: ltd.id,
            year,
            entitled: result.entitled,
            used: 0,
            carriedOver,
            adjusted: 0,
            pending: 0,
            expiresAt,
          },
        })

        processed++
      } catch {
        errors++
      }
    }
  }

  return { processed, errors }
}

// ─── 유틸: 직원 특정 연도 잔여 일수 ────────────────────────────────────────

export async function getEmployeeLeaveBalance(
  employeeId: string,
  year: number
): Promise<Array<{
  leaveTypeDefId: string
  code: string
  name: string
  entitled: number
  used: number
  carriedOver: number
  adjusted: number
  pending: number
  remaining: number
}>> {
  const balances = await prisma.leaveYearBalance.findMany({
    where: { employeeId, year },
    include: { leaveTypeDef: { select: { code: true, name: true } } },
  })

  return balances.map((b) => ({
    leaveTypeDefId: b.leaveTypeDefId,
    code: b.leaveTypeDef.code,
    name: b.leaveTypeDef.name,
    entitled: b.entitled,
    used: b.used,
    carriedOver: b.carriedOver,
    adjusted: b.adjusted,
    pending: b.pending,
    remaining: b.entitled + b.carriedOver + b.adjusted - b.used - b.pending,
  }))
}
