// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Result Acknowledge
// POST /api/v1/performance/reviews/:reviewId/acknowledge
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/performance/reviews/:reviewId/acknowledge

export const POST = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { reviewId } = await context.params

        try {
            const review = await prisma.performanceReview.findFirst({
                where: { id: reviewId, companyId: user.companyId },
                select: {
                    id: true, cycleId: true, employeeId: true, companyId: true,
                    status: true, notifiedAt: true, acknowledgedAt: true,
                },
            })

            if (!review) throw notFound('성과 리뷰를 찾을 수 없습니다.')

            // Employee can only acknowledge their own review
            if (review.employeeId !== user.employeeId) {
                throw badRequest('본인의 성과 결과만 확인할 수 있습니다.')
            }

            if (!review.notifiedAt) {
                throw badRequest('아직 통보되지 않은 결과입니다.')
            }

            if (review.acknowledgedAt) {
                throw badRequest('이미 확인 처리된 결과입니다.')
            }

            const now = new Date()
            await prisma.performanceReview.update({
                where: { id: reviewId },
                data: {
                    acknowledgedAt: now,
                    isAutoAcknowledged: false,
                    status: 'ACKNOWLEDGED',
                },
            })

            // Check if all reviews in this cycle are acknowledged
            const pendingCount = await prisma.performanceReview.count({
                where: {
                    cycleId: review.cycleId,
                    status: { in: ['NOTIFIED', 'CALIBRATED'] },
                    acknowledgedAt: null,
                },
            })

            void eventBus.publish(DOMAIN_EVENTS.RESULT_ACKNOWLEDGED, {
                ctx: {
                    companyId: review.companyId,
                    actorId: user.employeeId,
                    occurredAt: now,
                },
                cycleId: review.cycleId,
                employeeId: review.employeeId,
                companyId: review.companyId,
                isAutoAcknowledged: false,
                allDone: pendingCount === 0,
            })

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.review.acknowledge',
                resourceType: 'performanceReview',
                resourceId: reviewId,
                companyId: review.companyId,
                changes: { allDone: pendingCount === 0 },
                ip,
                userAgent,
            })

            return apiSuccess({
                reviewId,
                acknowledgedAt: now,
                allDone: pendingCount === 0,
                message: '성과 결과를 확인하였습니다.',
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
