// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/recruitment/positions/vacancies
// B4 + A2: 공석 현황 대시보드 데이터
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId') ?? undefined

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? companyId ? { companyId } : {}
        : { companyId: user.companyId ?? '' }

    // 전체 공석 포지션 (isFilled = false)
    const vacancies = await prisma.position.findMany({
      where: {
        isFilled: false,
        ...companyFilter,
      },
      select: {
        id: true,
        code: true,
        titleKo: true,
        isFilled: true,
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true } },
        // 연결된 공고 (현재 진행 중인 것)
        jobPostings: {
          where: { status: { in: ['OPEN', 'DRAFT'] }, deletedAt: null },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            _count: { select: { applications: true } },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [
        { companyId: 'asc' },
        { code: 'asc' },
      ],
    })

    // 법인별 집계
    const byCompany: Record<string, {
      companyId: string
      companyName: string
      total: number
      withActivePosting: number
      withoutPosting: number
    }> = {}

    for (const pos of vacancies) {
      const cId = pos.company.id
      if (!byCompany[cId]) {
        byCompany[cId] = {
          companyId: cId,
          companyName: pos.company.name,
          total: 0,
          withActivePosting: 0,
          withoutPosting: 0,
        }
      }
      byCompany[cId].total++
      if (pos.jobPostings.length > 0) {
        byCompany[cId].withActivePosting++
      } else {
        byCompany[cId].withoutPosting++
      }
    }

    // 채용 완료된 포지션 (isFilled = true) — 최근 30일
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentlyFilled = await prisma.position.count({
      where: {
        isFilled: true,
        ...companyFilter,
        updatedAt: { gte: thirtyDaysAgo },
      },
    })

    // 평균 채용 소요일 (HIRED 된 applications 기준)
    const hiredApps = await prisma.application.findMany({
      where: {
        stage: 'HIRED',
        posting: {
          ...companyFilter,
          positionId: { not: null },
        },
        appliedAt: { gte: thirtyDaysAgo },
      },
      select: {
        appliedAt: true,
        updatedAt: true,
      },
      take: 100,
    })

    const avgFillDays =
      hiredApps.length > 0
        ? Math.round(
            hiredApps.reduce((sum, app) => {
              const days =
                (app.updatedAt.getTime() - app.appliedAt.getTime()) /
                (1000 * 60 * 60 * 24)
              return sum + days
            }, 0) / hiredApps.length,
          )
        : null

    return apiSuccess({
      summary: {
        totalVacancies: vacancies.length,
        withActivePosting: vacancies.filter((v) => v.jobPostings.length > 0).length,
        withoutPosting: vacancies.filter((v) => v.jobPostings.length === 0).length,
        recentlyFilled,
        avgFillDays,
      },
      byCompany: Object.values(byCompany),
      vacancies: vacancies.map((v) => ({
        id: v.id,
        code: v.code,
        titleKo: v.titleKo,
        companyId: v.company.id,
        companyName: v.company.name,
        departmentName: v.department?.name ?? null,
        gradeName: v.jobGrade?.name ?? null,
        hasActivePosting: v.jobPostings.length > 0,
        posting: v.jobPostings[0] ?? null,
      })),
    })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)
