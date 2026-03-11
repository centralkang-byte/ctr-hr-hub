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
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const page = Number(p.page ?? 1)
    const limit = Number(p.limit ?? 20)
    const status = p.status as 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | undefined
    const companyId =
      user.role === 'SUPER_ADMIN' ? (p.companyId ?? undefined) : user.companyId

    const where: Prisma.EmployeeOffboardingWhereInput = {
      ...(status
        ? { status }
        : {
          status: {
            in: ['IN_PROGRESS', 'COMPLETED'],
          },
        }),
      ...(companyId
        ? {
          employee: {
            assignments: { some: { companyId, isPrimary: true, endDate: null } },
          },
        }
        : {}),
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
      if (!ob.exitInterviewCompleted && ob.status === 'IN_PROGRESS') exitInterviewPending++
      resignTypeBreakdown[ob.resignType] = (resignTypeBreakdown[ob.resignType] ?? 0) + 1

      return {
        ...ob,
        progress: { total: totalTasks, completed, blocked },
        daysUntil,
        isD7,
        isD3,
      }
    })

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
    })
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
