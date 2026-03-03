// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 이직 위험 예측 엔진
// 10개 신호 가중합 + 방어 코딩 (데이터 소스 부재 시 graceful degradation)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { subWeeks, subMonths, subYears, differenceInMonths } from 'date-fns'

// ─── 타입 정의 ─────────────────────────────────────────────

export interface SignalResult {
  signal: string
  weight: number
  score: number // 0~100
  rawData: Record<string, unknown> | null
  available: boolean // 데이터 소스 존재 여부
}

export interface TurnoverRiskResult {
  overallScore: number // 0~100
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'insufficient_data'
  signals: SignalResult[]
  topFactors: string[]
}

// ─── 기본 가중치 (AnalyticsConfig 없으면 이걸 사용) ────────

const DEFAULT_WEIGHTS: Record<string, number> = {
  overtime: 0.15,
  leave_usage: 0.1,
  sentiment: 0.15,
  salary_band: 0.1,
  promotion_stagnation: 0.1,
  skill_gap: 0.05,
  training_incomplete: 0.05,
  exit_pattern: 0.1,
  eval_trend: 0.1,
  tenure: 0.1,
}

// ─── 가중치 로딩 (AnalyticsConfig 우선, 없으면 기본값) ──────

async function loadWeights(companyId: string): Promise<Record<string, number>> {
  try {
    const config = await prisma.analyticsConfig.findFirst({
      where: { companyId, configType: 'turnover_weights', isActive: true },
    })
    if (config?.config) {
      const c = config.config as { signals?: Array<{ key: string; weight: number }> }
      if (Array.isArray(c.signals)) {
        return Object.fromEntries(c.signals.map((s) => [s.key, s.weight]))
      }
    }
  } catch {
    // 설정 없으면 기본값 사용
  }
  return { ...DEFAULT_WEIGHTS }
}

// ─── 신호 계산 함수들 ──────────────────────────────────────

// 1. 초과근무 지속 (B6-1 WorkHourAlert)
async function calcOvertimeSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    const alerts = await prisma.workHourAlert.findMany({
      where: { employeeId, createdAt: { gte: subWeeks(new Date(), 4) } },
    })
    const weeksWithAlert = new Set(alerts.map((a) => a.weekStart.toISOString())).size
    const score = weeksWithAlert >= 3 ? 90 : weeksWithAlert >= 2 ? 60 : weeksWithAlert >= 1 ? 30 : 0
    return {
      signal: '초과근무 지속',
      weight,
      score,
      rawData: { weeksWithAlert, alertCount: alerts.length },
      available: true,
    }
  } catch {
    return { signal: '초과근무 지속', weight, score: 0, rawData: null, available: false }
  }
}

// 2. 연차 미사용 (B6-2 EmployeeLeaveBalance)
async function calcLeaveUsageSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    const currentYear = new Date().getFullYear()
    const balances = await prisma.employeeLeaveBalance.findMany({
      where: { employeeId, year: currentYear },
    })
    if (balances.length === 0) return { signal: '연차 미사용', weight, score: 0, rawData: null, available: false }

    const totalGranted = balances.reduce((sum, b) => sum + Number(b.grantedDays), 0)
    const totalUsed = balances.reduce((sum, b) => sum + Number(b.usedDays), 0)
    const usageRate = totalGranted > 0 ? totalUsed / totalGranted : 1

    const score = usageRate < 0.2 ? 90 : usageRate < 0.3 ? 70 : usageRate < 0.5 ? 40 : 0
    return {
      signal: '연차 미사용',
      weight,
      score,
      rawData: { totalGranted, totalUsed, usageRate: Math.round(usageRate * 100) },
      available: true,
    }
  } catch {
    return { signal: '연차 미사용', weight, score: 0, rawData: null, available: false }
  }
}

// 3. 원온원 감정 부정 (B6-2 OneOnOne.sentimentTag)
async function calcSentimentSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    const recentOoo = await prisma.oneOnOne.findMany({
      where: { employeeId, status: 'COMPLETED', sentimentTag: { not: null } },
      orderBy: { scheduledAt: 'desc' },
      take: 3,
    })
    if (recentOoo.length === 0) return { signal: '원온원 감정 부정', weight, score: 0, rawData: null, available: false }

    const negativeCount = recentOoo.filter((o) =>
      ['negative', 'bad', 'struggling', 'NEGATIVE', 'BAD'].includes(o.sentimentTag ?? '')
    ).length
    const score = negativeCount >= 2 ? 85 : negativeCount >= 1 ? 50 : 0
    return {
      signal: '원온원 감정 부정',
      weight,
      score,
      rawData: { total: recentOoo.length, negativeCount },
      available: true,
    }
  } catch {
    return { signal: '원온원 감정 부정', weight, score: 0, rawData: null, available: false }
  }
}

// 4. 급여 밴드 하위 (B7 PayrollItem + SalaryBand)
async function calcSalaryBandSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    // 최근 급여 이력
    const latestPayroll = await prisma.payrollItem.findFirst({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    })
    if (!latestPayroll)
      return { signal: '급여 밴드 하위', weight, score: 0, rawData: null, available: false }

    // 현재 Assignment에서 jobGradeId 가져오기
    const assignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId, isPrimary: true, endDate: null },
      include: { jobGrade: true },
    })
    if (!assignment?.jobGrade)
      return { signal: '급여 밴드 하위', weight, score: 0, rawData: null, available: false }

    const salaryBand = await prisma.salaryBand.findFirst({
      where: { jobGradeId: assignment.jobGradeId ?? '', deletedAt: null },
    })
    if (!salaryBand) return { signal: '급여 밴드 하위', weight, score: 0, rawData: null, available: false }

    const gross = Number(latestPayroll.grossPay)
    const min = Number(salaryBand.minSalary)
    const max = Number(salaryBand.maxSalary)
    const range = max - min
    const position = range > 0 ? (gross - min) / range : 0.5
    const score = position < 0.25 ? 80 : position < 0.4 ? 40 : 0

    return {
      signal: '급여 밴드 하위',
      weight,
      score,
      rawData: { gross, min, max, position: Math.round(position * 100) },
      available: true,
    }
  } catch {
    return { signal: '급여 밴드 하위', weight, score: 0, rawData: null, available: false }
  }
}

// 5. 승진 정체 (EmployeeAssignment.effectiveDate 기준 직급 유지 기간)
async function calcPromotionStagnationSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    // 현재 직급의 assignment 시작일
    const currentAssignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId, isPrimary: true, endDate: null },
      include: { jobGrade: true },
    })
    if (!currentAssignment)
      return { signal: '승진 정체', weight, score: 0, rawData: null, available: false }

    // 같은 직급의 가장 오래된 assignment
    const firstWithGrade = await prisma.employeeAssignment.findFirst({
      where: { employeeId, jobGradeId: currentAssignment.jobGradeId },
      orderBy: { effectiveDate: 'asc' },
    })
    const monthsInGrade = differenceInMonths(new Date(), firstWithGrade?.effectiveDate ?? new Date())
    const score = monthsInGrade >= 42 ? 85 : monthsInGrade >= 30 ? 60 : monthsInGrade >= 24 ? 30 : 0

    return {
      signal: '승진 정체',
      weight,
      score,
      rawData: { monthsInGrade, gradeName: currentAssignment.jobGrade?.name },
      available: true,
    }
  } catch {
    return { signal: '승진 정체', weight, score: 0, rawData: null, available: false }
  }
}

// 6. 역량 갭 큼 (B8-3 EmployeeSkillAssessment)
async function calcSkillGapSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    const assessments = await prisma.employeeSkillAssessment.findMany({
      where: { employeeId, assessmentPeriod: { not: 'latest' } },
      orderBy: { assessedAt: 'desc' },
    })
    if (assessments.length === 0)
      return { signal: '역량 갭 큼', weight, score: 0, rawData: null, available: false }

    // finalLevel이 있는 것 기준으로 갭 계산
    const withLevels = assessments.filter((a) => a.finalLevel !== null)
    if (withLevels.length === 0)
      return { signal: '역량 갭 큼', weight, score: 0, rawData: null, available: false }

    // expectedLevel은 CompetencyRequirement에서 가져와야 하지만, 단순화: currentLevel이 낮으면 위험
    const avgLevel =
      withLevels.reduce((sum, a) => sum + (a.finalLevel ?? a.currentLevel ?? 3), 0) / withLevels.length
    const score = avgLevel < 2 ? 80 : avgLevel < 2.5 ? 50 : avgLevel < 3 ? 20 : 0

    return {
      signal: '역량 갭 큼',
      weight,
      score,
      rawData: { avgLevel: Math.round(avgLevel * 10) / 10, assessmentCount: withLevels.length },
      available: true,
    }
  } catch {
    return { signal: '역량 갭 큼', weight, score: 0, rawData: null, available: false }
  }
}

// 7. 교육 미이수 (B9-1 TrainingEnrollment — 필수교육 미이수)
async function calcTrainingSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    // 필수 교육 등록 건 중 미이수
    const enrollments = await prisma.trainingEnrollment.findMany({
      where: { employeeId, source: 'mandatory_auto' },
      include: { course: { select: { isMandatory: true } } },
    })
    const incomplete = enrollments.filter(
      (e) => !['COMPLETED', 'CERTIFIED'].includes(e.status)
    ).length

    const score = incomplete >= 3 ? 80 : incomplete >= 2 ? 60 : incomplete >= 1 ? 30 : 0
    return {
      signal: '교육 미이수',
      weight,
      score,
      rawData: { totalMandatory: enrollments.length, incomplete },
      available: true,
    }
  } catch {
    return { signal: '교육 미이수', weight, score: 0, rawData: null, available: false }
  }
}

// 8. 퇴직 패턴 매칭 (B5 ExitInterview — 동일 부서 퇴직 사유 패턴)
async function calcExitPatternSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    const assignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId, isPrimary: true, endDate: null },
    })
    if (!assignment) return { signal: '퇴직 패턴 매칭', weight, score: 0, rawData: null, available: false }

    // 최근 12개월 같은 부서 퇴직자 만족도
    const recentExits = await prisma.exitInterview.findMany({
      where: {
        companyId: assignment.companyId,
        createdAt: { gte: subMonths(new Date(), 12) },
      },
      select: { satisfactionScore: true, primaryReason: true },
    })
    if (recentExits.length < 2)
      return { signal: '퇴직 패턴 매칭', weight, score: 0, rawData: null, available: false }

    const avgSatisfaction =
      recentExits.reduce((sum, e) => sum + e.satisfactionScore, 0) / recentExits.length
    const score = avgSatisfaction < 2.5 ? 70 : avgSatisfaction < 3 ? 40 : 0

    return {
      signal: '퇴직 패턴 매칭',
      weight,
      score,
      rawData: { recentExitCount: recentExits.length, avgSatisfaction: Math.round(avgSatisfaction * 10) / 10 },
      available: true,
    }
  } catch {
    return { signal: '퇴직 패턴 매칭', weight, score: 0, rawData: null, available: false }
  }
}

// 9. 평가 등급 하락 (PerformanceEvaluation — 전기 대비 등급 하락)
async function calcEvalTrendSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    const evals = await prisma.performanceEvaluation.findMany({
      where: { employeeId, evalType: 'SELF_EVALUATION' as never },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { performanceScore: true, competencyScore: true, createdAt: true },
    })
    if (evals.length < 2) return { signal: '평가 등급 하락', weight, score: 0, rawData: null, available: false }

    const [latest, prev] = evals
    const latestScore =
      ((Number(latest.performanceScore) || 0) + (Number(latest.competencyScore) || 0)) / 2
    const prevScore =
      ((Number(prev.performanceScore) || 0) + (Number(prev.competencyScore) || 0)) / 2
    const diff = latestScore - prevScore
    const score = diff < -1.5 ? 80 : diff < -0.5 ? 50 : 0

    return {
      signal: '평가 등급 하락',
      weight,
      score,
      rawData: { latestScore: Math.round(latestScore * 10) / 10, prevScore: Math.round(prevScore * 10) / 10, diff: Math.round(diff * 10) / 10 },
      available: true,
    }
  } catch {
    return { signal: '평가 등급 하락', weight, score: 0, rawData: null, available: false }
  }
}

// 10. 재직기간 위험 (2~3년차 이직 피크)
async function calcTenureSignal(employeeId: string, weight: number): Promise<SignalResult> {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { hireDate: true },
    })
    if (!employee) return { signal: '재직기간', weight, score: 0, rawData: null, available: false }

    const monthsOfService = differenceInMonths(new Date(), employee.hireDate)
    // 18~42개월(1.5~3.5년) = 이직 피크
    const score = monthsOfService >= 18 && monthsOfService <= 42 ? 60 : monthsOfService > 42 && monthsOfService <= 60 ? 30 : 0

    return {
      signal: '재직기간',
      weight,
      score,
      rawData: { monthsOfService, yearsOfService: Math.round((monthsOfService / 12) * 10) / 10 },
      available: true,
    }
  } catch {
    return { signal: '재직기간', weight, score: 0, rawData: null, available: false }
  }
}

// ─── 메인 계산 함수 ────────────────────────────────────────

export async function calculateTurnoverRisk(
  employeeId: string,
  companyId: string
): Promise<TurnoverRiskResult> {
  const weights = await loadWeights(companyId)

  const signals = await Promise.all([
    calcOvertimeSignal(employeeId, weights.overtime),
    calcLeaveUsageSignal(employeeId, weights.leave_usage),
    calcSentimentSignal(employeeId, weights.sentiment),
    calcSalaryBandSignal(employeeId, weights.salary_band),
    calcPromotionStagnationSignal(employeeId, weights.promotion_stagnation),
    calcSkillGapSignal(employeeId, weights.skill_gap),
    calcTrainingSignal(employeeId, weights.training_incomplete),
    calcExitPatternSignal(employeeId, weights.exit_pattern),
    calcEvalTrendSignal(employeeId, weights.eval_trend),
    calcTenureSignal(employeeId, weights.tenure),
  ])

  const availableSignals = signals.filter((s) => s.available)

  // 사용 가능한 신호 3개 미만이면 분석 불가
  if (availableSignals.length < 3) {
    return {
      overallScore: 0,
      riskLevel: 'insufficient_data',
      signals,
      topFactors: [],
    }
  }

  // 가중치 재분배 (available 신호만 사용)
  const totalWeight = availableSignals.reduce((sum, s) => sum + s.weight, 0)
  const overallScore = availableSignals.reduce((sum, s) => {
    const normalizedWeight = totalWeight > 0 ? s.weight / totalWeight : 0
    return sum + s.score * normalizedWeight
  }, 0)

  const riskLevel =
    overallScore >= 75
      ? 'critical'
      : overallScore >= 55
        ? 'high'
        : overallScore >= 35
          ? 'medium'
          : 'low'

  const topFactors = [...availableSignals]
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3)
    .filter((s) => s.score > 0)
    .map((s) => s.signal)

  return { overallScore: Math.round(overallScore), riskLevel, signals, topFactors }
}
