// src/app/api/v1/dashboard/summary/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

function activeAssignmentWhere(companyId: string | null) {
  return companyId
    ? { assignments: { some: { companyId, isPrimary: true, endDate: null, status: 'ACTIVE' } } }
    : { assignments: { some: { isPrimary: true, endDate: null, status: 'ACTIVE' } } }
}

async function countActiveEmployees(companyId: string | null) {
  const now = new Date()
  const count = await prisma.employeeAssignment.count({
    where: {
      isPrimary: true,
      endDate: null,
      status: 'ACTIVE',
      ...(companyId ? { companyId } : {}),
    },
  })
  let prevCount: number | null = null
  if (companyId) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const snap = await prisma.analyticsSnapshot.findFirst({
      where: {
        companyId,
        type: 'headcount',
        snapshotDate: { gte: lastMonth, lt: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
      orderBy: { snapshotDate: 'desc' },
    })
    if (snap) {
      prevCount = (snap.data as { count?: number })?.count ?? null
    }
  }
  return { count, prevCount, change: prevCount !== null ? count - prevCount : null }
}

async function calcTurnoverRate(companyId: string | null, year: number) {
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)
  const terminated = await prisma.employeeAssignment.count({
    where: {
      isPrimary: true,
      status: 'TERMINATED',
      endDate: { gte: start, lte: end },
      ...(companyId ? { companyId } : {}),
    },
  })
  const baseCount = await prisma.employeeAssignment.count({
    where: {
      isPrimary: true,
      effectiveDate: { lte: start },
      OR: [{ endDate: null }, { endDate: { gt: start } }],
      ...(companyId ? { companyId } : {}),
    },
  })
  if (baseCount === 0) return { rate: null, change: null }
  const rate = Math.round((terminated / baseCount) * 1000) / 10
  return { rate, change: null }
}

async function countOpenRequisitions(companyId: string | null) {
  try {
    const count = await prisma.requisition.count({
      where: { status: 'approved', ...(companyId ? { companyId } : {}) },
    })
    const hired = await prisma.application.findMany({
      where: {
        stage: 'HIRED',
        posting: companyId ? { requisition: { companyId } } : undefined,
      },
      select: { appliedAt: true, updatedAt: true },
      take: 100,
      orderBy: { updatedAt: 'desc' },
    })
    const avgDays =
      hired.length > 0
        ? Math.round(
            hired.reduce((sum, a) => {
              const days = Math.ceil(
                (a.updatedAt.getTime() - a.appliedAt.getTime()) / (1000 * 60 * 60 * 24)
              )
              return sum + days
            }, 0) / hired.length
          )
        : null
    return { count, avgDays }
  } catch {
    return null
  }
}

async function countHighRiskEmployees(companyId: string | null) {
  try {
    const scores = await prisma.turnoverRiskScore.findMany({
      where: {
        riskLevel: { in: ['high', 'critical'] },
        ...(companyId ? { employee: activeAssignmentWhere(companyId) } : {}),
      },
      distinct: ['employeeId'],
      orderBy: { calculatedAt: 'desc' },
      select: { employeeId: true, riskLevel: true },
    })
    return {
      count: scores.length,
      high: scores.filter((s) => s.riskLevel === 'high').length,
      critical: scores.filter((s) => s.riskLevel === 'critical').length,
    }
  } catch {
    return null
  }
}

async function calcAvgLeaveUsage(companyId: string | null, year: number) {
  try {
    const balances = await prisma.leaveYearBalance.findMany({
      where: {
        year,
        ...(companyId ? { employee: activeAssignmentWhere(companyId) } : {}),
        entitled: { gt: 0 },
      },
      select: { entitled: true, used: true },
    })
    if (balances.length === 0) return null
    const avgUsage =
      balances.reduce((sum, b) => sum + (b.entitled > 0 ? b.used / b.entitled : 0), 0) /
      balances.length
    return { rate: Math.round(avgUsage * 1000) / 10 }
  } catch {
    try {
      const balances = await prisma.employeeLeaveBalance.findMany({
        where: companyId ? { employee: activeAssignmentWhere(companyId) } : {},
        select: { grantedDays: true, usedDays: true },
      })
      if (balances.length === 0) return null
      const avgUsage =
        balances.reduce((sum, b) => {
          const granted = Number(b.grantedDays)
          const used = Number(b.usedDays)
          return sum + (granted > 0 ? used / granted : 0)
        }, 0) / balances.length
      return { rate: Math.round(avgUsage * 1000) / 10 }
    } catch {
      return null
    }
  }
}

async function calcTrainingCompletionRate(companyId: string | null, year: number) {
  try {
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31, 23, 59, 59)
    const [total, completed] = await Promise.all([
      prisma.trainingEnrollment.count({
        where: {
          enrolledAt: { gte: start, lte: end },
          ...(companyId ? { employee: activeAssignmentWhere(companyId) } : {}),
        },
      }),
      prisma.trainingEnrollment.count({
        where: {
          status: 'ENROLLMENT_COMPLETED',
          enrolledAt: { gte: start, lte: end },
          ...(companyId ? { employee: activeAssignmentWhere(companyId) } : {}),
        },
      }),
    ])
    if (total === 0) return null
    return { rate: Math.round((completed / total) * 1000) / 10, completed, total }
  } catch {
    return null
  }
}

export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const parsedYear = parseInt(searchParams.get('year') ?? '', 10)
    const year = !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : new Date().getFullYear()
    const requestedCompanyId = searchParams.get('companyId')
    const isGlobalRole =
      user.role === ROLE.SUPER_ADMIN || (user.role === ROLE.HR_ADMIN && !user.companyId)
    const companyId: string | null =
      requestedCompanyId === 'all' || (!requestedCompanyId && isGlobalRole)
        ? null
        : requestedCompanyId ?? user.companyId ?? null

    const [headcount, turnover, openPositions, riskCount, leaveUsage, trainingRate] =
      await Promise.allSettled([
        countActiveEmployees(companyId),
        calcTurnoverRate(companyId, year),
        countOpenRequisitions(companyId),
        countHighRiskEmployees(companyId),
        calcAvgLeaveUsage(companyId, year),
        calcTrainingCompletionRate(companyId, year),
      ])

    return apiSuccess({
      headcount: headcount.status === 'fulfilled' ? headcount.value : null,
      turnoverRate: turnover.status === 'fulfilled' ? turnover.value : null,
      openPositions: openPositions.status === 'fulfilled' ? openPositions.value : null,
      attritionRisk: riskCount.status === 'fulfilled' ? riskCount.value : null,
      leaveUsage: leaveUsage.status === 'fulfilled' ? leaveUsage.value : null,
      trainingCompletion: trainingRate.status === 'fulfilled' ? trainingRate.value : null,
      meta: { year, companyId },
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW)
)
