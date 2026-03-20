// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 매니저 역량 평가 API (B8-3 스킬 매트릭스)
// ═══════════════════════════════════════════════════════════
//
// GET  /api/v1/skills/team-assessments  팀원 목록 + 자기평가 현황
// POST /api/v1/skills/team-assessments  매니저가 팀원 역량 평가

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

const managerAssessmentSchema = z.object({
  employeeId: z.string().uuid(),
  competencyId: z.string().uuid(),
  assessmentPeriod: z.string().min(1).max(20),
  managerLevel: z.number().int().min(1).max(5),
  managerComment: z.string().max(1000).optional(),
})

const bulkManagerAssessmentSchema = z.object({
  employeeId: z.string().uuid(),
  assessmentPeriod: z.string().min(1).max(20),
  items: z.array(
    z.object({
      competencyId: z.string().uuid(),
      managerLevel: z.number().int().min(1).max(5),
      managerComment: z.string().max(1000).optional(),
    }),
  ).min(1),
})

// ─── GET /api/v1/skills/team-assessments ────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') ?? 'latest'
    const employeeId = searchParams.get('employeeId') // 특정 팀원 조회

    // 팀원 목록: 매니저의 직속 보고자 (assignments 기반)
    // 간략히 companyId 기준으로 조회 (실제로는 Position 계층 기반이어야 하나, B8-3에서는 부서 기준)
    const managerAssignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: user.employeeId, isPrimary: true, endDate: null },
    })
    const deptId = managerAssignment?.departmentId

    const teamMembers = await prisma.employee.findMany({
      where: {
        AND: [
          employeeId ? { id: employeeId } : {},
          { id: { not: user.employeeId } },
        ],
        assignments: {
          some: {
            isPrimary: true,
            endDate: null,
            departmentId: deptId ?? undefined,
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

    // 역량 목록 (평가 가능한 역량)
    const competencies = await prisma.competency.findMany({
      where: { isActive: true },
      include: { category: { select: { id: true, name: true, code: true } } },
      orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }],
    })

    // 역량 요건
    const requirements = await prisma.competencyRequirement.findMany({
      where: { OR: [{ companyId: user.companyId }, { companyId: null }] },
      select: { competencyId: true, expectedLevel: true, jobLevelCode: true },
    })
    const requirementMap = new Map(
      requirements.map((r) => [`${r.competencyId}_${r.jobLevelCode ?? ''}`, r.expectedLevel]),
    )

    return apiSuccess({
      period,
      teamMembers: teamMembers.map((m) => {
        const mPrimary = extractPrimaryAssignment(m.assignments ?? [])
          const grade = (mPrimary as Record<string, any>)?.jobGrade?.code ?? ''
        const assessmentMap = new Map(m.skillAssessments.map((a) => [a.competencyId, a]))
        return {
          id: m.id,
          name: m.name,
          nameEn: m.nameEn,
          grade,
          department: (mPrimary as Record<string, any>)?.department,
          assessments: competencies.map((c) => {
            const assessment = assessmentMap.get(c.id)
            const expectedLevel = requirementMap.get(`${c.id}_${grade}`) ?? null
            return {
              competencyId: c.id,
              competency: c,
              selfLevel: assessment?.selfLevel ?? null,
              managerLevel: assessment?.managerLevel ?? null,
              finalLevel: assessment?.finalLevel ?? null,
              expectedLevel,
              gap:
                expectedLevel != null && (assessment?.finalLevel ?? assessment?.selfLevel) != null
                  ? expectedLevel - (assessment?.finalLevel ?? assessment?.selfLevel ?? 0)
                  : null,
            }
          }),
        }
      }),
      competencies,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── POST /api/v1/skills/team-assessments ─── (매니저 평가)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const canEval = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)
    if (!canEval) throw forbidden('역량 평가 권한이 없습니다.')

    const body: unknown = await req.json()

    // 일괄 평가 지원
    const bulkParsed = bulkManagerAssessmentSchema.safeParse(body)
    if (bulkParsed.success) {
      try {
        const results = await prisma.$transaction(
          bulkParsed.data.items.map((item) =>
            prisma.employeeSkillAssessment.upsert({
              where: {
                employeeId_competencyId_assessmentPeriod: {
                  employeeId: bulkParsed.data.employeeId,
                  competencyId: item.competencyId,
                  assessmentPeriod: bulkParsed.data.assessmentPeriod,
                },
              },
              update: {
                managerLevel: item.managerLevel,
                managerComment: item.managerComment,
                finalLevel: item.managerLevel, // 매니저 평가 우선
                assessedById: user.employeeId,
                assessedAt: new Date(),
              },
              create: {
                employeeId: bulkParsed.data.employeeId,
                competencyId: item.competencyId,
                assessmentPeriod: bulkParsed.data.assessmentPeriod,
                managerLevel: item.managerLevel,
                managerComment: item.managerComment,
                finalLevel: item.managerLevel,
                assessedById: user.employeeId,
                assessedAt: new Date(),
              },
            }),
          ),
        )
        return apiSuccess({ count: results.length, employeeId: bulkParsed.data.employeeId }, 201)
      } catch (error) {
        throw handlePrismaError(error)
      }
    }

    // 단건 평가
    const parsed = managerAssessmentSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const assessment = await prisma.employeeSkillAssessment.upsert({
        where: {
          employeeId_competencyId_assessmentPeriod: {
            employeeId: parsed.data.employeeId,
            competencyId: parsed.data.competencyId,
            assessmentPeriod: parsed.data.assessmentPeriod,
          },
        },
        update: {
          managerLevel: parsed.data.managerLevel,
          managerComment: parsed.data.managerComment,
          finalLevel: parsed.data.managerLevel,
          assessedById: user.employeeId,
          assessedAt: new Date(),
        },
        create: {
          employeeId: parsed.data.employeeId,
          competencyId: parsed.data.competencyId,
          assessmentPeriod: parsed.data.assessmentPeriod,
          managerLevel: parsed.data.managerLevel,
          managerComment: parsed.data.managerComment,
          finalLevel: parsed.data.managerLevel,
          assessedById: user.employeeId,
          assessedAt: new Date(),
        },
        include: {
          competency: { select: { id: true, name: true, code: true } },
          employee: { select: { id: true, name: true, nameEn: true } },
        },
      })
      return apiSuccess(assessment, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
