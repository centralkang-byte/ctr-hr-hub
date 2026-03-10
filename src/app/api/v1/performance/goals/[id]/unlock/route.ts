// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Goal Unlock
// POST /api/v1/performance/goals/:id/unlock
// HR-only: unlock a locked goal for editing
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/performance/goals/:id/unlock ──────────
// Permission: HR_ADMIN or SUPER_ADMIN only

export const POST = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { id } = await context.params

        try {
            const goal = await prisma.mboGoal.findFirst({
                where: { id, companyId: user.companyId },
            })

            if (!goal) throw notFound('목표를 찾을 수 없습니다.')

            if (!goal.isLocked) {
                throw badRequest('이미 잠금 해제된 목표입니다.')
            }

            const updated = await prisma.mboGoal.update({
                where: { id },
                data: { isLocked: false },
            })

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.goal.unlock',
                resourceType: 'mboGoal',
                resourceId: id,
                companyId: goal.companyId,
                changes: { employeeId: goal.employeeId, title: goal.title },
                ip,
                userAgent,
            })

            return apiSuccess({
                id: updated.id,
                isLocked: updated.isLocked,
                message: '목표 잠금이 해제되었습니다.',
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
