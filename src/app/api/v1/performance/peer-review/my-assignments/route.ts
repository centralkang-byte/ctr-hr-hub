// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 My Peer Review Assignments
// GET /api/v1/performance/peer-review/my-assignments
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/performance/peer-review/my-assignments ──

export const GET = withPermission(
    async (_req: NextRequest, _context, user: SessionUser) => {
        try {
            const nominations = await prisma.peerReviewNomination.findMany({
                where: {
                    nomineeId: user.employeeId,
                    status: 'NOMINATION_APPROVED',
                    cycle: { status: 'EVAL_OPEN' },
                },
                select: {
                    id: true,
                    cycleId: true,
                    employeeId: true,
                    createdAt: true,
                    employee: {
                        select: { id: true, name: true, nameEn: true, employeeNo: true },
                    },
                    cycle: {
                        select: { id: true, name: true, evalEnd: true },
                    },
                    answer: {
                        select: { id: true, submittedAt: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            })

            const assignments = nominations.map((n) => ({
                nominationId: n.id,
                cycleId: n.cycleId,
                cycleName: n.cycle.name,
                employeeId: n.employeeId,
                employeeName: n.employee.name,
                employeeNameEn: n.employee.nameEn,
                deadline: n.cycle.evalEnd,
                isCompleted: n.answer !== null,
                submittedAt: n.answer?.submittedAt ?? null,
            }))

            return apiSuccess({
                total: assignments.length,
                completed: assignments.filter((a) => a.isCompleted).length,
                pending: assignments.filter((a) => !a.isCompleted).length,
                assignments,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
