// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Skip Peer Review Nomination
// PUT /api/v1/performance/peer-review/nominations/:id/skip
//
// GEMINI FIX #5: HR can skip nominations to prevent
// "eternally PENDING" blocker when reviewer resigns.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── PUT /api/v1/performance/peer-review/nominations/:id/skip

export const PUT = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { id } = await context.params

        try {
            const nomination = await prisma.peerReviewNomination.findUnique({
                where: { id },
                select: {
                    id: true, cycleId: true, employeeId: true, nomineeId: true, status: true,
                    cycle: { select: { companyId: true } },
                },
            })

            if (!nomination) throw notFound('지정 정보를 찾을 수 없습니다.')

            if (nomination.status === 'NOMINATION_COMPLETED') {
                throw badRequest('이미 완료된 평가는 건너뛸 수 없습니다.')
            }

            if (nomination.status === 'NOMINATION_REJECTED') {
                throw badRequest('이미 거절된 지정 정보입니다.')
            }

            await prisma.peerReviewNomination.update({
                where: { id },
                data: { status: 'NOMINATION_REJECTED' },
            })

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.peer-review.skip',
                resourceType: 'peerReviewNomination',
                resourceId: id,
                companyId: nomination.cycle.companyId,
                changes: { nomineeId: nomination.nomineeId, reason: 'HR_SKIP' },
                ip,
                userAgent,
            })

            return apiSuccess({
                id: nomination.id,
                status: 'NOMINATION_REJECTED',
                message: '동료평가 지정이 건너뛰기 처리되었습니다.',
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
