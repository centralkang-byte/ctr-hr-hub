// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Weekly Digest Data Generator
// HR 주간 통계 집계: 신규입사/휴가/평가/이탈위험
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export interface DigestData {
  weekRange: string
  newHires: number
  onLeave: number
  pendingEvals: number
  attritionRisks: number
  pendingApprovals: number
  highlights: string[]
}

export async function generateDigestData(
  companyId: string,
): Promise<DigestData> {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const weekRange = `${weekStart.toISOString().slice(0, 10)} ~ ${weekEnd.toISOString().slice(0, 10)}`

  const [
    newHires,
    onLeave,
    pendingEvals,
    attritionRisks,
    pendingApprovals,
  ] = await Promise.all([
    // 이번 주 신규 입사
    prisma.employee.count({
      where: {
        hireDate: { gte: weekStart, lte: weekEnd },
        deletedAt: null,
        assignments: {
          some: { companyId, isPrimary: true, endDate: null },
        },
      },
    }),

    // 현재 휴가 중인 직원
    prisma.leaveRequest.count({
      where: {
        employee: {
          assignments: {
            some: { companyId, isPrimary: true, endDate: null },
          },
        },
        status: 'APPROVED',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    }),

    // 미완료 평가 (DRAFT = 아직 미제출)
    prisma.performanceEvaluation.count({
      where: {
        companyId,
        status: 'DRAFT',
      },
    }),

    // 이탈 위험 직원 (점수 70 이상)
    prisma.employee.count({
      where: {
        attritionRiskScore: { gte: 70 },
        deletedAt: null,
        assignments: {
          some: {
            companyId,
            status: 'ACTIVE',
            isPrimary: true,
            endDate: null,
          },
        },
      },
    }),

    // 대기 중인 휴가 승인
    prisma.leaveRequest.count({
      where: {
        employee: {
          assignments: {
            some: { companyId, isPrimary: true, endDate: null },
          },
        },
        status: 'PENDING',
      },
    }),
  ])

  const highlights: string[] = []
  if (newHires > 0) highlights.push(`이번 주 ${newHires}명 신규 입사`)
  if (attritionRisks > 0)
    highlights.push(`이탈 위험 직원 ${attritionRisks}명 — 면담 필요`)
  if (pendingApprovals > 5)
    highlights.push(`미처리 휴가 승인 ${pendingApprovals}건`)
  if (pendingEvals > 0)
    highlights.push(`미완료 평가 ${pendingEvals}건`)

  return {
    weekRange,
    newHires,
    onLeave,
    pendingEvals,
    attritionRisks,
    pendingApprovals,
    highlights,
  }
}
