// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 팀 심리안전 지수 엔진
// 5개 지표 기반 팀 레벨 집계 + 방어 코딩
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { subMonths } from 'date-fns'

export interface TeamHealthMetric {
  metric: string
  score: number
  rawData: Record<string, unknown> | null
  available: boolean
}

export interface TeamHealthResult {
  overallScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  metrics: TeamHealthMetric[]
  memberCount: number
}

// ─── 팀원 조회 ───────────────────────────────────────────

async function getTeamMembers(departmentId: string): Promise<string[]> {
  const assignments = await prisma.employeeAssignment.findMany({
    where: { departmentId, isPrimary: true, endDate: null, status: 'ACTIVE' },
    select: { employeeId: true },
  })
  return assignments.map((a) => a.employeeId)
}

// ─── 지표 계산 함수들 ─────────────────────────────────────

// 1. 팀 평균 원온원 감정 점수
async function calcTeamAvgSentiment(memberIds: string[]): Promise<TeamHealthMetric> {
  if (memberIds.length === 0)
    return { metric: '팀 평균 감정', score: 0, rawData: null, available: false }
  try {
    const ooos = await prisma.oneOnOne.findMany({
      where: {
        employeeId: { in: memberIds },
        status: 'COMPLETED',
        sentimentTag: { not: null },
        scheduledAt: { gte: subMonths(new Date(), 3) },
      },
      select: { sentimentTag: true },
    })
    if (ooos.length === 0)
      return { metric: '팀 평균 감정', score: 0, rawData: null, available: false }

    const sentimentToNum = (tag: string | null): number => {
      const t = (tag ?? '').toLowerCase()
      if (['positive', 'great'].includes(t)) return 5
      if (['good'].includes(t)) return 4
      if (['neutral', 'mixed'].includes(t)) return 3
      if (['negative', 'bad'].includes(t)) return 2
      if (['struggling', 'critical'].includes(t)) return 1
      return 3
    }

    const scores = ooos.map((o) => sentimentToNum(o.sentimentTag))
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length

    // 낮은 감정 = 높은 위험 → 100점 기준으로 역변환
    // avg 5 → score 0 (건강), avg 1 → score 100 (위험)
    const score = Math.max(0, Math.round(((5 - avg) / 4) * 100))

    return {
      metric: '팀 평균 감정',
      score,
      rawData: { sessionCount: ooos.length, avgSentiment: Math.round(avg * 10) / 10 },
      available: true,
    }
  } catch {
    return { metric: '팀 평균 감정', score: 0, rawData: null, available: false }
  }
}

// 2. 팀 이직률 (12개월 기준)
async function calcTeamTurnoverRate(departmentId: string): Promise<TeamHealthMetric> {
  try {
    const twelveMonthsAgo = subMonths(new Date(), 12)

    // 퇴직자 수
    const exits = await prisma.employeeAssignment.count({
      where: {
        departmentId,
        endDate: { gte: twelveMonthsAgo },
        isPrimary: true,
      },
    })

    // 현재 팀원 수
    const current = await prisma.employeeAssignment.count({
      where: { departmentId, isPrimary: true, endDate: null, status: 'ACTIVE' },
    })

    const total = current + exits
    if (total === 0)
      return { metric: '팀 이직률', score: 0, rawData: null, available: false }

    const rate = exits / total
    const score = rate > 0.3 ? 90 : rate > 0.2 ? 70 : rate > 0.1 ? 40 : 0

    return {
      metric: '팀 이직률',
      score,
      rawData: { exits, current, rate: Math.round(rate * 100) },
      available: true,
    }
  } catch {
    return { metric: '팀 이직률', score: 0, rawData: null, available: false }
  }
}

// 3. 팀 연차 사용률
async function calcTeamLeaveUsage(memberIds: string[]): Promise<TeamHealthMetric> {
  if (memberIds.length === 0)
    return { metric: '팀 연차 사용률', score: 0, rawData: null, available: false }
  try {
    const currentYear = new Date().getFullYear()
    const balances = await prisma.employeeLeaveBalance.findMany({
      where: { employeeId: { in: memberIds }, year: currentYear },
    })
    if (balances.length === 0)
      return { metric: '팀 연차 사용률', score: 0, rawData: null, available: false }

    const totalGranted = balances.reduce((s, b) => s + Number(b.grantedDays), 0)
    const totalUsed = balances.reduce((s, b) => s + Number(b.usedDays), 0)
    const usageRate = totalGranted > 0 ? totalUsed / totalGranted : 0

    // 낮은 사용률 = 높은 위험
    const score = usageRate < 0.2 ? 85 : usageRate < 0.4 ? 55 : usageRate < 0.6 ? 25 : 0

    return {
      metric: '팀 연차 사용률',
      score,
      rawData: { totalGranted, totalUsed, usageRate: Math.round(usageRate * 100) },
      available: true,
    }
  } catch {
    return { metric: '팀 연차 사용률', score: 0, rawData: null, available: false }
  }
}

// 4. 팀 초과근무 분산도 (편차가 크면 특정 인원 집중 → 위험)
async function calcTeamOvertimeVariance(memberIds: string[]): Promise<TeamHealthMetric> {
  if (memberIds.length < 2)
    return { metric: '초과근무 분산도', score: 0, rawData: null, available: false }
  try {
    const alerts = await prisma.workHourAlert.findMany({
      where: {
        employeeId: { in: memberIds },
        createdAt: { gte: subMonths(new Date(), 3) },
      },
      select: { employeeId: true, alertLevel: true },
    })
    if (alerts.length === 0)
      return { metric: '초과근무 분산도', score: 0, rawData: null, available: false }

    // 팀원별 알림 수 집계
    const countByMember: Record<string, number> = {}
    for (const id of memberIds) countByMember[id] = 0
    for (const a of alerts) {
      countByMember[a.employeeId] = (countByMember[a.employeeId] ?? 0) + 1
    }

    const counts = Object.values(countByMember)
    const avg = counts.reduce((s, v) => s + v, 0) / counts.length
    const variance =
      counts.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / counts.length
    const stdDev = Math.sqrt(variance)

    // 높은 표준편차 = 특정인 집중 = 위험
    const score = stdDev > 5 ? 85 : stdDev > 3 ? 60 : stdDev > 1.5 ? 30 : 0

    return {
      metric: '초과근무 분산도',
      score,
      rawData: { avgAlerts: Math.round(avg * 10) / 10, stdDev: Math.round(stdDev * 10) / 10 },
      available: true,
    }
  } catch {
    return { metric: '초과근무 분산도', score: 0, rawData: null, available: false }
  }
}

// 5. 부서 퇴직자 만족도 (ExitInterview.overallSatisfaction 평균)
async function calcTeamExitSatisfaction(departmentId: string): Promise<TeamHealthMetric> {
  try {
    // 퇴직한 직원의 마지막 assignment departmentId 기준
    const exitInterviews = await prisma.exitInterview.findMany({
      where: {
        interviewDate: { gte: subMonths(new Date(), 12) },
        employee: {
          assignments: {
            some: { departmentId, isPrimary: true },
          },
        },
      },
      select: { satisfactionScore: true },
    })
    if (exitInterviews.length === 0)
      return { metric: '퇴직자 만족도', score: 0, rawData: null, available: false }

    const avg =
      exitInterviews.reduce((s: number, e) => s + Number(e.satisfactionScore ?? 0), 0) /
      exitInterviews.length

    // satisfactionScore: 1~10 (낮은 만족 = 높은 위험)
    const score = avg < 5 ? 90 : avg < 6 ? 65 : avg < 7 ? 35 : 0

    return {
      metric: '퇴직자 만족도',
      score,
      rawData: { count: exitInterviews.length, avgSatisfaction: Math.round(avg * 10) / 10 },
      available: true,
    }
  } catch {
    return { metric: '퇴직자 만족도', score: 0, rawData: null, available: false }
  }
}

// ─── 메인 계산 함수 ────────────────────────────────────────

export async function calculateTeamHealth(
  departmentId: string,
  companyId: string
): Promise<TeamHealthResult> {
  const memberIds = await getTeamMembers(departmentId)

  const [sentiment, turnoverRate, leaveUsage, overtimeVariance, exitSatisfaction] =
    await Promise.all([
      calcTeamAvgSentiment(memberIds),
      calcTeamTurnoverRate(departmentId),
      calcTeamLeaveUsage(memberIds),
      calcTeamOvertimeVariance(memberIds),
      calcTeamExitSatisfaction(departmentId),
    ])

  const metrics = [sentiment, turnoverRate, leaveUsage, overtimeVariance, exitSatisfaction]
  const available = metrics.filter((m) => m.available)

  if (available.length === 0) {
    return { overallScore: 0, riskLevel: 'low', metrics, memberCount: memberIds.length }
  }

  // 균등 가중치 (각 지표 동일 비중)
  const overallScore = Math.round(
    available.reduce((s, m) => s + m.score, 0) / available.length
  )

  const riskLevel =
    overallScore >= 70
      ? 'critical'
      : overallScore >= 50
      ? 'high'
      : overallScore >= 30
      ? 'medium'
      : 'low'

  return { overallScore, riskLevel, metrics, memberCount: memberIds.length }
}
