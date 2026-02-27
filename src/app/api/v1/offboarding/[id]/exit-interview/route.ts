// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/offboarding/:id/exit-interview
// 퇴직 면담: 조회 및 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { z } from 'zod'

// ─── GET: Fetch exit interview for an offboarding record ────

export const GET = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        employee: {
          ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
        },
      },
    })
    if (!offboarding) throw notFound('퇴직 기록을 찾을 수 없습니다.')

    const interview = await prisma.exitInterview.findFirst({
      where: { employeeOffboardingId: id },
      include: { interviewer: { select: { id: true, name: true } } },
    })

    return apiSuccess(interview)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)

// ─── POST: Create exit interview ────────────────────────────

const exitInterviewSchema = z.object({
  interviewDate: z.string().datetime(),
  interviewerId: z.string().uuid().optional(),
  primaryReason: z.enum([
    'COMPENSATION',
    'CAREER_GROWTH',
    'WORK_LIFE_BALANCE',
    'MANAGEMENT',
    'CULTURE',
    'RELOCATION',
    'PERSONAL',
    'OTHER',
  ]),
  satisfactionScore: z.number().int().min(1).max(5),
  wouldRecommend: z.boolean().optional(),
  feedbackText: z.string().min(1),
})

export const POST = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    // Verify offboarding exists and is company-scoped
    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        employee: {
          ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
        },
      },
      include: { employee: { select: { id: true, companyId: true } } },
    })
    if (!offboarding) throw notFound('퇴직 기록을 찾을 수 없습니다.')

    // Parse body
    const body = await req.json()
    const parsed = exitInterviewSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('유효하지 않은 요청입니다.', {
        errors: parsed.error.issues,
      })
    }

    const data = parsed.data

    // Check if exit interview already exists
    const existing = await prisma.exitInterview.findFirst({
      where: { employeeOffboardingId: id },
    })
    if (existing) {
      throw badRequest('이미 퇴직 면담이 등록되어 있습니다.')
    }

    // Create exit interview + update offboarding flag
    const interview = await prisma.$transaction(async (tx) => {
      const created = await tx.exitInterview.create({
        data: {
          employeeOffboardingId: id,
          employeeId: offboarding.employeeId,
          interviewerId: data.interviewerId ?? user.employeeId,
          interviewDate: new Date(data.interviewDate),
          primaryReason: data.primaryReason,
          satisfactionScore: data.satisfactionScore,
          wouldRecommend: data.wouldRecommend ?? null,
          feedbackText: data.feedbackText,
          companyId: offboarding.employee.companyId,
        },
        include: { interviewer: { select: { id: true, name: true } } },
      })

      await tx.employeeOffboarding.update({
        where: { id },
        data: { exitInterviewCompleted: true },
      })

      return created
    })

    return apiSuccess(interview, 201)
  },
  perm(MODULE.ONBOARDING, ACTION.CREATE),
)
