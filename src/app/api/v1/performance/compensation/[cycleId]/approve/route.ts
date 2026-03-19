// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Compensation Approve
// POST /api/v1/performance/compensation/[cycleId]/approve
//
// GEMINI FIX #4: Uses TRANSITIONS from pipeline.ts as SSOT
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import { TRANSITIONS } from '@/lib/performance/pipeline'
import type { SessionUser } from '@/types'
import type { CycleStatus } from '@/generated/prisma/client'

const approveSchema = z.object({
    acknowledgeExceptions: z.boolean().default(false),
    approverComment: z.string().optional(),
})

// ─── POST /api/v1/performance/compensation/[cycleId]/approve

export const POST = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { cycleId } = await context.params
        const body: unknown = await req.json()
        const parsed = approveSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const { acknowledgeExceptions, approverComment } = parsed.data

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: {
                    id: cycleId,
                    ...(user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }),
                },
                select: { id: true, status: true, companyId: true, name: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')
            if (cycle.status !== 'COMP_REVIEW') {
                throw badRequest('보상 기획(COMP_REVIEW) 단계에서만 승인 가능합니다.')
            }

            // GEMINI FIX #4: Validate transition via TRANSITIONS map
            const nextStatus = TRANSITIONS['COMP_REVIEW']
            if (!nextStatus) {
                throw badRequest('COMP_REVIEW → 다음 단계 전환이 불가합니다.')
            }

            // Check all employees with grades are processed
            const totalWithGrade = await prisma.performanceReview.count({
                where: { cycleId, companyId: cycle.companyId, finalGrade: { not: null } },
            })
            const processedCount = await prisma.compensationHistory.count({
                where: { cycleId, companyId: cycle.companyId },
            })

            if (processedCount < totalWithGrade) {
                throw badRequest(
                    `${totalWithGrade - processedCount}명의 보상이 미처리 상태입니다. 전체 처리 후 승인해주세요.`,
                )
            }

            // Check exceptions
            const exceptionCount = await prisma.compensationHistory.count({
                where: { cycleId, companyId: cycle.companyId, isException: true },
            })

            if (exceptionCount > 0 && !acknowledgeExceptions) {
                throw badRequest(
                    `${exceptionCount}건의 예외가 있습니다. acknowledgeExceptions: true로 확인해주세요.`,
                )
            }

            // Transition: COMP_REVIEW → COMP_COMPLETED
            await prisma.performanceCycle.update({
                where: { id: cycleId },
                data: { status: nextStatus as CycleStatus },
            })

            // Fire event
            void eventBus.publish(DOMAIN_EVENTS.COMP_APPROVED, {
                ctx: {
                    companyId: cycle.companyId,
                    actorId: user.employeeId,
                    occurredAt: new Date(),
                },
                cycleId,
                companyId: cycle.companyId,
                approvedBy: user.employeeId,
                totalEmployees: processedCount,
                exceptionCount,
                approverComment: approverComment ?? '',
            })

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.compensation.approve',
                resourceType: 'performanceCycle',
                resourceId: cycleId,
                companyId: cycle.companyId,
                changes: {
                    transition: `${cycle.status} → ${nextStatus}`,
                    processedCount,
                    exceptionCount,
                    approverComment,
                },
                ip,
                userAgent,
            })

            return apiSuccess({
                cycleId,
                newStatus: nextStatus,
                processedCount,
                exceptionCount,
                message: '보상 기획이 승인되었습니다.',
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
