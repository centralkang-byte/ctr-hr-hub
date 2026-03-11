// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/offboarding/:id/exit-interview
// 퇴직 면담: 조회 및 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { z } from 'zod'
import { isDirectManager } from '@/lib/auth/manager-check'

// ─── GET: Fetch exit interview for an offboarding record ────

export const GET = withPermission(
  async (_req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        ...(user.role !== 'SUPER_ADMIN'
          ? { employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } } }
          : {}),
      },
    })
    if (!offboarding) throw notFound('퇴직 기록을 찾을 수 없습니다.')

    const interview = await prisma.exitInterview.findFirst({
      where: { employeeOffboardingId: id },
      include: { interviewer: { select: { id: true, name: true } } },
    })

    if (!interview) return apiSuccess(null)

    // E-2: Isolation enforcement
    // MANAGER: blocked from seeing exit interview raw data
    if (await isDirectManager(user.employeeId, offboarding.employeeId)) {
      throw forbidden('퇴직 면담 원본은 직속 매니저에게 공개되지 않습니다.')
    }
    // Employee themselves: blocked from reading submitted interview
    if (user.employeeId === offboarding.employeeId) {
      throw forbidden('제출된 퇴직 면담은 열람이 불가합니다.')
    }
    // Only HR_ADMIN and SUPER_ADMIN reach here
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN') {
      throw forbidden('퇴직 면담은 HR 관리자만 열람할 수 있습니다.')
    }

    return apiSuccess(interview)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)

// ─── POST: Create exit interview ────────────────────────────

const satisfactionDetailSchema = z.object({
  overall: z.number().int().min(1).max(5),
  compensation: z.number().int().min(1).max(5),
  culture: z.number().int().min(1).max(5),
  management: z.number().int().min(1).max(5),
  growth: z.number().int().min(1).max(5),
})

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
  detailedReason: z.string().optional(),
  satisfactionScore: z.number().int().min(1).max(5),
  satisfactionDetail: satisfactionDetailSchema.optional(),
  wouldRecommend: z.boolean().optional(),
  feedbackText: z.string().min(1),
  suggestions: z.string().optional(),
  isConfidential: z.boolean().optional(),
})

export const POST = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    // Verify offboarding exists and is company-scoped
    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: {
        id,
        ...(user.role !== 'SUPER_ADMIN'
          ? { employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } } }
          : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { companyId: true },
            },
          },
        },
      },
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
          detailedReason: data.detailedReason ?? null,
          satisfactionScore: data.satisfactionScore,
          satisfactionDetail: data.satisfactionDetail ?? undefined,
          wouldRecommend: data.wouldRecommend ?? null,
          feedbackText: data.feedbackText,
          suggestions: data.suggestions ?? null,
          isConfidential: data.isConfidential ?? true,
          companyId: ((offboarding.employee.assignments?.[0] as any)?.companyId as string | undefined) ?? user.companyId, // eslint-disable-line @typescript-eslint/no-explicit-any
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
