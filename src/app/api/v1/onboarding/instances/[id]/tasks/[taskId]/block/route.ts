// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/onboarding/instances/[id]/tasks/[taskId]/block
// Block a task (reason required)
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

const blockSchema = z.object({
    reason: z.string().min(1, 'Block reason is required'),
})

export const POST = withPermission(
    async (req, ctx, user: SessionUser) => {
        const { id: onboardingId, taskId } = await ctx.params
        const body = await req.json()
        const parsed = blockSchema.safeParse(body)
        if (!parsed.success) throw badRequest(parsed.error.issues.map((e) => e.message).join(', '))

        const task = await prisma.employeeOnboardingTask.findFirst({
            where: { id: taskId, employeeOnboardingId: onboardingId },
            include: { task: true },
        })
        if (!task) throw notFound('Onboarding task not found')

        const isAssignee = task.assigneeId === user.employeeId
        const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
        if (!isAssignee && !isHrAdmin) throw forbidden('Only the task assignee or HR Admin can block a task')

        const validation = validateTaskTransition({
            currentStatus: task.status,
            targetStatus: 'BLOCKED',
            isRequired: task.task.isRequired,
            blockedReason: parsed.data.reason,
        })
        if (!validation.allowed) throw badRequest(validation.error ?? 'Cannot block from current status')

        const updated = await prisma.employeeOnboardingTask.update({
            where: { id: taskId },
            data: {
                status: 'BLOCKED',
                blockedReason: parsed.data.reason,
                blockedAt: new Date(),
                unblockedAt: null,
            },
            include: { task: true },
        })

        return apiSuccess(updated)
    },
    perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
