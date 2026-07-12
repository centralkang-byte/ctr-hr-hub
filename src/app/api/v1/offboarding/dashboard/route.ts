// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/offboarding/dashboard
// 퇴직처리 현황 대시보드: 진행률 + D-day 경고 + E-2 통계 확장
// B5 강화: 법인 필터 (SUPER_ADMIN) + blocked count + exit interview pending
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { buildPagination } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { resolveCompanyFilter } from '@/lib/api/companyFilter'
import type { SessionUser } from '@/types'
import { getActiveTeamMemberIds, OFFBOARDING_TEAM_STATUSES } from '@/lib/employee/direct-reports'
import { ROLE } from '@/lib/constants'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const page = Number(p.page ?? 1)
    const limit = Number(p.limit ?? 20)
    const status = p.status as 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | undefined
    // 테넌트 스코핑 = EmployeeOffboarding.companyId 직접 (active-assignment 조인은 완료 시 탈락 — "완료" 탭 0건 버그)
    const companyFilter = resolveCompanyFilter(user, p.companyId ?? null)

    // ⑥-C PR-2: MANAGER(비-HR/비-SUPER)는 직속부하 오프보딩만 — 모든 집계의 단일 base 필터 (Codex G1-5)
    const isHrOrSuper = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN
    const teamScope: Prisma.EmployeeOffboardingWhereInput = isHrOrSuper
      ? {}
      : { employeeId: { in: await getActiveTeamMemberIds(user.employeeId, user.companyId, OFFBOARDING_TEAM_STATUSES) } }

    const where: Prisma.EmployeeOffboardingWhereInput = {
      ...(status
        ? { status }
        : {
          status: {
            in: ['IN_PROGRESS', 'COMPLETED'],
          },
        }),
      ...companyFilter,
      ...teamScope,
    }

    const include = {
      employee: {
        select: { id: true, name: true },
      },
      checklist: { select: { id: true, name: true } },
      offboardingTasks: {
        include: {
          task: { select: { isRequired: true, title: true, assigneeType: true, dueDaysBefore: true } },
        },
      },
    } as const

    const [total, offboardings] = await Promise.all([
      prisma.employeeOffboarding.count({ where }),
      prisma.employeeOffboarding.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const now = Date.now()

    // E-2: Compute summary statistics
    let totalBlocked = 0
    let totalUrgent = 0
    let exitInterviewPending = 0
    const resignTypeBreakdown: Record<string, number> = {}

    const enriched = offboardings.map((ob) => {
      const totalTasks = ob.offboardingTasks.length
      const completed = ob.offboardingTasks.filter((t) => t.status === 'DONE').length
      const blocked = ob.offboardingTasks.filter((t) => t.status === 'BLOCKED').length

      const daysUntil = Math.ceil(
        (new Date(ob.lastWorkingDate).getTime() - now) / 86400000,
      )
      const isD7 = daysUntil <= 7
      const isD3 = daysUntil <= 3

      // Aggregate summary stats
      totalBlocked += blocked
      if (isD7 && ob.status === 'IN_PROGRESS') totalUrgent++
      if (!ob.isExitInterviewCompleted && ob.status === 'IN_PROGRESS') exitInterviewPending++
      resignTypeBreakdown[ob.resignType] = (resignTypeBreakdown[ob.resignType] ?? 0) + 1

      return {
        ...ob,
        progress: { total: totalTasks, completed, blocked },
        daysUntil,
        isD7,
        isD3,
      }
    })

    // ── Analytics: 퇴직 원인 분석 + 트렌드 ────────────────
    // ExitInterview·EmployeeOffboarding 모두 companyId 직접 보유 — historical-assignment 조인 제거
    const companyWhere = companyFilter

    // ⑥-C PR-2: analytics 블록은 HR/SUPER 전용 — exit interview 파생 지표(사유·만족도)는
    // 매니저 비공개 정책([id]/exit-interview 가드와 일관) + 회사 전체 재직기간/트렌드 유출 방지.
    if (!isHrOrSuper) {
      const { NextResponse } = await import('next/server')
      return NextResponse.json({
        data: enriched,
        pagination: buildPagination(page, limit, total),
        summary: {
          totalBlocked,
          totalUrgent,
          exitInterviewPending,
          resignTypeBreakdown,
        },
        analytics: null,
      })
    }

    // 이직 원인 분석 (ExitInterview.primaryReason groupBy)
    const exitReasonGroups = await prisma.exitInterview.groupBy({
      by: ['primaryReason'],
      where: { ...companyWhere as Prisma.ExitInterviewWhereInput },
      _count: { id: true },
    })

    const exitReasonBreakdown = exitReasonGroups.map((g) => ({
      reason: g.primaryReason,
      count: g._count.id,
    }))

    // Would Recommend 비율
    const [recommendYes, recommendTotal] = await Promise.all([
      prisma.exitInterview.count({
        where: { wouldRecommend: true, ...companyWhere as Prisma.ExitInterviewWhereInput },
      }),
      prisma.exitInterview.count({
        where: { wouldRecommend: { not: null }, ...companyWhere as Prisma.ExitInterviewWhereInput },
      }),
    ])

    // 평균 만족도
    const satisfactionAgg = await prisma.exitInterview.aggregate({
      where: { ...companyWhere as Prisma.ExitInterviewWhereInput },
      _avg: { satisfactionScore: true },
      _count: { satisfactionScore: true },
    })

    // 평균 재직기간 (COMPLETED offboardings)
    const completedOffboardings = await prisma.employeeOffboarding.findMany({
      where: { status: 'COMPLETED', ...companyWhere },
      select: {
        lastWorkingDate: true,
        employee: { select: { hireDate: true } },
      },
      take: 500,
    })

    let avgTenureDays = 0
    if (completedOffboardings.length > 0) {
      const totalDays = completedOffboardings.reduce((sum, ob) => {
        if (!ob.employee?.hireDate) return sum
        const diff = (ob.lastWorkingDate.getTime() - ob.employee.hireDate.getTime()) / 86_400_000
        return sum + Math.max(0, diff)
      }, 0)
      avgTenureDays = Math.round(totalDays / completedOffboardings.length)
    }

    // 월별 퇴직 트렌드 (최근 12개월)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const monthlyOffboardings = await prisma.employeeOffboarding.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: twelveMonthsAgo },
        ...companyWhere,
      },
      select: { completedAt: true, resignType: true },
    })

    const monthlyTrend: Record<string, { total: number; voluntary: number; involuntary: number }> = {}
    for (const ob of monthlyOffboardings) {
      if (!ob.completedAt) continue
      const key = `${ob.completedAt.getFullYear()}-${String(ob.completedAt.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyTrend[key]) monthlyTrend[key] = { total: 0, voluntary: 0, involuntary: 0 }
      monthlyTrend[key].total++
      if (ob.resignType === 'VOLUNTARY') monthlyTrend[key].voluntary++
      else monthlyTrend[key].involuntary++
    }

    const { NextResponse } = await import('next/server')
    return NextResponse.json({
      data: enriched,
      pagination: buildPagination(page, limit, total),
      summary: {
        totalBlocked,
        totalUrgent,
        exitInterviewPending,
        resignTypeBreakdown,
      },
      analytics: {
        exitReasonBreakdown,
        wouldRecommendRate: recommendTotal > 0
          ? Math.round((recommendYes / recommendTotal) * 100)
          : null,
        avgSatisfactionScore: satisfactionAgg._avg?.satisfactionScore
          ? Math.round(satisfactionAgg._avg.satisfactionScore * 10) / 10
          : null,
        exitInterviewCount: typeof satisfactionAgg._count === 'object' ? satisfactionAgg._count.satisfactionScore : 0,
        avgTenureDays,
        avgTenureYears: avgTenureDays > 0 ? Math.round((avgTenureDays / 365) * 10) / 10 : 0,
        monthlyTrend,
        completedCount: completedOffboardings.length,
      },
    })
  },
  perm(MODULE.OFFBOARDING, ACTION.VIEW),
)
