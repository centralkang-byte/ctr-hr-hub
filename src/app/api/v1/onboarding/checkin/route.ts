// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/onboarding/checkin
// 신입사원 주간 체크인 제출
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { z } from 'zod'

const checkinSchema = z.object({
  checkinWeek: z.number().int().min(1).max(52),
  mood: z.enum(['GREAT', 'GOOD', 'NEUTRAL', 'STRUGGLING', 'BAD']),
  energy: z.number().int().min(1).max(5),
  belonging: z.number().int().min(1).max(5),
  comment: z.string().optional(),
})

export const POST = withAuth(async (req: NextRequest, _context, user) => {
  const body = await req.json()
  const parsed = checkinSchema.safeParse(body)
  if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

  // 동일 주차 중복 체크
  const existing = await prisma.onboardingCheckin.findFirst({
    where: { employeeId: user.employeeId, checkinWeek: parsed.data.checkinWeek },
  })
  if (existing) {
    throw conflict('이미 해당 주차의 체크인이 제출되었습니다.')
  }

  const checkin = await prisma.onboardingCheckin.create({
    data: {
      ...parsed.data,
      employeeId: user.employeeId,
      companyId: user.companyId,
      submittedAt: new Date(),
    },
  })
  return apiSuccess(checkin, 201)
})
