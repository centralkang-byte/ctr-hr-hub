// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Training (B9-1 LMS Lite)
// ═══════════════════════════════════════════════════════════
//
// GET /api/v1/training/my
// 내 교육 현황: 필수 미이수 + 추천 + 이수이력

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import type { SessionUser } from '@/types'

export const GET = withAuth(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const employeeId = user.employeeId
    const companyId = user.companyId

    // 1. 필수 미이수 과정 (mandatory_auto 등록 + ENROLLED/IN_PROGRESS 상태)
    const requiredPending = await prisma.trainingEnrollment.findMany({
      where: {
        employeeId,
        status: { in: ['ENROLLED', 'IN_PROGRESS'] },
        course: { isMandatory: true, deletedAt: null },
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            category: true,
            format: true,
            durationHours: true,
            validityMonths: true,
            provider: true,
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
    })

    // 2. 직무 필수 과정 (mandatory=true이지만 아직 미등록)
    const enrolledCourseIds = new Set(
      (await prisma.trainingEnrollment.findMany({
        where: { employeeId },
        select: { courseId: true },
      })).map((e) => e.courseId),
    )

    const jobRequiredCourses = await prisma.trainingCourse.findMany({
      where: {
        isMandatory: true,
        deletedAt: null,
        OR: [{ companyId }, { companyId: null }],
        id: { notIn: [...enrolledCourseIds] },
      },
      select: {
        id: true,
        code: true,
        title: true,
        category: true,
        format: true,
        durationHours: true,
        provider: true,
      },
    })

    // 3. 이수 완료 이력 (최근 순)
    const completedHistory = await prisma.trainingEnrollment.findMany({
      where: {
        employeeId,
        status: 'ENROLLMENT_COMPLETED',
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            category: true,
            isMandatory: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    })

    // 4. 만료 임박 (30일 이내)
    const thirtyDaysLater = new Date()
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)
    const expiringSoon = await prisma.trainingEnrollment.findMany({
      where: {
        employeeId,
        status: 'ENROLLMENT_COMPLETED',
        expiresAt: { gte: new Date(), lte: thirtyDaysLater },
      },
      include: {
        course: { select: { id: true, title: true, code: true } },
      },
      orderBy: { expiresAt: 'asc' },
    })

    // 5. 스킬 갭 추천 (간소화 — competencyId 리스트만)
    const assessments = await prisma.employeeSkillAssessment.findMany({
      where: { employeeId },
      select: { competencyId: true, currentLevel: true },
    })

    const requirements = await prisma.competencyRequirement.findMany({
      where: {
        OR: [{ companyId }, { companyId: null }],
      },
      select: { competencyId: true, expectedLevel: true, competency: { select: { name: true } } },
    })

    const assessmentMap = new Map(assessments.map((a) => [a.competencyId, a.currentLevel]))
    const gapCompetencyIds = requirements
      .filter((r) => (assessmentMap.get(r.competencyId) ?? 0) < r.expectedLevel)
      .map((r) => r.competencyId)

    const recommendedCourses = gapCompetencyIds.length > 0
      ? await prisma.trainingCourse.findMany({
          where: {
            deletedAt: null,
            OR: [{ companyId }, { companyId: null }],
            id: { notIn: [...enrolledCourseIds] },
          },
          select: {
            id: true,
            code: true,
            title: true,
            category: true,
            format: true,
            durationHours: true,
            linkedCompetencyIds: true,
            expectedLevelGain: true,
            provider: true,
          },
          take: 5,
        }).then((courses) =>
          courses
            .filter((c) => c.linkedCompetencyIds.some((cid) => gapCompetencyIds.includes(cid)))
            .map((c) => ({ ...c, durationHours: c.durationHours ? Number(c.durationHours) : null })),
        )
      : []

    return apiSuccess({
      requiredPending: requiredPending.map((e) => ({
        enrollmentId: e.id,
        status: e.status,
        source: e.source,
        expiresAt: e.expiresAt,
        enrolledAt: e.enrolledAt,
        course: {
          ...e.course,
          durationHours: e.course.durationHours ? Number(e.course.durationHours) : null,
        },
      })),
      jobRequired: jobRequiredCourses.map((c) => ({
        ...c,
        durationHours: c.durationHours ? Number(c.durationHours) : null,
      })),
      recommended: recommendedCourses,
      history: completedHistory.map((e) => ({
        enrollmentId: e.id,
        completedAt: e.completedAt,
        expiresAt: e.expiresAt,
        score: e.score ? Number(e.score) : null,
        course: e.course,
      })),
      expiringSoon: expiringSoon.map((e) => ({
        enrollmentId: e.id,
        expiresAt: e.expiresAt,
        course: e.course,
      })),
    })
  },
)
