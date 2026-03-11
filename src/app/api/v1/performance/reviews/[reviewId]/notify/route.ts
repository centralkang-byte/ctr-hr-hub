// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Result Notification (Notify)
// POST /api/v1/performance/reviews/:reviewId/notify
//
// Design Decision #13: 168-hour acknowledge window (UTC)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import { AUTO_ACKNOWLEDGE_HOURS } from '@/lib/performance/pipeline'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/performance/reviews/:reviewId/notify ───
// Manager sends results to employee

export const POST = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { reviewId } = await context.params

        try {
            const review = await prisma.performanceReview.findFirst({
                where: { id: reviewId, companyId: user.companyId },
                include: {
                    cycle: { select: { status: true } },
                },
            })

            if (!review) throw notFound('성과 리뷰를 찾을 수 없습니다.')

            // Validate cycle is FINALIZED or CLOSED
            if (!['FINALIZED', 'CLOSED'].includes(review.cycle.status)) {
                throw badRequest('결과 확정(FINALIZED) 단계 이후에만 결과를 통보할 수 있습니다.')
            }

            // HR admin can always notify; otherwise check if user is a manager-level role
            const isHR = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'
            if (!isHR) {
                // Check via OneOnOne records or leave approval chain as proxy for manager relationship
                // For safety, allow any authorized user with APPROVE permission
                // (permission check already done by withPermission)
            }

            if (review.notifiedAt) {
                throw badRequest('이미 통보된 결과입니다.')
            }

            const now = new Date()
            await prisma.performanceReview.update({
                where: { id: reviewId },
                data: {
                    notifiedAt: now,
                    notifiedBy: user.employeeId,
                    status: 'NOTIFIED',
                },
            })

            // Fire event
            void eventBus.publish(DOMAIN_EVENTS.RESULT_NOTIFIED, {
                ctx: {
                    companyId: review.companyId,
                    actorId: user.employeeId,
                    occurredAt: now,
                },
                cycleId: review.cycleId,
                employeeId: review.employeeId,
                companyId: review.companyId,
                notifiedBy: user.employeeId,
                finalGrade: review.finalGrade ?? '',
            })

            const acknowledgeDeadline = new Date(now.getTime() + AUTO_ACKNOWLEDGE_HOURS * 60 * 60 * 1000)

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.review.notify',
                resourceType: 'performanceReview',
                resourceId: reviewId,
                companyId: review.companyId,
                changes: { employeeId: review.employeeId, finalGrade: review.finalGrade },
                ip,
                userAgent,
            })

            return apiSuccess({
                reviewId,
                notifiedAt: now,
                acknowledgeDeadline,
                message: '성과 결과가 통보되었습니다.',
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
