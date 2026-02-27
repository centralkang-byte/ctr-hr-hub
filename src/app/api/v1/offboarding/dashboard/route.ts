// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/offboarding/dashboard
// 퇴직처리 현황 대시보드: 진행률 + D-day 경고
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { apiPaginated, buildPagination } from '@/lib/api'
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
      employee: { ...(companyId ? { companyId } : {}) },
    }

    const include = {
      employee: {
        select: { id: true, name: true, companyId: true },
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

    const enriched = offboardings.map((ob) => {
      const totalTasks = ob.offboardingTasks.length
      const completed = ob.offboardingTasks.filter((t) => t.status === 'DONE').length

      const daysUntil = Math.ceil(
        (new Date(ob.lastWorkingDate).getTime() - now) / 86400000,
      )
      const isD7 = daysUntil <= 7
      const isD3 = daysUntil <= 3

      return {
        ...ob,
        progress: { total: totalTasks, completed },
        daysUntil,
        isD7,
        isD3,
      }
    })

    return apiPaginated(enriched, buildPagination(page, limit, total))
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
