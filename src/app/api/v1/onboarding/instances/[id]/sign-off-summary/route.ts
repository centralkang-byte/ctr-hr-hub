// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/instances/[id]/sign-off-summary
// Sign-off review data for the sign-off screen
// E-1: GP#2 Onboarding Pipeline
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { checkSignOffEligibility } from '@/lib/onboarding/sign-off'
import { calculateProgress, groupTasksByMilestone } from '@/lib/onboarding/milestone-helpers'
import type { SessionUser } from '@/types'

export const GET = withPermission(
    async (_req, ctx, user: SessionUser) => {
        const { id: onboardingId } = await ctx.params

        const onboarding = await prisma.employeeOnboarding.findUnique({
            where: { id: onboardingId },
            include: {
                employee: {
                    select: {
                        hireDate: true,
                        assignments: {
                            where: { isPrimary: true, endDate: null },
                            select: {
                                position: {
                                    select: {
                                        reportsTo: {
                                            select: {
                                                assignments: {
                                                    where: { isPrimary: true, endDate: null },
                                                    select: { employeeId: true },
                                                    take: 1,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            take: 1,
                        },
                    },
                },
                tasks: { include: { task: true } },
                checkins: { orderBy: { submittedAt: 'asc' } },
            },
        })

        if (!onboarding) throw notFound('Onboarding not found')

        // Permission: manager or HR
        const managerId = onboarding.employee?.assignments?.[0]?.position?.reportsTo?.assignments?.[0]?.employeeId
        const isManager = user.employeeId === managerId
        const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
        if (!isManager && !isHrAdmin) throw forbidden('Access denied')

        const eligibility = await checkSignOffEligibility(onboardingId)
        const progress = calculateProgress(onboarding.tasks)
        const milestoneGroups = groupTasksByMilestone(onboarding.tasks, onboarding.employee?.hireDate)

        // Milestone breakdown
        const milestoneBreakdown: Record<string, { total: number; done: number }> = {}
        for (const [milestone, tasks] of milestoneGroups.entries()) {
            milestoneBreakdown[milestone] = {
                total: tasks.length,
                done: tasks.filter((t) => t.status === 'DONE').length,
            }
        }

        // Checkin trend
        const checkinTrend = onboarding.checkins.map((c) => ({
            milestone: c.milestone,
            checkinWeek: c.checkinWeek,
            mood: c.mood,
            energy: c.energy,
            belonging: c.belonging,
            date: c.submittedAt,
        }))

        // Blocked history
        const blockedHistory = onboarding.tasks
            .filter((t) => t.blockedAt != null)
            .map((t) => ({
                taskTitle: t.task.title,
                reason: t.blockedReason ?? '',
                blockedAt: t.blockedAt,
                unblockedAt: t.unblockedAt,
                durationDays: t.blockedAt
                    ? Math.ceil(
                        ((t.unblockedAt ? new Date(t.unblockedAt) : new Date()).getTime() -
                            new Date(t.blockedAt).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                    : 0,
            }))

        return apiSuccess({
            eligibility,
            progress,
            checkinTrend,
            blockedHistory,
            taskSummary: {
                ...progress,
                milestoneBreakdown,
            },
        })
    },
    perm(MODULE.ONBOARDING, ACTION.VIEW),
)
