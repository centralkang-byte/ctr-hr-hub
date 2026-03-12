// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/onboarding/instances/[id]/tasks/[taskId]/status
// Task status transition (state machine)
// E-1: GP#2 Onboarding Pipeline
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
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
    async (req, ctx, user: SessionUser) => {
        const { id: onboardingId, taskId } = await ctx.params
        const body = await req.json()
        const parsed = statusSchema.safeParse(body)
        if (!parsed.success) throw badRequest(parsed.error.issues.map((e) => e.message).join(', '))
        const { status: targetStatus, blockedReason, note } = parsed.data

        const result = await prisma.$transaction(async (tx) => {
            const task = await tx.employeeOnboardingTask.findFirst({
                where: { id: taskId, employeeOnboardingId: onboardingId },
                include: { task: true, employeeOnboarding: true },
            })

            if (!task) throw notFound('Onboarding task not found')

            const isAssignee = task.assigneeId === user.employeeId
            const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
            if (!isAssignee && !isHrAdmin) throw forbidden('Only the task assignee or HR Admin can change task status')

            const validation = validateTaskTransition({
                currentStatus: task.status,
                targetStatus: targetStatus as typeof task.status,
                isRequired: task.task.isRequired,
                blockedReason,
            })
            if (!validation.allowed) throw badRequest(validation.error ?? 'Invalid transition')

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateData: any = { // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma where clause dynamic type
                status: targetStatus,
                note: note ?? task.note,
            }

            if (targetStatus === 'BLOCKED') {
                updateData.blockedReason = blockedReason
                updateData.blockedAt = new Date()
                updateData.unblockedAt = null
            } else if (task.status === 'BLOCKED' && (targetStatus === 'PENDING' || targetStatus === 'IN_PROGRESS')) {
                updateData.unblockedAt = new Date()
            }

            if (targetStatus === 'DONE') {
                updateData.completedBy = user.employeeId
                updateData.completedAt = new Date()
            }

            const updated = await tx.employeeOnboardingTask.update({
                where: { id: taskId },
                data: updateData,
                include: { task: true },
            })

            // 🚨 Trap 8: Synchronous check inside $transaction
            if (targetStatus === 'DONE') {
                const allTasks = await tx.employeeOnboardingTask.findMany({
                    where: { employeeOnboardingId: onboardingId },
                    include: { task: true },
                })

                const requiredTasks = allTasks.filter((t) => t.task.isRequired)
                const allRequiredDone = requiredTasks.every((t) => t.status === 'DONE')

                if (allRequiredDone) {
                    await tx.employeeOnboarding.update({
                        where: { id: onboardingId },
                        data: { status: 'IN_PROGRESS' },
                    })
                }
            }

            return updated
        })

        return apiSuccess(result)
    },
    perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
