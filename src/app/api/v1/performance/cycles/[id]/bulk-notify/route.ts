// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Bulk Notify
// POST /api/v1/performance/cycles/:cycleId/bulk-notify
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/performance/cycles/:cycleId/bulk-notify

export const POST = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { cycleId } = await context.params

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, companyId: true, status: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')
            if (!['FINALIZED', 'CLOSED'].includes(cycle.status)) {
                throw badRequest('결과 확정(FINALIZED) 이후에만 일괄 통보가 가능합니다.')
            }

            const now = new Date()

            // Find un-notified reviews
            const result = await prisma.performanceReview.updateMany({
                where: {
                    cycleId,
                    notifiedAt: null,
                    finalGrade: { not: null },
                },
                data: {
                    notifiedAt: now,
                    notifiedBy: user.employeeId,
                    status: 'NOTIFIED',
                },
            })

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.cycle.bulk-notify',
                resourceType: 'performanceCycle',
                resourceId: cycleId,
                companyId: cycle.companyId,
                changes: { notifiedCount: result.count },
                ip,
                userAgent,
            })

            return apiSuccess({
                notifiedCount: result.count,
                message: `${result.count}명에게 결과가 통보되었습니다.`,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
