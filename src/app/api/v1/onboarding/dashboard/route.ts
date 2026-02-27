// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/dashboard
// 온보딩 현황 대시보드: 진행률 + 지연 여부
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { apiPaginated, buildPagination } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser, OnboardingProgressStatus } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const page = Number(p.page ?? 1)
    const limit = Number(p.limit ?? 20)
    const status = p.status as OnboardingProgressStatus | undefined
    const companyId =
      user.role === 'SUPER_ADMIN' ? (p.companyId ?? undefined) : user.companyId

    const where: Prisma.EmployeeOnboardingWhereInput = {
      ...(status
        ? { status }
        : {
            status: {
              in: ['IN_PROGRESS', 'COMPLETED'] as OnboardingProgressStatus[],
            },
          }),
      employee: { ...(companyId ? { companyId } : {}) },
    }

    const include = {
      employee: {
        select: { id: true, name: true, hireDate: true, companyId: true },
      },
      buddy: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
      tasks: {
        include: {
          task: { select: { isRequired: true, dueDaysAfter: true } },
        },
      },
    } as const

    const [total, onboardings] = await Promise.all([
      prisma.employeeOnboarding.count({ where }),
      prisma.employeeOnboarding.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const enriched = onboardings.map((ob) => {
      const totalTasks = ob.tasks.length
      const completed = ob.tasks.filter((t) => t.status === 'DONE').length
      const now = new Date()
      const isDelayed = ob.tasks.some((t) => {
        if (t.status === 'DONE') return false
        const dueDate = ob.startedAt
          ? new Date(ob.startedAt.getTime() + t.task.dueDaysAfter * 86400000)
          : null
        return dueDate ? dueDate < now : false
      })
      return { ...ob, progress: { total: totalTasks, completed }, isDelayed }
    })

    return apiPaginated(enriched, buildPagination(page, limit, total))
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
