// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/onboarding/instances/[id]/tasks/[taskId]/unblock
// Unblock a task
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

const unblockSchema = z.object({
    resumeStatus: z.enum(['PENDING', 'IN_PROGRESS']).default('PENDING'),
})

export const POST = withPermission(
    async (req, ctx, user: SessionUser) => {
        const { id: onboardingId, taskId } = await ctx.params
        const body = await req.json().catch(() => ({}))
        const parsed = unblockSchema.safeParse(body)
        if (!parsed.success) throw badRequest(parsed.error.issues.map((e) => e.message).join(', '))

        const task = await prisma.employeeOnboardingTask.findFirst({
            where: { id: taskId, employeeOnboardingId: onboardingId },
            include: { task: true },
        })
        if (!task) throw notFound('Onboarding task not found')

        const isAssignee = task.assigneeId === user.employeeId
        const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
        if (!isAssignee && !isHrAdmin) throw forbidden('Only the task assignee or HR Admin can unblock a task')

        if (task.status !== 'BLOCKED') throw badRequest('Task is not currently blocked')

        const validation = validateTaskTransition({
            currentStatus: task.status,
            targetStatus: parsed.data.resumeStatus,
            isRequired: task.task.isRequired,
        })
        if (!validation.allowed) throw badRequest(validation.error ?? 'Invalid unblock transition')

        const updated = await prisma.employeeOnboardingTask.update({
            where: { id: taskId },
            data: {
                status: parsed.data.resumeStatus,
                unblockedAt: new Date(),
            },
            include: { task: true },
        })

        return apiSuccess(updated)
    },
    perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
