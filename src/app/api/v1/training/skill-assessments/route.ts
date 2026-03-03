// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Skill Assessments (B9-1 LMS Lite)
// ═══════════════════════════════════════════════════════════
//
// GET  /api/v1/training/skill-assessments  내 역량 평가 목록
// POST /api/v1/training/skill-assessments  역량 평가 등록/갱신

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const assessmentUpsertSchema = z.object({
  competencyId: z.string().uuid(),
  currentLevel: z.number().int().min(1).max(5),
  notes: z.string().max(500).optional(),
})

// ─── GET /api/v1/training/skill-assessments ──────────────

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const assessments = await prisma.employeeSkillAssessment.findMany({
      where: { employeeId: user.employeeId },
      include: {
        competency: {
          select: {
            id: true,
            name: true,
            code: true,
            category: { select: { id: true, name: true } },
          },
        },
        assessedBy: {
          select: { id: true, name: true, nameEn: true },
        },
      },
      orderBy: { assessedAt: 'desc' },
    })

    // 역량 요건과 비교하여 갭 계산
    const requirements = await prisma.competencyRequirement.findMany({
      where: { OR: [{ companyId: user.companyId }, { companyId: null }] },
      select: { competencyId: true, expectedLevel: true },
    })
    const requirementMap = new Map(requirements.map((r) => [r.competencyId, r.expectedLevel]))

    return apiSuccess(
      assessments.map((a) => ({
        id: a.id,
        competencyId: a.competencyId,
        competency: a.competency,
        currentLevel: a.currentLevel,
        expectedLevel: requirementMap.get(a.competencyId) ?? null,
        gap: requirementMap.has(a.competencyId)
          ? (requirementMap.get(a.competencyId)! - (a.currentLevel ?? 0))
          : null,
        assessedAt: a.assessedAt,
        assessedBy: a.assessedBy,
        notes: a.notes,
      })),
    )
  },
  perm(MODULE.TRAINING, ACTION.VIEW),
)

// ─── POST /api/v1/training/skill-assessments ─────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = assessmentUpsertSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const assessment = await prisma.employeeSkillAssessment.upsert({
        where: {
          employeeId_competencyId_assessmentPeriod: {
            employeeId: user.employeeId,
            competencyId: parsed.data.competencyId,
            assessmentPeriod: 'latest',
          },
        },
        update: {
          currentLevel: parsed.data.currentLevel,
          finalLevel: parsed.data.currentLevel,
          notes: parsed.data.notes,
          assessedAt: new Date(),
          assessedById: user.employeeId,
        },
        create: {
          employeeId: user.employeeId,
          competencyId: parsed.data.competencyId,
          assessmentPeriod: 'latest',
          currentLevel: parsed.data.currentLevel,
          finalLevel: parsed.data.currentLevel,
          notes: parsed.data.notes,
          assessedById: user.employeeId,
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
  perm(MODULE.TRAINING, ACTION.VIEW),
)
