// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 번아웃 감지 엔진
// 5개 지표 가중합 + 방어 코딩
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { subWeeks, subMonths, differenceInDays } from 'date-fns'

export interface BurnoutIndicator {
  indicator: string
  weight: number
  score: number
  rawData: Record<string, unknown> | null
  available: boolean
}

export interface BurnoutResult {
  overallScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  indicators: BurnoutIndicator[]
}

// ─── 기본 가중치 ──────────────────────────────────────────

const DEFAULT_BURNOUT_WEIGHTS: Record<string, number> = {
  overtime_intensity: 0.3,
  leave_non_usage: 0.2,
  sentiment_trend: 0.2,
  consecutive_work: 0.15,
  night_holiday_freq: 0.15,
}

async function loadBurnoutWeights(companyId: string): Promise<Record<string, number>> {
  try {
    const config = await prisma.analyticsConfig.findFirst({
      where: { companyId, configType: 'burnout_weights', isActive: true },
    })
    if (config?.config) {
      const c = config.config as { signals?: Array<{ key: string; weight: number }> }
      if (Array.isArray(c.signals)) {
        return Object.fromEntries(c.signals.map((s) => [s.key, s.weight]))
      }
    }
  } catch {
    // 기본값 사용
  }
  return { ...DEFAULT_BURNOUT_WEIGHTS }
}

// ─── 지표 계산 함수들 ─────────────────────────────────────

// 1. 초과근무 강도 (WorkHourAlert 기반)
async function calcOvertimeIntensity(employeeId: string, weight: number): Promise<BurnoutIndicator> {
  try {
    const alerts = await prisma.workHourAlert.findMany({
      where: { employeeId, createdAt: { gte: subWeeks(new Date(), 8) } },
      orderBy: { createdAt: 'desc' },
    })
    if (alerts.length === 0) {
      // 직접 출퇴근 기록에서 주간 총 시간 계산
      const attendances = await prisma.attendance.findMany({
        where: { employeeId, workDate: { gte: subWeeks(new Date(), 4) } },
        select: { clockIn: true, clockOut: true },
      })
      if (attendances.length === 0)
        return { indicator: '초과근무 강도', weight, score: 0, rawData: null, available: false }

      const totalMinutes = attendances.reduce((sum: number, a) => {
        if (!a.clockOut || !a.clockIn) return sum
        return sum + Math.abs((a.clockOut.getTime() - a.clockIn.getTime()) / 60000)
      }, 0)
      const avgWeeklyHours = attendances.length > 0 ? (totalMinutes / 60) / (attendances.length / 5) : 0
      const score = avgWeeklyHours > 52 ? 90 : avgWeeklyHours > 48 ? 70 : avgWeeklyHours > 44 ? 40 : 0
      return {
        indicator: '초과근무 강도',
        weight,
        score,
        rawData: { avgWeeklyHours: Math.round(avgWeeklyHours * 10) / 10 },
        available: true,
      }
    }

    const blockedCount = alerts.filter((a) => a.alertLevel === 'blocked').length
    const warningCount = alerts.filter((a) => a.alertLevel === 'warning').length
    const score = blockedCount >= 3 ? 90 : blockedCount >= 1 ? 70 : warningCount >= 3 ? 50 : warningCount >= 1 ? 30 : 0

    return {
      indicator: '초과근무 강도',
      weight,
      score,
      rawData: { alertCount: alerts.length, blockedCount, warningCount },
      available: true,
    }
  } catch {
    return { indicator: '초과근무 강도', weight, score: 0, rawData: null, available: false }
  }
}

// 2. 연차 미사용률
async function calcLeaveNonUsage(employeeId: string, weight: number): Promise<BurnoutIndicator> {
  try {
    const currentYear = new Date().getFullYear()
    const balances = await prisma.employeeLeaveBalance.findMany({
      where: { employeeId, year: currentYear },
    })
    if (balances.length === 0)
      return { indicator: '연차 미사용률', weight, score: 0, rawData: null, available: false }

    const totalGranted = balances.reduce((sum, b) => sum + Number(b.grantedDays), 0)
    const totalUsed = balances.reduce((sum, b) => sum + Number(b.usedDays), 0)
    const nonUsageRate = totalGranted > 0 ? 1 - totalUsed / totalGranted : 0

    const score = nonUsageRate > 0.8 ? 90 : nonUsageRate > 0.6 ? 65 : nonUsageRate > 0.4 ? 35 : 0
    return {
      indicator: '연차 미사용률',
      weight,
      score,
      rawData: { totalGranted, totalUsed, nonUsageRate: Math.round(nonUsageRate * 100) },
      available: true,
    }
  } catch {
    return { indicator: '연차 미사용률', weight, score: 0, rawData: null, available: false }
  }
}

// 3. 원온원 감정 추이 (최근 5회 감정 하락 추세)
async function calcSentimentTrend(employeeId: string, weight: number): Promise<BurnoutIndicator> {
  try {
    const recentOoo = await prisma.oneOnOne.findMany({
      where: { employeeId, status: 'COMPLETED', sentimentTag: { not: null } },
      orderBy: { scheduledAt: 'desc' },
      take: 5,
    })
    if (recentOoo.length < 2)
      return { indicator: '원온원 감정 추이', weight, score: 0, rawData: null, available: false }

    // 감정 태그 수치화
    const sentimentScore = (tag: string | null): number => {
      const normalized = (tag ?? '').toLowerCase()
      if (['positive', 'great'].includes(normalized)) return 5
      if (['good'].includes(normalized)) return 4
      if (['neutral', 'mixed'].includes(normalized)) return 3
      if (['negative', 'bad'].includes(normalized)) return 2
      if (['struggling', 'critical'].includes(normalized)) return 1
      return 3
    }

    const scores = recentOoo.map((o) => sentimentScore(o.sentimentTag))
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length
    const latestScore = scores[0]
    const trend = latestScore - (scores[scores.length - 1] ?? latestScore)

    const score = avgScore < 2.5 ? 85 : trend < -1.5 ? 70 : avgScore < 3 ? 50 : 0
    return {
      indicator: '원온원 감정 추이',
      weight,
      score,
      rawData: { avgScore: Math.round(avgScore * 10) / 10, latestScore, trend: Math.round(trend * 10) / 10 },
      available: true,
    }
  } catch {
    return { indicator: '원온원 감정 추이', weight, score: 0, rawData: null, available: false }
  }
}

// 4. 연속 근무일수
async function calcConsecutiveWorkDays(employeeId: string, weight: number): Promise<BurnoutIndicator> {
  try {
    const attendances = await prisma.attendance.findMany({
      where: { employeeId, workDate: { gte: subMonths(new Date(), 3) } },
      orderBy: { workDate: 'desc' },
      select: { workDate: true },
    })
    if (attendances.length === 0)
      return { indicator: '연속 근무일수', weight, score: 0, rawData: null, available: false }

    // 연속 근무일 계산
    let maxConsecutive = 0
    let current = 0
    let prevDay = ''

    for (const a of attendances) {
      const day = a.workDate.toISOString().split('T')[0]
      if (!day) continue
      if (day !== prevDay) {
        current = prevDay
          ? Math.abs(differenceInDays(new Date(day), new Date(prevDay))) === 1
            ? current + 1
            : 1
          : 1
        maxConsecutive = Math.max(maxConsecutive, current)
        prevDay = day
      }
    }

    const score = maxConsecutive >= 15 ? 90 : maxConsecutive >= 10 ? 65 : maxConsecutive >= 7 ? 35 : 0
    return {
      indicator: '연속 근무일수',
      weight,
      score,
      rawData: { maxConsecutive },
      available: true,
    }
  } catch {
    return { indicator: '연속 근무일수', weight, score: 0, rawData: null, available: false }
  }
}

// 5. 야간/휴일 근무 빈도
async function calcNightHolidayFrequency(employeeId: string, weight: number): Promise<BurnoutIndicator> {
  try {
    const attendances = await prisma.attendance.findMany({
      where: { employeeId, workDate: { gte: subMonths(new Date(), 3) } },
      select: { clockIn: true, clockOut: true, workType: true },
    })
    if (attendances.length === 0)
      return { indicator: '야간/휴일 근무 빈도', weight, score: 0, rawData: null, available: false }

    const nightOrHoliday = attendances.filter((a) =>
      ['NIGHT', 'HOLIDAY'].includes(a.workType ?? '')
    ).length
    const rate = nightOrHoliday / attendances.length
    const score = rate > 0.5 ? 90 : rate > 0.3 ? 60 : rate > 0.15 ? 30 : 0

    return {
      indicator: '야간/휴일 근무 빈도',
      weight,
      score,
      rawData: { totalDays: attendances.length, nightOrHoliday, rate: Math.round(rate * 100) },
      available: true,
    }
  } catch {
    return { indicator: '야간/휴일 근무 빈도', weight, score: 0, rawData: null, available: false }
  }
}

// ─── 메인 계산 함수 ────────────────────────────────────────

export async function calculateBurnoutScore(
  employeeId: string,
  companyId: string
): Promise<BurnoutResult> {
  const weights = await loadBurnoutWeights(companyId)

  const indicators = await Promise.all([
    calcOvertimeIntensity(employeeId, weights.overtime_intensity),
    calcLeaveNonUsage(employeeId, weights.leave_non_usage),
    calcSentimentTrend(employeeId, weights.sentiment_trend),
    calcConsecutiveWorkDays(employeeId, weights.consecutive_work),
    calcNightHolidayFrequency(employeeId, weights.night_holiday_freq),
  ])

  const availableIndicators = indicators.filter((i) => i.available)
  if (availableIndicators.length === 0) {
    return { overallScore: 0, riskLevel: 'low', indicators }
  }

  const totalWeight = availableIndicators.reduce((sum, i) => sum + i.weight, 0)
  const overallScore = availableIndicators.reduce((sum, i) => {
    const normalizedWeight = totalWeight > 0 ? i.weight / totalWeight : 0
    return sum + i.score * normalizedWeight
  }, 0)

  const riskLevel =
    overallScore >= 70 ? 'critical' : overallScore >= 50 ? 'high' : overallScore >= 30 ? 'medium' : 'low'

  return { overallScore: Math.round(overallScore), riskLevel, indicators }
}
