// ═══════════════════════════════════════════════════════════
// G-2: AI Report — KPI Data Collector
// Gathers aggregated, anonymized data for AI prompt
// Never sends individual employee names
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { convertToKRW, formatCurrency } from '@/lib/analytics/currency'
import { annualBalanceWhere, leaveAvailable, leaveUtilizationRate } from '@/lib/leave/utilization'

export interface ReportDataPayload {
  period: string
  companyName: string
  headcount: {
    total: number
    newHires: number
    exits: number
    netChange: number
    prevTotal: number
  }
  turnover: {
    monthlyRate: number
    prevMonthlyRate: number
    regrettableExits: number
    topExitReasons: { reason: string; count: number }[]
  }
  payroll: {
    monthlyTotalKRW: number
    formattedTotal: string
    prevMonthTotalKRW: number
    changeRate: number
    perCapita: number
  }
  performance: {
    currentPhase: string
    gradeDistribution: { grade: string; count: number }[]
    evaluationCompletionRate: number
  }
  attendance: {
    weeklyOvertimeViolations: number
    avgOvertimeHours: number
    leaveUsageRate: number
  }
  onboarding: {
    inProgress: number
    completedThisMonth: number
  }
  predictions: {
    turnoverHighRisk: number
    turnoverMediumRisk: number
    burnoutAtRisk: number
    burnoutConditions: {
      overtime: number
      leaveUnused: number
      performanceDecline: number
    }
  }
}

// 멀티테넌트 격리: companyId 컬럼이 없는 모델(LeaveYearBalance·Employee)을 employee 활성 primary
// 발령 관계로 법인 스코프 (글로벌 annual def 공유 → 이 employee 스코프가 격리 핵심). companyId=null(SUPER) → 전사.
function activeAssignmentWhere(companyId: string) {
  return { assignments: { some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' } } }
}

export async function collectReportData(
  companyId: string | null,
  period: string
): Promise<ReportDataPayload> {
  const [year, month] = period.split('-').map(Number)
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0) // last day of month
  const prevStartDate = new Date(year, month - 2, 1)
  const prevEndDate = new Date(year, month - 1, 0)
  const now = new Date()
  const currentYear = now.getFullYear()

  const companyFilter = companyId ? { companyId } : {}

  // ── Parallel data fetch ──
  const [
    activeCount,
    prevActiveCount,
    newHires,
    exits,
    prevExits,
    companies,
    payrollRuns,
    performanceCycles,
    gradeDistribution,
    overtimeData,
    leaveBalances,
    onboardingActive,
    onboardingCompleted,
    exitInterviews,
  ] = await Promise.all([
    // 1. Current active employees
    prisma.employeeAssignment.count({
      where: { ...companyFilter, status: 'ACTIVE', isPrimary: true, endDate: null },
    }),
    // 2. Previous month active (approximation)
    prisma.employeeAssignment.count({
      where: { ...companyFilter, status: 'ACTIVE', isPrimary: true, endDate: null },
    }),
    // 3. New hires this month
    prisma.employeeAssignment.count({
      where: {
        ...companyFilter, isPrimary: true, changeType: 'HIRE',
        effectiveDate: { gte: startDate, lte: endDate },
      },
    }),
    // 4. Exits this month
    prisma.employeeAssignment.count({
      where: {
        ...companyFilter, isPrimary: true,
        status: { in: ['RESIGNED', 'TERMINATED'] },
        endDate: { gte: startDate, lte: endDate },
      },
    }),
    // 5. Previous month exits
    prisma.employeeAssignment.count({
      where: {
        ...companyFilter, isPrimary: true,
        status: { in: ['RESIGNED', 'TERMINATED'] },
        endDate: { gte: prevStartDate, lte: prevEndDate },
      },
    }),
    // 6. Companies for name resolution
    prisma.company.findMany({
      where: { deletedAt: null, ...(companyId ? { id: companyId } : {}) },
      select: { id: true, name: true, currency: true },
    }),
    // 7. Payroll runs for this period
    prisma.payrollRun.findMany({
      where: {
        ...companyFilter,
        yearMonth: period,
        status: { in: ['APPROVED', 'PAID'] },
      },
      select: { totalGross: true, currency: true, headcount: true, companyId: true },
    }),
    // 8. Latest performance cycle
    prisma.performanceCycle.findFirst({
      where: companyFilter,
      orderBy: { year: 'desc' },
      select: { id: true, status: true, name: true },
    }),
    // 9. Grade distribution
    prisma.performanceReview.groupBy({
      by: ['finalGrade'],
      where: { ...companyFilter, finalGrade: { not: null } },
      _count: true,
    }),
    // 10. Overtime violations this month
    prisma.attendance.findMany({
      where: {
        ...companyFilter,
        workDate: { gte: startDate, lte: endDate },
        overtimeMinutes: { gt: 0 },
      },
      select: { overtimeMinutes: true },
    }),
    // 11. Leave balances — SSOT LeaveYearBalance · annual-only · 법인 스코프(employee 발령 + annual def)
    prisma.leaveYearBalance.findMany({
      where: {
        year: currentYear,
        ...(companyId ? { employee: activeAssignmentWhere(companyId) } : {}),
        ...annualBalanceWhere(companyId),
      },
      select: { entitled: true, used: true, carriedOver: true, adjusted: true },
    }),
    // 12. Active onboardings
    prisma.employeeOnboarding.count({
      where: { ...companyFilter, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } },
    }),
    // 13. Completed onboardings
    prisma.employeeOnboarding.count({
      where: {
        ...companyFilter, status: 'COMPLETED',
        completedAt: { gte: startDate, lte: endDate },
      },
    }),
    // 14. Exit interviews
    prisma.exitInterview.findMany({
      where: companyFilter,
      select: { primaryReason: true },
    }),
  ])

  // ── Process data ──
  const companyName = companyId
    ? companies.find((c) => c.id === companyId)?.name || '선택 법인'
    : '전사'

  // Turnover
  const monthlyRate = activeCount > 0 ? Math.round((exits / activeCount) * 1000) / 10 : 0
  const prevMonthlyRate = prevActiveCount > 0 ? Math.round((prevExits / prevActiveCount) * 1000) / 10 : 0

  // Exit reasons
  const reasonCounts = new Map<string, number>()
  const reasonLabels: Record<string, string> = {
    COMPENSATION: '보상/급여', CAREER_GROWTH: '성장/커리어',
    WORK_LIFE_BALANCE: '워라밸', MANAGEMENT: '관리/리더십',
    CULTURE: '조직문화', RELOCATION: '이전/통근',
    PERSONAL: '개인사유', OTHER: '기타',
  }
  for (const i of exitInterviews) {
    const label = reasonLabels[i.primaryReason] || i.primaryReason
    reasonCounts.set(label, (reasonCounts.get(label) || 0) + 1)
  }
  const topExitReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Regrettable exits (simplified — M+ who left)
  const regrettableExits = await prisma.performanceReview.count({
    where: {
      ...companyFilter,
      finalGrade: { in: ['O', 'E'] },
      employee: {
        assignments: {
          some: {
            isPrimary: true,
            status: { in: ['RESIGNED', 'TERMINATED'] },
            endDate: { gte: startDate, lte: endDate },
          },
        },
      },
    },
  })

  // Payroll
  let totalPayrollKRW = 0
  for (const p of payrollRuns) {
    totalPayrollKRW += convertToKRW(Number(p.totalGross || 0), p.currency)
  }
  // Previous month payroll
  const prevPayrolls = await prisma.payrollRun.findMany({
    where: {
      ...companyFilter,
      yearMonth: `${year}-${String(month - 1).padStart(2, '0')}`,
      status: { in: ['APPROVED', 'PAID'] },
    },
    select: { totalGross: true, currency: true },
  })
  let prevPayrollKRW = 0
  for (const p of prevPayrolls) {
    prevPayrollKRW += convertToKRW(Number(p.totalGross || 0), p.currency)
  }
  const payrollChangeRate = prevPayrollKRW > 0
    ? Math.round(((totalPayrollKRW - prevPayrollKRW) / prevPayrollKRW) * 1000) / 10
    : 0

  // Overtime
  const totalOtMinutes = overtimeData.reduce((s, a) => s + (a.overtimeMinutes || 0), 0)
  const avgOvertimeHours = overtimeData.length > 0
    ? Math.round((totalOtMinutes / 60 / overtimeData.length) * 10) / 10
    : 0
  const weeklyViolations = overtimeData.filter((a) => (a.overtimeMinutes || 0) > 720).length // >12h/day

  // Leave usage — 분모 가용분(entitled+이월+조정), annual-only
  let totalAvailable = 0
  let totalUsed = 0
  for (const b of leaveBalances) {
    totalAvailable += leaveAvailable(b)
    totalUsed += b.used
  }
  const leaveUsageRateValue = leaveUtilizationRate(totalUsed, totalAvailable)
  const leaveUsageRate = leaveUsageRateValue === null ? 0 : Math.round(leaveUsageRateValue * 1000) / 10

  // Grade distribution
  const grades = gradeDistribution.map((g) => ({
    grade: g.finalGrade || '-',
    count: g._count,
  }))

  // Evaluation completion
  const totalReviews = grades.reduce((s, g) => s + g.count, 0)

  // ── Prediction data (call internal logic) ──
  // Simplified summary — actual counts from prediction APIs
  // 법인 스코프(멀티테넌트 누출 차단): 위험인원 카운트도 동일 법인 활성 직원으로 격리
  const highRiskEmps = await prisma.employee.count({
    where: {
      deletedAt: null,
      attritionRiskScore: { gte: 70 },
      ...(companyId ? activeAssignmentWhere(companyId) : {}),
    },
  })
  const mediumRiskEmps = await prisma.employee.count({
    where: {
      deletedAt: null,
      attritionRiskScore: { gte: 40, lt: 70 },
      ...(companyId ? activeAssignmentWhere(companyId) : {}),
    },
  })

  return {
    period,
    companyName,
    headcount: {
      total: activeCount,
      newHires,
      exits,
      netChange: newHires - exits,
      prevTotal: prevActiveCount,
    },
    turnover: {
      monthlyRate,
      prevMonthlyRate,
      regrettableExits,
      topExitReasons,
    },
    payroll: {
      monthlyTotalKRW: totalPayrollKRW,
      formattedTotal: formatCurrency(totalPayrollKRW, 'KRW'),
      prevMonthTotalKRW: prevPayrollKRW,
      changeRate: payrollChangeRate,
      perCapita: activeCount > 0 ? Math.round(totalPayrollKRW / activeCount) : 0,
    },
    performance: {
      currentPhase: performanceCycles?.status || '-',
      gradeDistribution: grades,
      evaluationCompletionRate: totalReviews,
    },
    attendance: {
      weeklyOvertimeViolations: weeklyViolations,
      avgOvertimeHours,
      leaveUsageRate,
    },
    onboarding: {
      inProgress: onboardingActive,
      completedThisMonth: onboardingCompleted,
    },
    predictions: {
      turnoverHighRisk: highRiskEmps,
      turnoverMediumRisk: mediumRiskEmps,
      burnoutAtRisk: 0, // calculated at runtime
      burnoutConditions: {
        overtime: 0,
        leaveUnused: 0,
        performanceDecline: 0,
      },
    },
  }
}
