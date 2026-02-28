// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attrition Risk Calculator (6-Factor Model)
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

// ─── Interfaces ──────────────────────────────────────────

export interface AttritionRiskResult {
  employeeId: string
  riskScore: number          // 0-100 integer scale
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  factors: AttritionFactor[]
  calculatedAt: Date
}

export interface AttritionFactor {
  factor: string
  weight: number
  value: number
  description: string
}

// ─── Factor Weights ──────────────────────────────────────

const FACTOR_WEIGHTS = {
  TENURE: 0.15,
  COMPENSATION: 0.25,
  PERFORMANCE: 0.20,
  MANAGER: 0.15,
  ENGAGEMENT: 0.15,
  ATTENDANCE: 0.10,
} as const

// ─── Factor Calculators (each returns 0-100) ────────────

async function calculateTenureFactor(employeeId: string): Promise<number> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { hireDate: true },
  })

  if (!employee) return 50

  const now = new Date()
  const monthsSinceHire =
    (now.getFullYear() - employee.hireDate.getFullYear()) * 12 +
    (now.getMonth() - employee.hireDate.getMonth())

  if (monthsSinceHire < 6) return 50   // new hire, still uncertain
  if (monthsSinceHire < 18) return 70  // highest risk — first year turnover
  if (monthsSinceHire < 36) return 40  // stabilizing
  if (monthsSinceHire < 60) return 25  // settled
  return 35                             // plateau, could seek new challenge
}

async function calculateCompensationFactor(employeeId: string): Promise<number> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true, jobGradeId: true, jobCategoryId: true },
  })

  if (!employee) return 50

  // Get latest compensation history for current salary
  const latestComp = await prisma.compensationHistory.findFirst({
    where: { employeeId },
    orderBy: { effectiveDate: 'desc' },
    select: { newBaseSalary: true, effectiveDate: true },
  })

  if (!latestComp) return 50 // no compensation data — neutral

  // Get matching salary band
  const salaryBand = await prisma.salaryBand.findFirst({
    where: {
      companyId: employee.companyId,
      jobGradeId: employee.jobGradeId,
      ...(employee.jobCategoryId ? { jobCategoryId: employee.jobCategoryId } : {}),
      deletedAt: null,
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { midSalary: true },
  })

  let score: number

  if (salaryBand) {
    const currentSalary = Number(latestComp.newBaseSalary)
    const midSalary = Number(salaryBand.midSalary)
    const compaRatio = midSalary > 0 ? currentSalary / midSalary : 1.0

    if (compaRatio < 0.80) score = 90       // severely underpaid
    else if (compaRatio < 0.90) score = 70
    else if (compaRatio < 0.95) score = 50
    else if (compaRatio <= 1.05) score = 20
    else if (compaRatio <= 1.20) score = 10
    else score = 5
  } else {
    score = 40 // no band data — neutral-ish
  }

  // Check if no raise in 18+ months
  const eighteenMonthsAgo = new Date()
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18)

  if (latestComp.effectiveDate < eighteenMonthsAgo) {
    score = Math.min(100, score + 20)
  }

  return score
}

async function calculatePerformanceFactor(employeeId: string): Promise<number> {
  // Get latest PerformanceEvaluation with emsBlock
  const latestEval = await prisma.performanceEvaluation.findFirst({
    where: { employeeId, status: 'SUBMITTED' },
    orderBy: { createdAt: 'desc' },
    select: { emsBlock: true, employeeId: true },
  })

  if (!latestEval || !latestEval.emsBlock) return 40 // no evaluation — neutral-high

  // emsBlock is a string like "7", "8", "9" etc. representing block position 1-9
  const blockNumber = parseInt(latestEval.emsBlock, 10)

  if (isNaN(blockNumber)) return 40

  let score: number
  if (blockNumber >= 7) {
    // High performers: market demand, poaching risk
    score = 60
  } else if (blockNumber >= 4) {
    // Mid performers: moderate risk
    score = 30
  } else {
    // Low performers: lower mobility
    score = 20
  }

  // High performer + low compa = extreme risk
  if (blockNumber >= 7) {
    const compFactor = await calculateCompensationFactor(employeeId)
    if (compFactor >= 70) {
      score = 90
    }
  }

  return score
}

async function calculateManagerFactor(employeeId: string): Promise<number> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { managerId: true },
  })

  if (!employee) return 50

  // No manager assigned — higher uncertainty
  if (!employee.managerId) return 50

  // Has manager — default lower risk
  // Future: integrate 1:1 frequency and Pulse manager scores
  return 30
}

async function calculateEngagementFactor(employeeId: string): Promise<number> {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const responses = await prisma.pulseResponse.findMany({
    where: {
      respondentId: employeeId,
      submittedAt: { gte: sixMonthsAgo },
    },
    orderBy: { submittedAt: 'desc' },
    select: { answerValue: true, submittedAt: true },
  })

  if (responses.length === 0) return 50 // no data — neutral

  // Map Mood values to risk scores
  const MOOD_RISK: Record<string, number> = {
    GREAT: 10,
    GOOD: 25,
    NEUTRAL: 40,
    STRUGGLING: 65,
    BAD: 85,
  }

  // Average sentiment risk from responses
  let totalMoodRisk = 0
  let moodCount = 0

  for (const r of responses) {
    const risk = MOOD_RISK[r.answerValue]
    if (risk !== undefined) {
      totalMoodRisk += risk
      moodCount++
    }
  }

  let score = moodCount > 0 ? Math.round(totalMoodRisk / moodCount) : 50

  // Check for consecutive non-responses by looking at recent surveys
  const recentSurveys = await prisma.pulseSurvey.findMany({
    where: {
      closeAt: { gte: sixMonthsAgo },
      status: 'PULSE_CLOSED',
    },
    orderBy: { closeAt: 'desc' },
    take: 5,
    select: { id: true },
  })

  if (recentSurveys.length >= 2) {
    const lastTwoSurveyIds = recentSurveys.slice(0, 2).map((s) => s.id)
    const responsesInLast2 = await prisma.pulseResponse.count({
      where: {
        respondentId: employeeId,
        surveyId: { in: lastTwoSurveyIds },
      },
    })
    if (responsesInLast2 === 0) {
      score = Math.min(100, score + 20) // consecutive non-response penalty
    }
  }

  return score
}

async function calculateAttendanceFactor(employeeId: string): Promise<number> {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId,
      workDate: { gte: sixMonthsAgo },
    },
    select: {
      status: true,
      overtimeMinutes: true,
      workDate: true,
    },
  })

  if (attendances.length === 0) return 30 // no data — keep default

  const totalDays = attendances.length
  const lateDays = attendances.filter((a) => a.status === 'LATE').length
  const absentDays = attendances.filter((a) => a.status === 'ABSENT').length

  let score = 20 // baseline

  // Late rate impact
  const lateRate = totalDays > 0 ? lateDays / totalDays : 0
  if (lateRate > 0.15) score += 30
  else if (lateRate > 0.08) score += 15

  // Absent days impact
  if (absentDays >= 5) score += 25
  else if (absentDays >= 2) score += 10

  // Burnout risk: excessive overtime (60h+ per month)
  const totalOvertimeMinutes = attendances.reduce(
    (sum, a) => sum + (a.overtimeMinutes ?? 0),
    0,
  )
  const monthsSpan = Math.max(1, Math.ceil(totalDays / 22)) // approximate months
  const avgMonthlyOvertimeHours = totalOvertimeMinutes / 60 / monthsSpan

  if (avgMonthlyOvertimeHours >= 60) score += 25 // severe burnout risk
  else if (avgMonthlyOvertimeHours >= 40) score += 15

  return Math.min(100, score)
}

// ─── Risk Level Classification ───────────────────────────

function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

// ─── Main Calculation ────────────────────────────────────

export async function calculateAttritionRisk(
  employeeId: string,
): Promise<AttritionRiskResult> {
  const factors: AttritionFactor[] = await Promise.all([
    calculateTenureFactor(employeeId).then((v) => ({
      factor: 'TENURE',
      weight: FACTOR_WEIGHTS.TENURE,
      value: v,
      description: '근속 위험',
    })),
    calculateCompensationFactor(employeeId).then((v) => ({
      factor: 'COMPENSATION',
      weight: FACTOR_WEIGHTS.COMPENSATION,
      value: v,
      description: '보상 불만족',
    })),
    calculatePerformanceFactor(employeeId).then((v) => ({
      factor: 'PERFORMANCE',
      weight: FACTOR_WEIGHTS.PERFORMANCE,
      value: v,
      description: '성과 불일치',
    })),
    calculateManagerFactor(employeeId).then((v) => ({
      factor: 'MANAGER',
      weight: FACTOR_WEIGHTS.MANAGER,
      value: v,
      description: '매니저 관계',
    })),
    calculateEngagementFactor(employeeId).then((v) => ({
      factor: 'ENGAGEMENT',
      weight: FACTOR_WEIGHTS.ENGAGEMENT,
      value: v,
      description: '참여도',
    })),
    calculateAttendanceFactor(employeeId).then((v) => ({
      factor: 'ATTENDANCE',
      weight: FACTOR_WEIGHTS.ATTENDANCE,
      value: v,
      description: '근태 패턴',
    })),
  ])

  const riskScore = Math.round(
    factors.reduce((sum, f) => sum + f.value * f.weight, 0),
  )
  const riskLevel = getRiskLevel(riskScore)

  return {
    employeeId,
    riskScore,
    riskLevel,
    factors,
    calculatedAt: new Date(),
  }
}

// ─── Batch Calculation (for cron / manual trigger) ───────

export async function calculateAttritionRiskBatch(
  companyId: string,
): Promise<{ processed: number }> {
  const employees = await prisma.employee.findMany({
    where: { companyId, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  })

  let processed = 0

  for (const emp of employees) {
    const result = await calculateAttritionRisk(emp.id)

    await prisma.attritionRiskHistory.create({
      data: {
        employeeId: emp.id,
        companyId,
        score: result.riskScore,
        ruleScore: result.riskScore,
        scoreFactors: JSON.parse(JSON.stringify(result.factors)),
        calculatedAt: result.calculatedAt,
      },
    })

    // Also update the denormalized score on the employee record
    await prisma.employee.update({
      where: { id: emp.id },
      data: { attritionRiskScore: result.riskScore },
    })

    processed++
  }

  return { processed }
}
