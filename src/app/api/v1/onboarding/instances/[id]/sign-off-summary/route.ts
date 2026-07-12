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
import { getActiveTeamMemberIds } from '@/lib/employee/direct-reports'
import { checkSignOffEligibility } from '@/lib/onboarding/sign-off'
import { calculateProgress, groupTasksByMilestone } from '@/lib/onboarding/milestone-helpers'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { resolveOnboardingCompanyId } from '@/lib/onboarding/tenant-guard'

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
        const empPrimary = extractPrimaryAssignment(onboarding.employee?.assignments ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mgrPrimary = extractPrimaryAssignment((empPrimary as any)?.position?.reportsTo?.assignments ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const managerId = (mgrPrimary as any)?.employeeId
        // ⑥-C Codex G2 P1: MANAGER 는 reportsTo 일치 + "현재 자사 primary 활성 발령" 직속부하일 때만 —
        // 목록 스코프(getActiveTeamMemberIds)와 동일 기준으로 통일 (비활성/전출 직원 by-id 접근 차단)
        const isManager =
            user.employeeId === managerId &&
            (user.role !== ROLE.MANAGER ||
                (await getActiveTeamMemberIds(user.employeeId ?? '', user.companyId)).includes(onboarding.employeeId))
        const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
        // 멀티테넌트: 비-SUPER는 동일 법인만 (HR/매니저 경로 법인 결합)
        const onboardingCompanyId = await resolveOnboardingCompanyId({ companyId: onboarding.companyId, employeeId: onboarding.employeeId })
        const sameCompany = onboardingCompanyId != null && onboardingCompanyId === user.companyId
        if (user.role !== ROLE.SUPER_ADMIN && (!sameCompany || (!isManager && !isHrAdmin))) throw forbidden('Access denied')

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
