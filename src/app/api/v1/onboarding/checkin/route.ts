// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/onboarding/checkin
// 신입사원 주간 체크인 제출
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest, unauthorized } from '@/lib/errors'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { z } from 'zod'

const checkinSchema = z.object({
  checkinWeek: z.number().int().min(1).max(52),
  mood: z.enum(['GREAT', 'GOOD', 'NEUTRAL', 'STRUGGLING', 'BAD']),
  energy: z.number().int().min(1).max(5),
  belonging: z.number().int().min(1).max(5),
  comment: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const body = await req.json()
    const parsed = checkinSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const checkin = await prisma.onboardingCheckin.create({
      data: {
        ...parsed.data,
        employeeId: user.employeeId,
        companyId: user.companyId,
        submittedAt: new Date(),
      },
    })
    return apiSuccess(checkin, 201)
  } catch (error) {
    return apiError(error)
  }
}
