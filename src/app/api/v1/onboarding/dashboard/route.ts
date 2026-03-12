// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/dashboard
// 온보딩 현황 대시보드: 진행률 + 지연 여부 + 감정 펄스
// B5 강화: 법인 필터, planType 필터, 감정 체크인 포함
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
    const planType = p.planType as string | undefined
    // SUPER_ADMIN은 법인 필터 선택 가능, 그 외는 소속 법인으로 제한
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
      ...(planType ? { planType: planType as any // eslint-disable-line @typescript-eslint/no-explicit-any -- enum compatibility } : {}),
      ...(companyId
        ? {
            OR: [
              { companyId },
              { employee: { assignments: { some: { companyId, isPrimary: true, endDate: null } } } },
            ],
          }
        : {}),
    }

    const include = {
      employee: {
        select: { id: true, name: true, hireDate: true },
      },
      buddy: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, planType: true } },
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

    // 감정 체크인: 각 직원의 최신 1건 조회
    const employeeIds = [...new Set(onboardings.map((o) => o.employeeId))]
    const latestCheckins =
      employeeIds.length > 0
        ? await prisma.onboardingCheckin.findMany({
            where: { employeeId: { in: employeeIds } },
            orderBy: { submittedAt: 'desc' },
            distinct: ['employeeId'],
            select: { employeeId: true, mood: true, energy: true, belonging: true, submittedAt: true },
          })
        : []
    const checkinMap = Object.fromEntries(latestCheckins.map((c) => [c.employeeId, c]))

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
      const emotionPulse = checkinMap[ob.employeeId] ?? null
      return { ...ob, progress: { total: totalTasks, completed }, isDelayed, emotionPulse }
    })

    return apiPaginated(enriched, buildPagination(page, limit, total))
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
