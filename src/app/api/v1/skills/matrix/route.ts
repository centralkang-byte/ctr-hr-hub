// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 스킬 매트릭스 API (B8-3)
// ═══════════════════════════════════════════════════════════
//
// GET /api/v1/skills/matrix  부서/법인 스킬 매트릭스 데이터

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') ?? 'latest'
    const departmentId = searchParams.get('departmentId')
    const companyId = searchParams.get('companyId') ?? user.companyId
    const categoryId = searchParams.get('categoryId') // 역량 카테고리 필터

    // 직원 목록 (부서 필터)
    const employees = await prisma.employee.findMany({
      where: {
        assignments: {
          some: {
            isPrimary: true,
            endDate: null,
            companyId,
            ...(departmentId ? { departmentId } : {}),
          },
        },
      },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            jobGrade: { select: { code: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
        skillAssessments: {
          where: { assessmentPeriod: period },
          select: {
            competencyId: true,
            selfLevel: true,
            managerLevel: true,
            finalLevel: true,
          },
        },
      },
      orderBy: [
        { assignments: { _count: 'asc' } },
        { name: 'asc' },
      ],
    })

    // 역량 목록
    const competencies = await prisma.competency.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        category: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { category: { displayOrder: 'asc' } },
        { displayOrder: 'asc' },
      ],
    })

    // 역량 요건 (모든 직급별)
    const requirements = await prisma.competencyRequirement.findMany({
      where: { OR: [{ companyId }, { companyId: null }] },
      select: { competencyId: true, expectedLevel: true, jobLevelCode: true },
    })
    // Map: competencyId + gradeCode → expectedLevel
    const reqMap = new Map(
      requirements.map((r) => [`${r.competencyId}_${r.jobLevelCode ?? ''}`, r.expectedLevel]),
    )

    // 매트릭스 구성
    const matrix = employees.map((emp) => {
      const empPrimary = extractPrimaryAssignment(emp.assignments ?? [])
      const grade = (empPrimary as Record<string, any>)?.jobGrade?.code ?? ''
      const assessmentMap = new Map(emp.skillAssessments.map((a) => [a.competencyId, a]))

      return {
        employee: {
          id: emp.id,
          name: emp.name,
          nameEn: emp.nameEn,
          grade,
          gradeLabel: (empPrimary as Record<string, any>)?.jobGrade?.name ?? '',
          department: (empPrimary as Record<string, any>)?.department,
        },
        scores: competencies.map((c) => {
          const assessment = assessmentMap.get(c.id)
          const expectedLevel = reqMap.get(`${c.id}_${grade}`) ?? null
          const finalLevel = assessment?.finalLevel ?? assessment?.selfLevel ?? null
          const gap = expectedLevel != null && finalLevel != null
            ? expectedLevel - finalLevel
            : null

          return {
            competencyId: c.id,
            finalLevel,
            selfLevel: assessment?.selfLevel ?? null,
            managerLevel: assessment?.managerLevel ?? null,
            expectedLevel,
            gap,
            // 색상 결정: 🔴 갭 -2이상, 🟡 -1~0, 🟢 +1이상, 🔵 5, ⬜ 미평가
            status:
              finalLevel === null
                ? 'unassessed'
                : finalLevel === 5
                  ? 'expert'
                  : gap === null
                    ? 'unassessed'
                    : gap >= 2
                      ? 'critical'
                      : gap === 1
                        ? 'below'
                        : gap === 0
                          ? 'meets'
                          : 'exceeds',
          }
        }),
      }
    })

    // 부서 평균 갭 집계
    const gapSummary = competencies.map((c) => {
      const gaps = matrix
        .map((row) => row.scores.find((s) => s.competencyId === c.id)?.gap)
        .filter((g): g is number => g !== null && g !== undefined)
      const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
      const assessed = matrix.filter(
        (row) => row.scores.find((s) => s.competencyId === c.id)?.finalLevel != null,
      ).length

      return {
        competencyId: c.id,
        competencyName: c.name,
        avgGap,
        assessed,
        total: matrix.length,
      }
    })

    const topGaps = [...gapSummary]
      .filter((s) => s.avgGap !== null)
      .sort((a, b) => (b.avgGap ?? 0) - (a.avgGap ?? 0))

    return apiSuccess({
      period,
      companyId,
      departmentId,
      competencies,
      matrix,
      summary: {
        totalEmployees: employees.length,
        topGaps: topGaps.slice(0, 5),
        topStrengths: topGaps.filter((s) => (s.avgGap ?? 0) < 0).slice(-5).reverse(),
        avgAssessmentRate:
          matrix.length > 0
            ? Math.round(
                (matrix.reduce(
                  (acc, row) =>
                    acc + row.scores.filter((s) => s.finalLevel !== null).length,
                  0,
                ) /
                  (matrix.length * competencies.length)) *
                  100,
              )
            : 0,
      },
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
