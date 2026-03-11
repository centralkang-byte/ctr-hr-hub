// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Employee My Result View
// GET /api/v1/performance/reviews/my-result
//
// Data Masking applied:
// - Employee sees: finalGrade, mboScore, beiScore, totalScore
// - Employee CANNOT see: originalGrade, overdueFlags, calibrationNote
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { AUTO_ACKNOWLEDGE_HOURS } from '@/lib/performance/pipeline'
import { getGradeLabel } from '@/lib/performance/data-masking'
import type { SessionUser } from '@/types'

const querySchema = z.object({
    cycleId: z.string().uuid(),
})

// ─── GET /api/v1/performance/reviews/my-result ───────────

export const GET = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const params = Object.fromEntries(req.nextUrl.searchParams.entries())
        const parsed = querySchema.safeParse(params)
        if (!parsed.success) {
            throw badRequest('cycleId 파라미터가 필요합니다.', { issues: parsed.error.issues })
        }

        const { cycleId } = parsed.data

        try {
            const review = await prisma.performanceReview.findFirst({
                where: { cycleId, employeeId: user.employeeId, companyId: user.companyId },
                select: {
                    id: true,
                    cycleId: true,
                    finalGrade: true,
                    mboScore: true,
                    beiScore: true,
                    totalScore: true,
                    notifiedAt: true,
                    acknowledgedAt: true,
                    isAutoAcknowledged: true,
                    status: true,
                    cycle: {
                        select: { name: true, year: true, half: true },
                    },
                    // originalGrade: NOT selected (Data Masking)
                    // overdueFlags: NOT selected
                    // calibrationNote: NOT selected
                },
            })

            if (!review) throw badRequest('성과 리뷰를 찾을 수 없습니다.')

            // Calculate acknowledge deadline (168h from notification)
            let acknowledgeDeadline: Date | null = null
            let daysRemaining: number | null = null

            if (review.notifiedAt && !review.acknowledgedAt) {
                acknowledgeDeadline = new Date(
                    new Date(review.notifiedAt).getTime() + AUTO_ACKNOWLEDGE_HOURS * 60 * 60 * 1000,
                )
                const now = new Date()
                const msRemaining = acknowledgeDeadline.getTime() - now.getTime()
                daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
            }

            // Fetch MBO goals with scores
            const mboGoals = await prisma.mboGoal.findMany({
                where: { cycleId, employeeId: user.employeeId },
                select: {
                    title: true,
                    weight: true,
                    achievementScore: true,
                    status: true,
                },
                orderBy: { weight: 'desc' },
            })

            return apiSuccess({
                review: {
                    id: review.id,
                    cycleId: review.cycleId,
                    cycleName: review.cycle.name,
                    year: review.cycle.year,
                    half: review.cycle.half,
                    finalGrade: review.finalGrade,
                    finalGradeLabel: getGradeLabel(review.finalGrade, 'ko'),
                    mboScore: review.mboScore ? Number(review.mboScore) : null,
                    beiScore: review.beiScore ? Number(review.beiScore) : null,
                    totalScore: review.totalScore ? Number(review.totalScore) : null,
                    notifiedAt: review.notifiedAt,
                    acknowledgedAt: review.acknowledgedAt,
                    isAutoAcknowledged: review.isAutoAcknowledged,
                    acknowledgeDeadline,
                    daysRemaining,
                    status: review.status,
                },
                mboGoals: mboGoals.map((g) => ({
                    title: g.title,
                    weight: Number(g.weight),
                    score: g.achievementScore ? Number(g.achievementScore) : null,
                    status: g.status,
                })),
                // originalGrade: NOT included (Data Masking)
                // overdueFlags: NOT included
                // calibrationAdjustments: NOT included
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
