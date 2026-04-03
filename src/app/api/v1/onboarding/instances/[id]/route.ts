// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/instances/[id]
// Single onboarding detail with tasks grouped by milestone
// E-1: GP#2 Onboarding Pipeline
//
// 🚨 IDOR Protection (Trap 10): Only employee themselves,
//    direct manager, or HR_ADMIN can access this endpoint.
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { forbidden, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { groupTasksByMilestone, calculateProgress, getCurrentMilestone } from '@/lib/onboarding/milestone-helpers'
import { checkSignOffEligibility } from '@/lib/onboarding/sign-off'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export const GET = withPermission(
    async (_req, ctx, user: SessionUser) => {
        const { id } = await ctx.params

        const onboarding = await prisma.employeeOnboarding.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        hireDate: true,
                        assignments: {
                            where: { isPrimary: true, endDate: null },
                            select: {
                                department: { select: { id: true, name: true } },
                                company: { select: { id: true, name: true } },
                                position: {
                                    select: {
                                        id: true,
                                        titleKo: true,
                                        reportsTo: {
                                            select: {
                                                assignments: {
                                                    where: { isPrimary: true, endDate: null },
                                                    select: { employee: { select: { id: true, name: true } } },
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
                buddy: { select: { id: true, name: true } },
                signer: { select: { id: true, name: true } },
                tasks: {
                    include: {
                        task: {
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                assigneeType: true,
                                dueDaysAfter: true,
                                sortOrder: true,
                                isRequired: true,
                                category: true,
                            },
                        },
                        assignee: { select: { id: true, name: true } },
                        completer: { select: { id: true, name: true } },
                    },
                    orderBy: { task: { sortOrder: 'asc' } },
                },
                checkins: {
                    orderBy: { submittedAt: 'asc' },
                },
            },
        })

        if (!onboarding) throw notFound('Onboarding instance not found')

        // 🚨 IDOR check: employee themselves, their manager, or HR_ADMIN
        const isEmployee = user.employeeId === onboarding.employeeId
        const empPrimary = extractPrimaryAssignment(onboarding.employee?.assignments ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const managerAssignments = (empPrimary as any)?.position?.reportsTo?.assignments ?? []
        const mgrPrimary = extractPrimaryAssignment(managerAssignments)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const managerEmp = (mgrPrimary as any)?.employee
        const managerId = managerEmp?.id
        const isManager = user.employeeId === managerId
        const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

        if (!isEmployee && !isManager && !isHrAdmin) {
            throw forbidden('You do not have permission to view this onboarding instance')
        }

        // Group tasks by milestone
        const hireDate = onboarding.employee?.hireDate
        const tasksGrouped = groupTasksByMilestone(onboarding.tasks, hireDate)
        const progress = calculateProgress(onboarding.tasks)

        // Convert Map to serializable object
        const milestoneGroups: Record<string, typeof onboarding.tasks> = {}
        for (const [milestone, tasks] of tasksGrouped.entries()) {
            milestoneGroups[milestone] = tasks
        }

        // Blocked history
        const blockedHistory = onboarding.tasks
            .filter((t) => t.blockedAt != null)
            .map((t) => ({
                taskId: t.id,
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

        // Sign-off eligibility
        const signOffEligibility = await checkSignOffEligibility(onboarding.id)

        return apiSuccess({
            id: onboarding.id,
            status: onboarding.status,
            planType: onboarding.planType,
            startedAt: onboarding.startedAt,
            completedAt: onboarding.completedAt,
            signOff: {
                signedOffBy: onboarding.signer,
                signedOffAt: onboarding.signOffAt,
                note: onboarding.signOffNote,
            },

            employee: {
                id: onboarding.employee?.id,
                name: onboarding.employee?.name,
                email: onboarding.employee?.email,
                hireDate: onboarding.employee?.hireDate,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                department: (empPrimary as any)?.department?.name,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                company: (empPrimary as any)?.company?.name,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                position: (empPrimary as any)?.position?.titleKo,
                manager: managerId
                    ? { id: managerId, name: managerEmp?.name }
                    : null,
            },
            buddy: onboarding.buddy,

            progress,
            currentMilestone: hireDate ? getCurrentMilestone(hireDate) : null,
            milestoneGroups,
            blockedHistory,
            signOffEligibility,

            checkins: onboarding.checkins.map((c) => ({
                id: c.id,
                milestone: c.milestone,
                checkinWeek: c.checkinWeek,
                mood: c.mood,
                energy: c.energy,
                belonging: c.belonging,
                comment: c.comment,
                aiSummary: c.aiSummary,
                submittedAt: c.submittedAt,
            })),
        })
    },
    perm(MODULE.ONBOARDING, ACTION.VIEW),
)
