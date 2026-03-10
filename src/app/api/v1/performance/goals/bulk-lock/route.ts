// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Goal Bulk Lock
// POST /api/v1/performance/goals/bulk-lock
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { addOverdueFlag, daysSinceDeadline } from '@/lib/performance/pipeline'
import type { SessionUser } from '@/types'

const lockSchema = z.object({
    cycleId: z.string().uuid(),
})

// ─── POST /api/v1/performance/goals/bulk-lock ────────────
// Lock all approved goals for a cycle + flag unapproved employees as overdue

export const POST = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const body: unknown = await req.json()
        const parsed = lockSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const { cycleId } = parsed.data

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, companyId: true, goalEnd: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')

            const now = new Date()
            const days = daysSinceDeadline(cycle.goalEnd, now)

            const result = await prisma.$transaction(async (tx) => {
                // 1. Lock all approved goals
                const locked = await tx.mboGoal.updateMany({
                    where: { cycleId, status: 'APPROVED', isLocked: false },
                    data: { isLocked: true },
                })

                // 2. Find employees with unapproved goals
                const unapprovedGoals = await tx.mboGoal.findMany({
                    where: { cycleId, status: { not: 'APPROVED' } },
                    select: { employeeId: true },
                    distinct: ['employeeId'],
                })

                const overdueEmployeeIds = unapprovedGoals.map((g) => g.employeeId)

                // 3. Flag overdue employees
                for (const empId of overdueEmployeeIds) {
                    const review = await tx.performanceReview.findFirst({
                        where: { cycleId, employeeId: empId },
                        select: { id: true, overdueFlags: true },
                    })

                    if (review) {
                        const flag = `GOAL_LATE_${days}D`
                        await tx.performanceReview.update({
                            where: { id: review.id },
                            data: { overdueFlags: addOverdueFlag(review.overdueFlags, flag) },
                        })
                    }

                    // Mark overdue on the goals themselves
                    await tx.mboGoal.updateMany({
                        where: { cycleId, employeeId: empId, status: { not: 'APPROVED' } },
                        data: { overdueAt: now },
                    })
                }

                return {
                    locked: locked.count,
                    overdueCount: overdueEmployeeIds.length,
                    overdueEmployeeIds,
                }
            })

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.goals.bulk-lock',
                resourceType: 'mboGoal',
                resourceId: cycleId,
                companyId: cycle.companyId,
                changes: { locked: result.locked, overdueCount: result.overdueCount },
                ip,
                userAgent,
            })

            return apiSuccess({
                message: `${result.locked}개 목표가 잠금되었습니다.`,
                locked: result.locked,
                overdueCount: result.overdueCount,
                overdueEmployeeIds: result.overdueEmployeeIds,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
