// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Sign-off Logic
// src/lib/onboarding/sign-off.ts
//
// E-1: Manager sign-off workflow for onboarding completion
//
// Flow:
//   1. checkSignOffEligibility — verify all required tasks done
//   2. executeSignOff — mark onboarding as COMPLETED
//
// 🚨 Sign-off task activation happens synchronously inside
//    $transaction in the task status API — NOT via events.
//    See Trap 8 in E-1 prompt.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type { OnboardingMilestone } from '@/generated/prisma/client'

// ─── Types ────────────────────────────────────────────────

export interface SignOffEligibility {
    eligible: boolean
    reason?: string
    requiredTotal: number
    requiredDone: number
    remainingTasks: string[]
    blockedHistory: Array<{
        taskTitle: string
        reason: string
        duration: string
        blockedAt: Date | null
        unblockedAt: Date | null
    }>
    checkinSummary: Array<{
        milestone: OnboardingMilestone | null
        checkinWeek: number
        mood: string
        energy: number
        belonging: number
    }>
}

// ─── Eligibility Check ────────────────────────────────────

export async function checkSignOffEligibility(onboardingId: string): Promise<SignOffEligibility> {
    const onboarding = await prisma.employeeOnboarding.findUnique({
        where: { id: onboardingId },
        include: {
            tasks: {
                include: { task: true },
            },
            checkins: {
                orderBy: { submittedAt: 'asc' },
            },
        },
    })

    if (!onboarding) {
        return {
            eligible: false,
            reason: 'Onboarding not found.',
            requiredTotal: 0,
            requiredDone: 0,
            remainingTasks: [],
            blockedHistory: [],
            checkinSummary: [],
        }
    }

    // Filter required tasks, excluding the sign-off task itself
    const requiredTasks = onboarding.tasks.filter((t) => {
        const isSignOffTask = t.task.title.includes('Sign-off') || t.task.title.includes('서명')
        return t.task.isRequired && !isSignOffTask
    })

    const requiredDoneTasks = requiredTasks.filter((t) => t.status === 'DONE')
    const remainingTasks = requiredTasks
        .filter((t) => t.status !== 'DONE')
        .map((t) => t.task.title)

    // Blocked history (tasks that were or are blocked)
    const blockedHistory = onboarding.tasks
        .filter((t) => t.blockedAt != null)
        .map((t) => {
            const blockedMs = t.unblockedAt
                ? new Date(t.unblockedAt).getTime() - new Date(t.blockedAt!).getTime()
                : Date.now() - new Date(t.blockedAt!).getTime()
            const days = Math.ceil(blockedMs / (1000 * 60 * 60 * 24))
            return {
                taskTitle: t.task.title,
                reason: t.blockedReason ?? '',
                duration: `${days}일`,
                blockedAt: t.blockedAt,
                unblockedAt: t.unblockedAt,
            }
        })

    // Checkin summary
    const checkinSummary = onboarding.checkins.map((c) => ({
        milestone: c.milestone,
        checkinWeek: c.checkinWeek,
        mood: c.mood,
        energy: c.energy,
        belonging: c.belonging,
    }))

    const eligible = remainingTasks.length === 0

    return {
        eligible,
        reason: eligible ? undefined : `${remainingTasks.length}개 필수 태스크 미완료`,
        requiredTotal: requiredTasks.length,
        requiredDone: requiredDoneTasks.length,
        remainingTasks,
        blockedHistory,
        checkinSummary,
    }
}

// ─── Execute Sign-off ─────────────────────────────────────

export async function executeSignOff(
    onboardingId: string,
    managerId: string,
    note?: string,
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        // 1. Verify eligibility inside transaction
        const onboarding = await tx.employeeOnboarding.findUnique({
            where: { id: onboardingId },
            include: {
                tasks: { include: { task: true } },
            },
        })

        if (!onboarding) throw new Error('Onboarding not found')

        const requiredTasks = onboarding.tasks.filter((t) => {
            const isSignOff = t.task.title.includes('Sign-off') || t.task.title.includes('서명')
            return t.task.isRequired && !isSignOff
        })
        const allDone = requiredTasks.every((t) => t.status === 'DONE')
        if (!allDone) throw new Error('Not all required tasks are completed')

        // 2. Set EmployeeOnboarding sign-off fields
        await tx.employeeOnboarding.update({
            where: { id: onboardingId },
            data: {
                signOffBy: managerId,
                signOffAt: new Date(),
                signOffNote: note ?? null,
                status: 'COMPLETED',
                completedAt: new Date(),
            },
        })

        // 3. Mark the sign-off task itself as DONE
        const signOffTask = onboarding.tasks.find((t) =>
            t.task.title.includes('Sign-off') || t.task.title.includes('서명'),
        )
        if (signOffTask) {
            await tx.employeeOnboardingTask.update({
                where: { id: signOffTask.id },
                data: {
                    status: 'DONE',
                    completedBy: managerId,
                    completedAt: new Date(),
                },
            })
        }
    })

    // 4. Fire-and-forget: Emit ONBOARDING_COMPLETED event (outside TX)
    // TODO: Integrate with event system when handlers are ready
    // emitDomainEvent('ONBOARDING_COMPLETED', { onboardingId, signedOffBy: managerId })

    // 5. TODO: Trigger probation evaluation (GP#4 integration)
    // 6. TODO: Update Employee.status if needed
}
