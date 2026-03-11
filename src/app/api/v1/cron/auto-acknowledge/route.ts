// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Cron: Auto-Acknowledge
// GET /api/v1/cron/auto-acknowledge
//
// ⚠️ TIMEZONE RULE: All cron jobs use ABSOLUTE UTC time.
// CTR operates across 6 countries (KR/US/CN/RU/VN/MX).
// Using any single timezone's midnight creates unfair cutoffs.
// Every employee gets exactly 168 hours (7 * 24h).
//
// Schedule: Run HOURLY via Vercel Cron or external scheduler
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { handlePrismaError } from '@/lib/errors'
import { AUTO_ACKNOWLEDGE_HOURS } from '@/lib/performance/pipeline'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'

// ─── GET /api/v1/cron/auto-acknowledge ───────────────────
// No auth required for cron (secured by Vercel Cron secret or middleware)
// Settings-connected: CRON_SECRET header validation (env-based, not in Settings API)

export async function GET(_req: NextRequest) {
    try {
        const now = new Date()
        // 168 hours = exactly 7 * 24h = timezone-safe universal window
        const cutoff = new Date(now.getTime() - AUTO_ACKNOWLEDGE_HOURS * 60 * 60 * 1000)

        // Find reviews that should be auto-acknowledged
        const expiredReviews = await prisma.performanceReview.findMany({
            where: {
                status: 'NOTIFIED',
                notifiedAt: { lt: cutoff },
                acknowledgedAt: null,
            },
            select: {
                id: true,
                cycleId: true,
                employeeId: true,
                companyId: true,
                notifiedAt: true,
            },
        })

        if (expiredReviews.length === 0) {
            return apiSuccess({ processed: 0, message: 'No reviews to auto-acknowledge' })
        }

        // Auto-acknowledge in transaction
        const result = await prisma.$transaction(async (tx) => {
            for (const review of expiredReviews) {
                await tx.performanceReview.update({
                    where: { id: review.id },
                    data: {
                        acknowledgedAt: now,
                        isAutoAcknowledged: true,
                        status: 'ACKNOWLEDGED',
                    },
                })
            }
            return expiredReviews.length
        })

        // Fire events for each auto-acknowledged review
        for (const review of expiredReviews) {
            // Check if all reviews in cycle are now acknowledged
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
                    actorId: 'SYSTEM',
                    occurredAt: now,
                },
                cycleId: review.cycleId,
                employeeId: review.employeeId,
                companyId: review.companyId,
                isAutoAcknowledged: true,
                allDone: pendingCount === 0,
            })
        }

        return apiSuccess({
            processed: result,
            message: `${result}건 자동 확인 처리 완료 (통보 후 ${AUTO_ACKNOWLEDGE_HOURS}시간 경과)`,
        })
    } catch (error) {
        throw handlePrismaError(error)
    }
}
