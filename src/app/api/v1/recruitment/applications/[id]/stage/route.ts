// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/recruitment/applications/[id]/stage
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

// ─── Stage Change Schema ─────────────────────────────────

const stageSchema = z
  .object({
    stage: z.enum([
      'APPLIED',
      'SCREENING',
      'INTERVIEW_1',
      'INTERVIEW_2',
      'FINAL',
      'OFFER',
      'HIRED',
      'REJECTED',
    ]),
    rejectionReason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.stage === 'REJECTED' && !data.rejectionReason) {
        return false
      }
      return true
    },
    {
      message: '반려 시 사유를 입력해주세요.',
      path: ['rejectionReason'],
    },
  )

// ─── PUT /api/v1/recruitment/applications/[id]/stage ──────

export const PUT = withPermission(
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
        applicant: { select: { name: true } },
      },
    })

    if (!existing) {
      throw notFound('지원 정보를 찾을 수 없습니다.')
    }

    // Cannot change from HIRED (one-way terminal state)
    if (existing.stage === 'HIRED') {
      throw badRequest('이미 채용 완료된 지원자의 단계는 변경할 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = stageSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { stage, rejectionReason } = parsed.data

    try {
      const updated = await prisma.application.update({
        where: { id },
        data: {
          stage,
          ...(rejectionReason ? { rejectionReason } : {}),
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
        action: 'recruitment.application.stage_change',
        resourceType: 'application',
        resourceId: id,
        companyId: existing.posting.companyId,
        changes: {
          previousStage: existing.stage,
          newStage: stage,
          ...(rejectionReason ? { rejectionReason } : {}),
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
