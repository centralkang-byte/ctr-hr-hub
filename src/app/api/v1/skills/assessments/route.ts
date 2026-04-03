// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 역량 자기평가 API (B8-3 스킬 매트릭스)
// ═══════════════════════════════════════════════════════════
//
// GET  /api/v1/skills/assessments  내 역량 자기평가 목록
// POST /api/v1/skills/assessments  자기평가 제출/갱신

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

const selfAssessmentSchema = z.object({
  competencyId: z.string().uuid(),
  assessmentPeriod: z.string().min(1).max(20),
  selfLevel: z.number().int().min(1).max(5),
  selfComment: z.string().max(1000).optional(),
})

const bulkSelfAssessmentSchema = z.object({
  assessmentPeriod: z.string().min(1).max(20),
  items: z.array(
    z.object({
      competencyId: z.string().uuid(),
      selfLevel: z.number().int().min(1).max(5),
      selfComment: z.string().max(1000).optional(),
    }),
  ).min(1),
})

// ─── GET /api/v1/skills/assessments ─────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') ?? 'latest'
    const employeeId = searchParams.get('employeeId') ?? user.employeeId

    // HR_ADMIN / SUPER_ADMIN / MANAGER 는 타인 조회 가능
    const canViewOthers = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user.role)
    const targetId = canViewOthers ? employeeId : user.employeeId

    const assessments = await prisma.employeeSkillAssessment.findMany({
      where: {
        employeeId: targetId,
        assessmentPeriod: period,
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
        assessedBy: { select: { id: true, name: true, nameEn: true } },
      },
      orderBy: { assessedAt: 'desc' },
    })

    // 역량 요건 (기대 수준) 조회
    const employee = await prisma.employee.findUnique({
      where: { id: targetId },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: { jobGrade: true },
        },
      },
    })
    const primary = extractPrimaryAssignment(employee?.assignments ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gradeCode = (primary as any)?.jobGrade?.code ?? null

    const requirements = await prisma.competencyRequirement.findMany({
      where: {
        OR: [{ companyId: user.companyId }, { companyId: null }],
        ...(gradeCode ? { jobLevelCode: gradeCode } : {}),
      },
      select: { competencyId: true, expectedLevel: true, jobLevelCode: true },
    })
    const requirementMap = new Map(requirements.map((r) => [r.competencyId, r.expectedLevel]))

    return apiSuccess(
      assessments.map((a) => ({
        id: a.id,
        competencyId: a.competencyId,
        competency: a.competency,
        assessmentPeriod: a.assessmentPeriod,
        selfLevel: a.selfLevel,
        managerLevel: a.managerLevel,
        finalLevel: a.finalLevel ?? a.selfLevel ?? null,
        selfComment: a.selfComment,
        managerComment: a.managerComment,
        expectedLevel: requirementMap.get(a.competencyId) ?? null,
        gap: requirementMap.has(a.competencyId) && (a.finalLevel ?? a.selfLevel) != null
          ? requirementMap.get(a.competencyId)! - (a.finalLevel ?? a.selfLevel ?? 0)
          : null,
        assessedAt: a.assessedAt,
        assessedBy: a.assessedBy,
        notes: a.notes,
      })),
    )
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

// ─── POST /api/v1/skills/assessments ─── (자기평가 제출)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()

    // 일괄 제출 지원
    const bulkParsed = bulkSelfAssessmentSchema.safeParse(body)
    if (bulkParsed.success) {
      try {
        const results = await prisma.$transaction(
          bulkParsed.data.items.map((item) =>
            prisma.employeeSkillAssessment.upsert({
              where: {
                employeeId_competencyId_assessmentPeriod: {
                  employeeId: user.employeeId,
                  competencyId: item.competencyId,
                  assessmentPeriod: bulkParsed.data.assessmentPeriod,
                },
              },
              update: {
                selfLevel: item.selfLevel,
                selfComment: item.selfComment,
                // finalLevel = managerLevel 우선, 없으면 selfLevel
                finalLevel: item.selfLevel,
                assessedAt: new Date(),
              },
              create: {
                employeeId: user.employeeId,
                competencyId: item.competencyId,
                assessmentPeriod: bulkParsed.data.assessmentPeriod,
                selfLevel: item.selfLevel,
                selfComment: item.selfComment,
                finalLevel: item.selfLevel,
                assessedAt: new Date(),
              },
            }),
          ),
        )
        return apiSuccess({ count: results.length, period: bulkParsed.data.assessmentPeriod }, 201)
      } catch (error) {
        throw handlePrismaError(error)
      }
    }

    // 단건 제출
    const parsed = selfAssessmentSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const assessment = await prisma.employeeSkillAssessment.upsert({
        where: {
          employeeId_competencyId_assessmentPeriod: {
            employeeId: user.employeeId,
            competencyId: parsed.data.competencyId,
            assessmentPeriod: parsed.data.assessmentPeriod,
          },
        },
        update: {
          selfLevel: parsed.data.selfLevel,
          selfComment: parsed.data.selfComment,
          finalLevel: parsed.data.selfLevel,
          assessedAt: new Date(),
        },
        create: {
          employeeId: user.employeeId,
          competencyId: parsed.data.competencyId,
          assessmentPeriod: parsed.data.assessmentPeriod,
          selfLevel: parsed.data.selfLevel,
          selfComment: parsed.data.selfComment,
          finalLevel: parsed.data.selfLevel,
          assessedAt: new Date(),
        },
        include: {
          competency: { select: { id: true, name: true, code: true } },
        },
      })
      return apiSuccess(assessment, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
