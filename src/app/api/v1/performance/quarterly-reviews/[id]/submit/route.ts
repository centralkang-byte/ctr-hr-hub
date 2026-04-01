// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Quarterly Review Submit
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
import type { SessionUser } from '@/types'

bootstrapEventHandlers()

// ─── PUT /api/v1/performance/quarterly-reviews/:id/submit ───
// Employee submits their review, or Manager finalizes it.

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const review = await prisma.quarterlyReview.findFirst({
      where: { id, companyId: user.companyId },
      include: { goalProgress: true },
    })
    if (!review) throw notFound('분기 리뷰를 찾을 수 없습니다.')

    let updated: { id: string; status: string; employeeSubmittedAt?: Date | null; managerSubmittedAt?: Date | null }

    // ── Employee submit path ────────────────────────────────
    if (user.employeeId === review.employeeId) {
      if (review.status !== 'IN_PROGRESS') {
        throw badRequest('진행중 상태에서만 제출할 수 있습니다.')
      }
      if (!review.goalHighlights) {
        throw badRequest('목표 하이라이트를 작성해야 제출할 수 있습니다.')
      }

      const now = new Date()

      updated = await prisma.$transaction(async (tx) => {
        const result = await tx.quarterlyReview.update({
          where: { id },
          data: { status: 'EMPLOYEE_DONE', employeeSubmittedAt: now },
        })

        // Sync goal progress to MboProgress
        const progressEntries = review.goalProgress.filter(
          (gp) => gp.progressPct !== null && Number(gp.progressPct) > 0,
        )
        if (progressEntries.length > 0) {
          await tx.mboProgress.createMany({
            data: progressEntries.map((gp) => ({
              goalId: gp.goalId,
              progressPct: gp.progressPct!,
              note: '분기 리뷰 동기화',
              createdById: user.employeeId,
            })),
          })
        }

        return result
      })

      void eventBus.publish(DOMAIN_EVENTS.QUARTERLY_REVIEW_SUBMITTED, {
        ctx: {
          companyId: user.companyId,
          actorId: user.employeeId,
          occurredAt: now,
        },
        reviewId: id,
        employeeId: review.employeeId,
        companyId: user.companyId,
        submitterRole: 'EMPLOYEE',
        newStatus: 'EMPLOYEE_DONE',
      })

    // ── Manager submit path ─────────────────────────────────
    } else if (user.employeeId === review.managerId) {
      if (review.status !== 'EMPLOYEE_DONE') {
        throw badRequest('직원이 제출한 후에만 완료할 수 있습니다.')
      }
      if (!review.managerFeedback) {
        throw badRequest('매니저 피드백을 작성해야 완료할 수 있습니다.')
      }

      const now = new Date()

      updated = await prisma.quarterlyReview.update({
        where: { id },
        data: { status: 'COMPLETED', managerSubmittedAt: now },
      })

      void eventBus.publish(DOMAIN_EVENTS.QUARTERLY_REVIEW_SUBMITTED, {
        ctx: {
          companyId: user.companyId,
          actorId: user.employeeId,
          occurredAt: now,
        },
        reviewId: id,
        employeeId: review.employeeId,
        companyId: user.companyId,
        submitterRole: 'MANAGER',
        newStatus: 'COMPLETED',
      })

      void eventBus.publish(DOMAIN_EVENTS.QUARTERLY_REVIEW_COMPLETED, {
        ctx: {
          companyId: user.companyId,
          actorId: user.employeeId,
          occurredAt: now,
        },
        reviewId: id,
        employeeId: review.employeeId,
        managerId: review.managerId,
        companyId: user.companyId,
        year: review.year,
        quarter: review.quarter,
      })

    // ── No permission ───────────────────────────────────────
    } else {
      throw forbidden('이 리뷰를 제출할 권한이 없습니다.')
    }

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'performance.quarterly-review.submit',
      resourceType: 'quarterlyReview',
      resourceId: id,
      companyId: user.companyId,
      changes: { status: updated.status },
      ip,
      userAgent,
    })

    return apiSuccess({
      id,
      status: updated.status,
      submittedAt: updated.employeeSubmittedAt ?? updated.managerSubmittedAt,
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE),
)
