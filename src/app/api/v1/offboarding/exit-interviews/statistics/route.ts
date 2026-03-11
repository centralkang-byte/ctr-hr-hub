// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/offboarding/exit-interviews/statistics
// Anonymous exit interview statistics with 5-record minimum threshold
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
    async (req: NextRequest, _ctx, user: SessionUser) => {
        const p = Object.fromEntries(req.nextUrl.searchParams)
        const departmentId = p.departmentId
        const companyId = user.role === ROLE.SUPER_ADMIN ? (p.companyId ?? undefined) : user.companyId
        const minCount = Number(p.minCount ?? 5)

        // Permission: MANAGER can only see own department's stats
        const isHrOrSuperAdmin = user.role === ROLE.SUPER_ADMIN || user.role === 'HR_ADMIN'
        if (!isHrOrSuperAdmin) {
            // Manager — must specify department and must match their own
            const userAssignment = await prisma.employeeAssignment.findFirst({
                where: { employeeId: user.employeeId, isPrimary: true, endDate: null },
                select: { departmentId: true },
            })
            if (!departmentId || departmentId !== userAssignment?.departmentId) {
                throw forbidden('자신의 부서 통계만 조회할 수 있습니다.')
            }
        }

        // Build where clause for exit interviews
        // We need to filter by department via employee → assignment → department
        const exitInterviewWhere: Record<string, unknown> = {}

        if (companyId) {
            exitInterviewWhere.company = { id: companyId }
        }

        if (departmentId) {
            exitInterviewWhere.employee = {
                assignments: {
                    some: {
                        departmentId,
                        isPrimary: true,
                    },
                },
            }
        }

        // Query all matching exit interviews
        const interviews = await prisma.exitInterview.findMany({
            where: exitInterviewWhere,
            select: {
                primaryReason: true,
                satisfactionScore: true,
                wouldRecommend: true,
            },
        })

        const totalInterviews = interviews.length

        // 5-record minimum threshold — prevent individual identification
        if (totalInterviews < minCount) {
            return apiSuccess({
                canDisplay: false,
                totalInterviews,
                reasonBreakdown: [],
                avgSatisfaction: null,
                wouldRecommend: null,
            })
        }

        // Aggregate reason counts
        const reasonCounts: Record<string, number> = {}
        let totalSatisfaction = 0
        let recommendYes = 0
        let recommendNo = 0
        let recommendTotal = 0

        for (const interview of interviews) {
            const reason = interview.primaryReason
            reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1
            totalSatisfaction += interview.satisfactionScore

            if (interview.wouldRecommend !== null) {
                recommendTotal++
                if (interview.wouldRecommend) recommendYes++
                else recommendNo++
            }
        }

        const reasonBreakdown = Object.entries(reasonCounts)
            .map(([reason, count]) => ({
                reason,
                count,
                percentage: Math.round((count / totalInterviews) * 1000) / 10,
            }))
            .sort((a, b) => b.count - a.count)

        return apiSuccess({
            canDisplay: true,
            totalInterviews,
            reasonBreakdown,
            avgSatisfaction: Math.round((totalSatisfaction / totalInterviews) * 10) / 10,
            wouldRecommend: recommendTotal > 0 ? {
                yes: recommendYes,
                no: recommendNo,
                percentage: Math.round((recommendYes / recommendTotal) * 1000) / 10,
            } : null,
        })
    },
    perm(MODULE.ONBOARDING, ACTION.VIEW),
)
