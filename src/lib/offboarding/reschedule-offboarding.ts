// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Reschedule Logic
// src/lib/offboarding/reschedule-offboarding.ts
//
// E-2: GP#2 Offboarding Pipeline
// Updates lastWorkingDate and recalculates all task dueDates
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'

export async function rescheduleOffboarding(
    offboardingId: string,
    newLastWorkingDate: Date,
    reason: string,
    actorId: string,
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        // 1. Fetch offboarding with tasks
        const offboarding = await tx.employeeOffboarding.findUnique({
            where: { id: offboardingId },
            include: {
                offboardingTasks: {
                    include: {
                        task: { select: { dueDaysBefore: true } },
                    },
                },
            },
        })

        if (!offboarding) throw new Error('Offboarding not found')

        // 2. Validate: must be IN_PROGRESS
        if (offboarding.status !== 'IN_PROGRESS') {
            throw new Error('완료 또는 취소된 오프보딩은 일정을 변경할 수 없습니다.')
        }

        // 3. Validate: new date must be in the future
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (newLastWorkingDate < today) {
            throw new Error('새 퇴직일은 오늘 이후여야 합니다.')
        }

        // 4. Store old date for audit
        const oldDate = offboarding.lastWorkingDate

        // 5. Update lastWorkingDate on offboarding
        await tx.employeeOffboarding.update({
            where: { id: offboardingId },
            data: { lastWorkingDate: newLastWorkingDate },
        })

        // 6. Update employee.resignDate
        await tx.employee.update({
            where: { id: offboarding.employeeId },
            data: { resignDate: newLastWorkingDate },
        })

        // 7. Recalculate ALL task dueDates
        for (const task of offboarding.offboardingTasks) {
            const dueDaysBefore = task.task.dueDaysBefore ?? 0
            const newDueDate = new Date(newLastWorkingDate.getTime() - dueDaysBefore * 24 * 60 * 60 * 1000)

            await tx.employeeOffboardingTask.update({
                where: { id: task.id },
                data: { dueDate: newDueDate },
            })
        }

        // 8. Log the change as employee history
        await tx.employeeHistory.create({
            data: {
                employeeId: offboarding.employeeId,
                changeType: 'RESIGN',
                effectiveDate: newLastWorkingDate,
                reason: `퇴직일 변경: ${oldDate.toISOString().split('T')[0]} → ${newLastWorkingDate.toISOString().split('T')[0]}. 사유: ${reason}`,
                approvedBy: actorId,
            },
        })
    })
}
