// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 스킬 갭 리포트 API (B8-3)
// ═══════════════════════════════════════════════════════════
//
// GET  /api/v1/skills/gap-report  부서/법인 스킬 갭 집계
// POST /api/v1/skills/gap-report  리포트 스냅샷 저장

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

const gapReportCreateSchema = z.object({
  companyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  assessmentPeriod: z.string().min(1, '평가 기간은 필수입니다.'),
  reportData: z.unknown(),
})

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') ?? 'latest'
    const companyId = searchParams.get('companyId') ?? user.companyId

    // 법인의 모든 직원 + 역량 평가
    const employees = await prisma.employee.findMany({
      where: {
        assignments: {
          some: { isPrimary: true, endDate: null, companyId },
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
            finalLevel: true,
            selfLevel: true,
            managerLevel: true,
          },
        },
      },
    })

    const competencies = await prisma.competency.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }],
    })

    const requirements = await prisma.competencyRequirement.findMany({
      where: { OR: [{ companyId }, { companyId: null }] },
      select: { competencyId: true, expectedLevel: true, jobLevelCode: true },
    })
    const reqMap = new Map(
      requirements.map((r) => [`${r.competencyId}_${r.jobLevelCode ?? ''}`, r.expectedLevel]),
    )

    // 역량별 갭 집계
    const competencyGaps = competencies.map((c) => {
      const gaps: number[] = []
      let assessed = 0

      for (const emp of employees) {
        const empPrimary = extractPrimaryAssignment(emp.assignments ?? [])
        const grade = (empPrimary as Record<string, any>)?.jobGrade?.code ?? ''
        const expectedLevel = reqMap.get(`${c.id}_${grade}`) ?? null
        const assessment = emp.skillAssessments.find((a) => a.competencyId === c.id)
        const finalLevel = assessment?.finalLevel ?? assessment?.selfLevel ?? null

        if (expectedLevel !== null && finalLevel !== null) {
          gaps.push(expectedLevel - finalLevel)
          assessed++
        }
      }

      const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null

      return {
        competencyId: c.id,
        competencyName: c.name,
        category: c.category,
        avgGap: avgGap !== null ? Math.round(avgGap * 10) / 10 : null,
        assessed,
        total: employees.length,
        assessmentRate: employees.length > 0 ? Math.round((assessed / employees.length) * 100) : 0,
      }
    })

    // 부서별 스킬 갭 히트맵
    const departments = [...new Set(
      employees.map((e) => extractPrimaryAssignment(e.assignments ?? [])?.department).filter(Boolean),
    )] as { id: string; name: string }[]

    const departmentMatrix = departments.map((dept) => {
      const deptEmployees = employees.filter(
        (e) => (extractPrimaryAssignment(e.assignments ?? []) as Record<string, any>)?.department?.id === dept.id,
      )

      const scores = competencies.map((c) => {
        const deptGaps: number[] = []
        for (const emp of deptEmployees) {
          const deptEmpPrimary = extractPrimaryAssignment(emp.assignments ?? [])
          const grade = (deptEmpPrimary as Record<string, any>)?.jobGrade?.code ?? ''
          const expectedLevel = reqMap.get(`${c.id}_${grade}`) ?? null
          const assessment = emp.skillAssessments.find((a) => a.competencyId === c.id)
          const finalLevel = assessment?.finalLevel ?? assessment?.selfLevel ?? null
          if (expectedLevel !== null && finalLevel !== null) {
            deptGaps.push(expectedLevel - finalLevel)
          }
        }
        const avgGap = deptGaps.length > 0
          ? Math.round((deptGaps.reduce((a, b) => a + b, 0) / deptGaps.length) * 10) / 10
          : null
        return { competencyId: c.id, avgGap }
      })

      return { department: dept, memberCount: deptEmployees.length, scores }
    })

    const sorted = competencyGaps
      .filter((g) => g.avgGap !== null)
      .sort((a, b) => (b.avgGap ?? 0) - (a.avgGap ?? 0))

    // 평가 완료율
    const totalAssessments = employees.reduce((acc, e) => acc + e.skillAssessments.length, 0)
    const maxPossible = employees.length * competencies.length
    const completionRate = maxPossible > 0 ? Math.round((totalAssessments / maxPossible) * 100) : 0

    return apiSuccess({
      period,
      companyId,
      totalEmployees: employees.length,
      completionRate,
      topGaps: sorted.slice(0, 5),
      topStrengths: sorted.filter((g) => (g.avgGap ?? 0) < 0).slice(-5).reverse(),
      allCompetencyGaps: competencyGaps,
      departmentMatrix,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)

// POST: 리포트 스냅샷 저장
export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const canCreate = ['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)
    if (!canCreate) throw forbidden('리포트 생성 권한이 없습니다.')

    const body: unknown = await req.json()
    const parsed = gapReportCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const report = await prisma.skillGapReport.create({
        data: {
          companyId: parsed.data.companyId ?? user.companyId,
          departmentId: parsed.data.departmentId,
          assessmentPeriod: parsed.data.assessmentPeriod,
          reportData: parsed.data.reportData as never,
          generatedBy: user.employeeId,
        },
      })
      return apiSuccess(report, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.CREATE),
)
