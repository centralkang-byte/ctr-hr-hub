// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Check-in Workflow
// POST /api/v1/performance/checkins
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import type { SessionUser } from '@/types'

const createSchema = z.object({
    cycleId: z.string().uuid(),
    employeeId: z.string().uuid().optional(),
    content: z.string().min(1).max(5000),
    type: z.enum(['MANAGER', 'EMPLOYEE']),
})

// ─── POST /api/v1/performance/checkins ───────────────────
// Creates a check-in record (OneOnOne with isCheckinRecord=true)

export const POST = withAuth(
    async (req: NextRequest, _context, user: SessionUser) => {
        const body: unknown = await req.json()
        const parsed = createSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const { cycleId, content, type } = parsed.data
        const targetEmployeeId = parsed.data.employeeId ?? user.employeeId

        try {
            // Verify cycle exists and is in CHECK_IN or ACTIVE status
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, companyId: true, status: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')

            if (!['ACTIVE', 'CHECK_IN'].includes(cycle.status)) {
                throw badRequest('현재 사이클 상태에서는 체크인을 생성할 수 없습니다.')
            }

            // Determine manager/employee IDs
            const managerId = type === 'MANAGER' ? user.employeeId : targetEmployeeId
            const employeeId = type === 'MANAGER' ? targetEmployeeId : user.employeeId

            // Create OneOnOne as checkin record
            const checkin = await prisma.oneOnOne.create({
                data: {
                    employeeId,
                    managerId,
                    companyId: cycle.companyId,
                    scheduledAt: new Date(),
                    completedAt: new Date(),
                    status: 'COMPLETED',
                    meetingType: 'GOAL_REVIEW',
                    notes: content,
                    cycleId,
                    isCheckinRecord: true,
                },
            })

            // Check if this completes the employee's check-in
            const managerCheckinCount = await prisma.oneOnOne.count({
                where: {
                    cycleId,
                    employeeId,
                    isCheckinRecord: true,
                },
            })

            const goalProgressCount = await prisma.mboProgress.count({
                where: {
                    goal: { cycleId, employeeId },
                },
            })

            const isComplete = managerCheckinCount >= 1 && goalProgressCount >= 1

            if (isComplete) {
                // Update review status
                await prisma.performanceReview.updateMany({
                    where: { cycleId, employeeId, status: 'GOAL_SETTING' },
                    data: { status: 'SELF_EVAL' },
                })

                void eventBus.publish(DOMAIN_EVENTS.CHECKIN_COMPLETED, {
                    ctx: {
                        companyId: cycle.companyId,
                        actorId: user.employeeId,
                        occurredAt: new Date(),
                    },
                    cycleId,
                    employeeId,
                    companyId: cycle.companyId,
                })
            }

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.checkin.create',
                resourceType: 'oneOnOne',
                resourceId: checkin.id,
                companyId: cycle.companyId,
                changes: { type, employeeId, isComplete },
                ip,
                userAgent,
            })

            return apiSuccess({
                id: checkin.id,
                type,
                employeeId,
                isComplete,
                message: isComplete
                    ? '체크인이 완료되었습니다.'
                    : '체크인 기록이 생성되었습니다.',
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
)
