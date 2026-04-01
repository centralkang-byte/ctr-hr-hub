// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Quarterly Review Reopen (HR Only)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
import type { SessionUser } from '@/types'

bootstrapEventHandlers()

// ─── Validation ─────────────────────────────────────────────

const reopenSchema = z.object({
  reason: z.string().min(1).max(1000),
})

// ─── PUT /api/v1/performance/quarterly-reviews/:id/reopen ───
// HR-only: reopen a completed quarterly review.

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    // Only HR_ADMIN or SUPER_ADMIN may reopen
    if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('HR 관리자만 리뷰를 재오픈할 수 있습니다.')
    }

    const { id } = await context.params
    const body = reopenSchema.parse(await req.json())

    const review = await prisma.quarterlyReview.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!review) throw notFound('분기 리뷰를 찾을 수 없습니다.')

    if (review.status !== 'COMPLETED') {
      throw badRequest('완료된 리뷰만 재오픈할 수 있습니다.')
    }

    const now = new Date()

    await prisma.quarterlyReview.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        employeeSubmittedAt: null,
        managerSubmittedAt: null,
      },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'performance.quarterly-review.reopen',
      resourceType: 'quarterlyReview',
      resourceId: id,
      companyId: user.companyId,
      changes: { reason: body.reason, previousStatus: 'COMPLETED' },
      ip,
      userAgent,
    })

    void eventBus.publish(DOMAIN_EVENTS.QUARTERLY_REVIEW_REOPENED, {
      ctx: {
        companyId: user.companyId,
        actorId: user.employeeId,
        occurredAt: now,
      },
      reviewId: id,
      employeeId: review.employeeId,
      companyId: user.companyId,
      reopenedById: user.employeeId,
      reason: body.reason,
    })

    return apiSuccess({ id, status: 'IN_PROGRESS', reopenedAt: now })
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
