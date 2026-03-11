// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/offboarding/instances/[id]/tasks/[taskId]/status
// Task status transition using shared state machine
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { validateTaskTransition } from '@/lib/shared/task-state-machine'
import type { SessionUser } from '@/types'

const statusSchema = z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'SKIPPED']),
    blockedReason: z.string().optional(),
    note: z.string().optional(),
})

export const PUT = withPermission(
    async (req: NextRequest, ctx, user: SessionUser) => {
        const params = await ctx.params
        const offboardingId = params.id
        const taskId = params.taskId

        const body = await req.json()
        const parsed = statusSchema.safeParse(body)
        if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

        const { status: targetStatus, blockedReason, note } = parsed.data

        // Fetch task with offboarding and template task info
        const task = await prisma.employeeOffboardingTask.findFirst({
            where: { id: taskId, employeeOffboardingId: offboardingId },
            include: {
                task: { select: { isRequired: true, title: true } },
                employeeOffboarding: {
                    select: {
                        status: true,
                        employeeId: true,
                        employee: {
                            select: {
                                assignments: {
                                    where: { isPrimary: true, endDate: null },
                                    select: { companyId: true },
                                    take: 1,
                                },
                            },
                        },
                    },
                },
            },
        })

        if (!task) throw notFound('태스크를 찾을 수 없습니다.')

        // Company scoping
        const taskCompanyId = task.employeeOffboarding.employee?.assignments?.[0]?.companyId
        if (user.role !== ROLE.SUPER_ADMIN && taskCompanyId && taskCompanyId !== user.companyId) {
            throw forbidden('다른 법인의 태스크에 접근할 수 없습니다.')
        }

        // Validate offboarding is still active
        if (task.employeeOffboarding.status !== 'IN_PROGRESS') {
            throw badRequest('진행 중인 오프보딩만 태스크 상태를 변경할 수 있습니다.')
        }

        // Validate state transition
        const transition = validateTaskTransition({
            currentStatus: task.status,
            targetStatus,
            isRequired: task.task.isRequired,
            blockedReason,
        })

        if (!transition.allowed) {
            throw badRequest(transition.error ?? '유효하지 않은 상태 전환입니다.')
        }

        // Execute update in transaction
        const result = await prisma.$transaction(async (tx) => {
            const updateData: Record<string, unknown> = {
                status: targetStatus,
                note: note ?? task.note,
            }

            // Handle BLOCKED
            if (targetStatus === 'BLOCKED') {
                updateData.blockedReason = blockedReason
                updateData.blockedAt = new Date()
                updateData.unblockedAt = null
            }

            // Handle unblock (BLOCKED → PENDING or IN_PROGRESS)
            if (task.status === 'BLOCKED' && (targetStatus === 'PENDING' || targetStatus === 'IN_PROGRESS')) {
                updateData.unblockedAt = new Date()
            }

            // Handle DONE
            if (targetStatus === 'DONE') {
                updateData.completedBy = user.employeeId
                updateData.completedAt = new Date()
            }

            const updated = await tx.employeeOffboardingTask.update({
                where: { id: taskId },
                data: updateData,
            })

            // Check if all required tasks are done → auto-complete offboarding
            // 🚨 SYNCHRONOUS inside transaction (no event emission here → no infinite loop)
            if (targetStatus === 'DONE') {
                const allTasks = await tx.employeeOffboardingTask.findMany({
                    where: { employeeOffboardingId: offboardingId },
                    include: { task: { select: { isRequired: true } } },
                })

                const requiredTasks = allTasks.filter((t) => t.task.isRequired)
                const allRequiredDone = requiredTasks.every((t) => t.status === 'DONE')

                if (allRequiredDone) {
                    // All required done — mark offboarding ready for sign-off (not auto-complete)
                    // Auto-completion requires explicit sign-off from HR
                    // Just flag it as ready
                    await tx.employeeOffboarding.update({
                        where: { id: offboardingId },
                        data: { severanceCalculated: true }, // signal that completion check passed
                    })
                }
            }

            return updated
        })

        return apiSuccess({
            id: result.id,
            status: result.status,
            blockedReason: result.blockedReason,
            blockedAt: result.blockedAt,
            unblockedAt: result.unblockedAt,
            completedBy: result.completedBy,
            completedAt: result.completedAt,
        })
    },
    perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
