// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Mandatory Training Config (B9-1 LMS Lite)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const configCreateSchema = z.object({
  courseId: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(), // null = 전사 공통
  targetGroup: z.enum(['all', 'manager', 'new_hire', 'production']),
  frequency: z.enum(['annual', 'biennial', 'once']),
  deadlineMonth: z.number().int().min(1).max(12).optional(),
  isActive: z.boolean().default(true),
})

// ─── GET /api/v1/training/mandatory-config ───────────────

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const configs = await prisma.mandatoryTrainingConfig.findMany({
      where: {
        OR: [{ companyId: user.companyId }, { companyId: null }],
        deletedAt: null,
      },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            category: true,
            durationHours: true,
            validityMonths: true,
            format: true,
          },
        },
        company: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return apiSuccess(configs.map((c) => ({
      ...c,
      course: {
        ...c.course,
        durationHours: c.course.durationHours ? Number(c.course.durationHours) : null,
      },
    })))
  },
  perm(MODULE.TRAINING, ACTION.VIEW),
)

// ─── POST /api/v1/training/mandatory-config ──────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = configCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    // HR_ADMIN은 자신의 법인만 설정 가능
    const companyId = parsed.data.companyId !== undefined
      ? parsed.data.companyId
      : user.companyId

    try {
      const config = await prisma.mandatoryTrainingConfig.create({
        data: {
          courseId: parsed.data.courseId,
          companyId,
          targetGroup: parsed.data.targetGroup,
          frequency: parsed.data.frequency,
          deadlineMonth: parsed.data.deadlineMonth,
        },
        include: {
          course: { select: { id: true, code: true, title: true } },
        },
      })

      return apiSuccess(config, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.TRAINING, ACTION.CREATE),
)
