// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/onboarding/crossboarding
// 법인 간 이동 트리거: 출발 + 도착 온보딩 플랜 동시 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, handlePrismaError } from '@/lib/errors'
import { triggerCrossboarding } from '@/lib/crossboarding'
import type { SessionUser } from '@/types'

const schema = z.object({
  employeeId: z.string().uuid(),
  fromCompanyId: z.string().uuid(),
  toCompanyId: z.string().uuid(),
  transferDate: z.string().datetime({ offset: true }).or(z.string().date()),
  buddyId: z.string().uuid().optional(),
})

export const POST = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw badRequest('요청 본문이 올바른 JSON이 아닙니다.')
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((e) => e.message).join(', '))
    }

    const { employeeId, fromCompanyId, toCompanyId, transferDate, buddyId } = parsed.data

    if (fromCompanyId === toCompanyId) {
      throw badRequest('출발 법인과 도착 법인이 동일합니다.')
    }

    // Duplicate prevention: block if active crossboarding already in progress
    const existingCrossboard = await prisma.employeeOnboarding.findFirst({
      where: {
        employeeId,
        planType: { in: ['CROSSBOARDING_DEPARTURE', 'CROSSBOARDING_ARRIVAL'] },
        status: { in: ['IN_PROGRESS', 'NOT_STARTED'] },
      },
      select: { id: true, planType: true, status: true },
    })
    if (existingCrossboard) {
      throw conflict('이미 진행 중인 크로스보딩이 있습니다. 기존 프로세스를 완료하거나 취소한 후 다시 시도하세요.')
    }

    try {
      const result = await triggerCrossboarding({
        employeeId,
        fromCompanyId,
        toCompanyId,
        transferDate: new Date(transferDate),
        buddyId,
      })

      return apiSuccess({
        message: '크로스보딩 플랜이 생성되었습니다.',
        ...result,
      })
    } catch (err) {
      if (err instanceof Error && err.message.includes('템플릿')) {
        throw badRequest(err.message)
      }
      throw handlePrismaError(err)
    }
  },
  perm(MODULE.ONBOARDING, ACTION.CREATE),
)
