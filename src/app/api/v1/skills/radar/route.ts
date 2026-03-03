// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 개인 역량 레이더 차트 데이터 API (B8-3)
// ═══════════════════════════════════════════════════════════
//
// GET /api/v1/skills/radar?employeeId=xxx&period=2025-H1

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') ?? 'latest'
    const canViewOthers = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)
    const employeeId = canViewOthers
      ? (searchParams.get('employeeId') ?? user.employeeId)
      : user.employeeId

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: { jobGrade: { select: { code: true, name: true } } },
        },
        skillAssessments: {
          where: { assessmentPeriod: period },
          include: {
            competency: {
              select: {
                id: true,
                name: true,
                code: true,
                category: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
    })

    const grade = employee?.assignments?.[0]?.jobGrade?.code ?? ''

    // 역량 요건
    const requirements = await prisma.competencyRequirement.findMany({
      where: {
        OR: [{ companyId: user.companyId }, { companyId: null }],
        jobLevelCode: grade || undefined,
      },
      include: {
        competency: {
          select: {
            id: true,
            name: true,
            code: true,
            category: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })

    const reqMap = new Map(requirements.map((r) => [r.competencyId, r.expectedLevel]))
    const assessmentMap = new Map(
      employee?.skillAssessments.map((a) => [a.competencyId, a]) ?? [],
    )

    // 레이더 차트: 카테고리별로 그룹 (핵심가치 / 리더십 / 직무전문)
    // 역량이 많으면 읽기 어려우므로 최대 8개만
    const allCompetencies = requirements.map((r) => r.competency)
    const radarCompetencies = allCompetencies.slice(0, 8)

    const radarData = radarCompetencies.map((c) => {
      const assessment = assessmentMap.get(c.id)
      const expectedLevel = reqMap.get(c.id) ?? null
      const actualLevel = assessment?.finalLevel ?? assessment?.selfLevel ?? null

      return {
        competencyId: c.id,
        name: c.name,
        category: c.category,
        expectedLevel: expectedLevel ?? 0,
        actualLevel: actualLevel ?? 0,
        selfLevel: assessment?.selfLevel ?? null,
        managerLevel: assessment?.managerLevel ?? null,
        gap: expectedLevel != null && actualLevel != null ? expectedLevel - actualLevel : null,
      }
    })

    // 갭 요약
    const gaps = radarData.filter((r) => r.gap !== null)
    const criticalGaps = gaps.filter((r) => (r.gap ?? 0) > 0).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
    const strengths = gaps.filter((r) => (r.gap ?? 0) < 0).sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0))

    return apiSuccess({
      employee: employee
        ? {
            id: employee.id,
            name: employee.name,
            nameEn: employee.nameEn,
            grade,
          }
        : null,
      period,
      radarData,
      summary: {
        criticalGaps: criticalGaps.slice(0, 3).map((r) => ({
          competencyId: r.competencyId,
          name: r.name,
          expectedLevel: r.expectedLevel,
          actualLevel: r.actualLevel,
          gap: r.gap,
        })),
        strengths: strengths.slice(0, 3).map((r) => ({
          competencyId: r.competencyId,
          name: r.name,
          expectedLevel: r.expectedLevel,
          actualLevel: r.actualLevel,
          gap: r.gap,
        })),
        overallProgress:
          gaps.length > 0
            ? Math.round(
                (gaps.filter((r) => (r.gap ?? 0) <= 0).length / gaps.length) * 100,
              )
            : 0,
      },
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
