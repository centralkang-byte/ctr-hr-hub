// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Course Recommendations (B9-1 LMS Lite)
// ═══════════════════════════════════════════════════════════
//
// GET /api/v1/training/recommendations?employeeId=...
// 스킬 갭 기반 과정 추천
// B8-3 미완료 시 CompetencyRequirement.expectedLevel vs EmployeeSkillAssessment.currentLevel

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const url = req.nextUrl
    const employeeId = url.searchParams.get('employeeId') ?? user.employeeId

    // 1. 직원의 현재 역량 평가 조회 (B9-1: EmployeeSkillAssessment)
    const assessments = await prisma.employeeSkillAssessment.findMany({
      where: { employeeId },
      include: {
        competency: {
          select: { id: true, name: true, code: true, categoryId: true },
        },
      },
    })

    // 2. 직원의 직급/직무 정보 조회 (CompetencyRequirement 매칭용)
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: {
            jobGrade: { select: { code: true } },
            company: { select: { id: true } },
          },
        },
      },
    })

    const empPrimary = extractPrimaryAssignment(employee?.assignments ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobLevelCode = (empPrimary as any)?.jobGrade?.code ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyId = (empPrimary as any)?.company?.id ?? user.companyId

    // 3. 역량 요건 조회 (직급별 기대 레벨)
    const requirements = await prisma.competencyRequirement.findMany({
      where: {
        ...(jobLevelCode ? { jobLevelCode } : {}),
        OR: [{ companyId }, { companyId: null }],
      },
      include: {
        competency: { select: { id: true, name: true, code: true } },
      },
    })

    // 4. 스킬 갭 계산
    const assessmentMap = new Map(assessments.map((a) => [a.competencyId, a.currentLevel]))

    const gaps = requirements
      .map((req) => {
        const currentLevel = assessmentMap.get(req.competencyId) ?? 0
        const gap = req.expectedLevel - currentLevel
        return { competencyId: req.competencyId, competencyName: req.competency.name, currentLevel, expectedLevel: req.expectedLevel, gap }
      })
      .filter((g) => g.gap > 0)
      .sort((a, b) => b.gap - a.gap)

    // 5. 갭 해소 과정 추천 — 단일 배치 쿼리로 N+1 제거
    const allCompetencyIds = gaps.map((g) => g.competencyId)

    const [alreadyCompleted, allCourses] = await Promise.all([
      prisma.trainingEnrollment.findMany({
        where: { employeeId, status: 'ENROLLMENT_COMPLETED' },
        select: { courseId: true },
      }),
      prisma.trainingCourse.findMany({
        where: {
          linkedCompetencyIds: { hasSome: allCompetencyIds },
          deletedAt: null,
          OR: [{ companyId }, { companyId: null }],
        },
        select: {
          id: true,
          code: true,
          title: true,
          category: true,
          format: true,
          durationHours: true,
          expectedLevelGain: true,
          provider: true,
          linkedCompetencyIds: true,
        },
      }),
    ])
    const completedCourseIds = new Set(alreadyCompleted.map((e) => e.courseId))

    const recommendations = gaps.map((gap) => {
      const courses = allCourses
        .filter(
          (c) =>
            Array.isArray(c.linkedCompetencyIds) &&
            (c.linkedCompetencyIds as string[]).includes(gap.competencyId) &&
            !completedCourseIds.has(c.id),
        )
        .map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          category: c.category,
          format: c.format,
          durationHours: c.durationHours ? Number(c.durationHours) : null,
          expectedLevelGain: c.expectedLevelGain,
          provider: c.provider,
        }))

      return {
        competencyId: gap.competencyId,
        competencyName: gap.competencyName,
        currentLevel: gap.currentLevel,
        expectedLevel: gap.expectedLevel,
        gap: gap.gap,
        recommendedCourses: courses,
      }
    })

    return apiSuccess({
      employeeId,
      totalGaps: gaps.length,
      recommendations: recommendations.filter((r) => r.recommendedCourses.length > 0),
      noCoursesForGaps: recommendations.filter((r) => r.recommendedCourses.length === 0).map((r) => r.competencyName),
    })
  },
  perm(MODULE.TRAINING, ACTION.VIEW),
)
