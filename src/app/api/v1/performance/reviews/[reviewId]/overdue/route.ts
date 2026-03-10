// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Review Overdue Details
// GET /api/v1/performance/reviews/:reviewId/overdue
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { formatOverdueBadge } from '@/lib/performance/pipeline'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/performance/reviews/:reviewId/overdue ───
// Returns detailed overdue flag information

export const GET = withPermission(
    async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { reviewId } = await context.params

        try {
            const review = await prisma.performanceReview.findFirst({
                where: { id: reviewId, companyId: user.companyId },
                select: {
                    id: true,
                    overdueFlags: true,
                    status: true,
                    employee: {
                        select: { id: true, name: true, nameEn: true },
                    },
                },
            })

            if (!review) throw notFound('평가 리뷰를 찾을 수 없습니다.')

            const flags = (review.overdueFlags as string[]) || []

            const overdueDetails = flags.map((flag) => {
                let description = flag
                let category = 'UNKNOWN'

                if (flag.startsWith('GOAL_LATE_')) {
                    const days = flag.replace('GOAL_LATE_', '').replace('D', '')
                    description = `목표 설정 ${days}일 지연`
                    category = 'GOAL'
                } else if (flag === 'CHECKIN_MISSING') {
                    description = '중간 체크인 미완료'
                    category = 'CHECKIN'
                } else if (flag.startsWith('SELF_EVAL_LATE_')) {
                    const days = flag.replace('SELF_EVAL_LATE_', '').replace('D', '')
                    description = `자기평가 ${days}일 지연`
                    category = 'SELF_EVAL'
                } else if (flag.startsWith('MANAGER_EVAL_LATE_')) {
                    const days = flag.replace('MANAGER_EVAL_LATE_', '').replace('D', '')
                    description = `상사평가 ${days}일 지연`
                    category = 'MANAGER_EVAL'
                }

                return { flag, description, category }
            })

            return apiSuccess({
                reviewId: review.id,
                employeeId: review.employee.id,
                employeeName: review.employee.name,
                reviewStatus: review.status,
                overdueFlags: flags,
                overdueDetails,
                overdueBadgeText: formatOverdueBadge(flags),
                overdueCount: flags.length,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
