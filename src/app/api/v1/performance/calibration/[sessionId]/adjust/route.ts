// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Calibration Grade Adjust
// PUT /api/v1/performance/calibration/:sessionId/adjust
//
// Two-Track Grade Preservation (Design Decision #17):
// originalGradeEnum = NEVER modified after EVAL_OPEN
// finalGradeEnum = set during CALIBRATION
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import type { SessionUser } from '@/types'
import type { PerformanceGrade } from '@/generated/prisma/client'

const adjustSchema = z.object({
    reviewId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),  // alias — resolved to reviewId via DB lookup
    newGrade: z.enum(['E', 'M_PLUS', 'M', 'B']).optional(),
    adjustedGrade: z.enum(['E', 'M_PLUS', 'M', 'B']).optional(),  // alias for newGrade
    reason: z.string().min(10, '조정 사유는 최소 10자 이상이어야 합니다.'),
}).transform(({ employeeId: _employeeId, adjustedGrade, ...rest }) => ({
    ...rest,
    _employeeId,  // preserve for later lookup
    newGrade: rest.newGrade || adjustedGrade,
}))

// ─── PUT /api/v1/performance/calibration/:sessionId/adjust

export const PUT = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { sessionId } = await context.params
        const body: unknown = await req.json()
        const parsed = adjustSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const { reviewId: rawReviewId, _employeeId, newGrade, reason } = parsed.data

        if (!newGrade) {
            throw badRequest('newGrade 또는 adjustedGrade가 필요합니다.')
        }
        if (!rawReviewId && !_employeeId) {
            throw badRequest('reviewId 또는 employeeId가 필요합니다.')
        }

        try {
            // 1. Validate session
            const session = await prisma.calibrationSession.findFirst({
                where: { id: sessionId, companyId: user.companyId },
                select: {
                    id: true, cycleId: true, companyId: true, status: true,
                    cycle: { select: { status: true } },
                },
            })

            if (!session) throw notFound('캘리브레이션 세션을 찾을 수 없습니다.')
            if (session.cycle.status !== 'CALIBRATION') {
                throw badRequest('캘리브레이션(CALIBRATION) 단계에서만 등급 조정이 가능합니다.')
            }
            if (session.status === 'CALIBRATION_COMPLETED') {
                throw badRequest('이미 완료된 세션입니다.')
            }

            // Resolve reviewId from employeeId if needed
            let reviewId = rawReviewId
            if (!reviewId && _employeeId) {
                const found = await prisma.performanceReview.findFirst({
                    where: { employeeId: _employeeId, cycleId: session.cycleId },
                    select: { id: true },
                })
                if (!found) throw notFound('해당 직원의 성과 리뷰를 찾을 수 없습니다.')
                reviewId = found.id
            }
            if (!reviewId) throw badRequest('reviewId 또는 employeeId가 필요합니다.')

            // 2. Find review
            const review = await prisma.performanceReview.findUnique({
                where: { id: reviewId },
                select: { id: true, employeeId: true, originalGrade: true, finalGrade: true, cycleId: true },
            })

            if (!review) throw notFound('성과 리뷰를 찾을 수 없습니다.')
            if (review.cycleId !== session.cycleId) {
                throw badRequest('이 세션의 사이클과 일치하지 않는 리뷰입니다.')
            }

            const originalGrade = review.originalGrade

            // 3. Update in transaction
            await prisma.$transaction(async (tx) => {
                // Update PerformanceReview — ONLY finalGrade, NEVER originalGrade
                await tx.performanceReview.update({
                    where: { id: reviewId },
                    data: {
                        finalGrade: newGrade as PerformanceGrade,
                        calibrationNote: reason,
                    },
                })

                // Keep PerformanceEvaluation in sync
                await tx.performanceEvaluation.updateMany({
                    where: {
                        cycleId: session.cycleId,
                        employeeId: review.employeeId,
                        evalType: 'MANAGER',
                    },
                    data: {
                        finalGradeEnum: newGrade as PerformanceGrade,
                    },
                })

                // Create CalibrationAdjustment record
                await tx.calibrationAdjustment.create({
                    data: {
                        sessionId,
                        employeeId: review.employeeId,
                        evaluatorId: user.employeeId,
                        originalPerformanceScore: 0, // Not score-based in GP#4
                        originalCompetencyScore: 0,
                        originalBlock: originalGrade ?? 'UNSET',
                        adjustedPerformanceScore: 0,
                        adjustedCompetencyScore: 0,
                        adjustedBlock: newGrade,
                        reason,
                        adjustedBy: user.employeeId,
                        adjustedAt: new Date(),
                    },
                })
            })

            // 4. Fire event
            void eventBus.publish(DOMAIN_EVENTS.CALIBRATION_ADJUSTED, {
                ctx: {
                    companyId: session.companyId,
                    actorId: user.employeeId,
                    occurredAt: new Date(),
                },
                cycleId: session.cycleId,
                employeeId: review.employeeId,
                companyId: session.companyId,
                originalGrade: originalGrade ?? 'UNSET',
                adjustedGrade: newGrade,
                reason,
            })

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.calibration.adjust',
                resourceType: 'performanceReview',
                resourceId: reviewId,
                companyId: session.companyId,
                changes: { from: originalGrade, to: newGrade, reason },
                ip,
                userAgent,
            })

            return apiSuccess({
                reviewId,
                originalGrade,
                finalGrade: newGrade,
                message: '등급이 조정되었습니다.',
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
