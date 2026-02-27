// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/recruitment/applications/[id]/offer
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Offer Schema ────────────────────────────────────────

const offerSchema = z.object({
  offeredSalary: z.number().positive('연봉은 양수여야 합니다.'),
  offeredDate: z.string().datetime({ message: '올바른 날짜 형식을 입력해주세요.' }),
  expectedStartDate: z.string().datetime({ message: '올바른 날짜 형식을 입력해주세요.' }),
})

// ─── POST /api/v1/recruitment/applications/[id]/offer ─────

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN
        ? {}
        : { posting: { companyId: user.companyId } }

    const existing = await prisma.application.findFirst({
      where: { id, ...companyFilter },
      include: {
        posting: { select: { companyId: true, title: true } },
        applicant: { select: { name: true, email: true } },
      },
    })

    if (!existing) {
      throw notFound('지원 정보를 찾을 수 없습니다.')
    }

    // Cannot set offer on HIRED or REJECTED applications
    if (existing.stage === 'HIRED') {
      throw badRequest('이미 채용 완료된 지원자에게는 오퍼를 설정할 수 없습니다.')
    }
    if (existing.stage === 'REJECTED') {
      throw badRequest('반려된 지원자에게는 오퍼를 설정할 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = offerSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { offeredSalary, offeredDate, expectedStartDate } = parsed.data

    try {
      const updated = await prisma.application.update({
        where: { id },
        data: {
          offeredSalary,
          offeredDate: new Date(offeredDate),
          expectedStartDate: new Date(expectedStartDate),
          stage: 'OFFER',
        },
        include: {
          applicant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          posting: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.application.offer',
        resourceType: 'application',
        resourceId: id,
        companyId: existing.posting.companyId,
        changes: {
          offeredSalary,
          offeredDate,
          expectedStartDate,
          previousStage: existing.stage,
          newStage: 'OFFER',
        },
        ip,
        userAgent,
      })

      return apiSuccess({
        ...updated,
        offeredSalary: updated.offeredSalary
          ? Number(updated.offeredSalary)
          : null,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)
