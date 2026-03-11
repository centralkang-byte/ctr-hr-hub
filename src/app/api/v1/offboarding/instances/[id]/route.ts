// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/offboarding/instances/[id]
// Single offboarding detail with tasks, assets, exit interview
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { isDirectManager } from '@/lib/auth/manager-check'
import type { SessionUser } from '@/types'

export const GET = withPermission(
    async (_req: NextRequest, ctx, user: SessionUser) => {
        const { id } = await ctx.params

        const offboarding = await prisma.employeeOffboarding.findFirst({
            where: {
                id,
                ...(user.role !== ROLE.SUPER_ADMIN
                    ? { employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } } }
                    : {}),
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        hireDate: true,
                        assignments: {
                            where: { isPrimary: true, endDate: null },
                            take: 1,
                            include: {
                                department: { select: { id: true, name: true } },
                                position: { select: { titleKo: true } },
                                company: { select: { name: true, code: true, countryCode: true } },
                            },
                        },
                    },
                },
                handoverTo: { select: { id: true, name: true } },
                offboardingTasks: {
                    include: {
                        task: {
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                assigneeType: true,
                                dueDaysBefore: true,
                                isRequired: true,
                                sortOrder: true,
                            },
                        },
                        assignee: { select: { id: true, name: true } },
                        completer: { select: { id: true, name: true } },
                    },
                    orderBy: { dueDate: 'asc' },
                },
                assetReturns: true,
                checklist: { select: { id: true, name: true } },
            },
        })

        if (!offboarding) throw notFound('오프보딩 기록을 찾을 수 없습니다.')

        // ─── Access control ───────────────────────────────
        const isOwnOffboarding = user.employeeId === offboarding.employeeId
        const isHrOrSuperAdmin = user.role === ROLE.SUPER_ADMIN || user.role === 'HR_ADMIN'
        const isManager = await isDirectManager(user.employeeId, offboarding.employeeId)

        if (!isOwnOffboarding && !isHrOrSuperAdmin && !isManager) {
            throw forbidden('이 오프보딩 정보에 접근할 권한이 없습니다.')
        }

        // ─── Exit interview (isolation enforced) ──────────
        let exitInterview = null
        if (isHrOrSuperAdmin) {
            // Only HR_ADMIN and SUPER_ADMIN can see exit interview data
            exitInterview = await prisma.exitInterview.findFirst({
                where: { employeeOffboardingId: id },
                include: { interviewer: { select: { id: true, name: true } } },
            })
        }

        // ─── Enrich with computed fields ──────────────────
        const now = Date.now()
        const daysRemaining = Math.ceil(
            (new Date(offboarding.lastWorkingDate).getTime() - now) / 86_400_000,
        )

        const totalTasks = offboarding.offboardingTasks.length
        const doneTasks = offboarding.offboardingTasks.filter((t) => t.status === 'DONE').length
        const blockedTasks = offboarding.offboardingTasks.filter((t) => t.status === 'BLOCKED').length
        const inProgressTasks = offboarding.offboardingTasks.filter((t) => t.status === 'IN_PROGRESS').length
        const pendingTasks = offboarding.offboardingTasks.filter((t) => t.status === 'PENDING').length

        const assignment = offboarding.employee?.assignments?.[0]

        return apiSuccess({
            id: offboarding.id,
            employeeId: offboarding.employeeId,
            employeeName: offboarding.employee?.name ?? '—',
            hireDate: offboarding.employee?.hireDate,
            department: assignment?.department?.name ?? '—',
            departmentId: assignment?.department?.id,
            position: assignment?.position?.titleKo ?? '—',
            company: assignment?.company?.name ?? '—',
            companyCode: assignment?.company?.code ?? '—',
            countryCode: assignment?.company?.countryCode ?? 'KR',
            resignType: offboarding.resignType,
            resignReasonCode: offboarding.resignReasonCode,
            resignReasonDetail: offboarding.resignReasonDetail,
            lastWorkingDate: offboarding.lastWorkingDate,
            daysRemaining,
            status: offboarding.status,
            handoverTo: offboarding.handoverTo,
            checklistName: offboarding.checklist?.name,
            progress: {
                done: doneTasks,
                total: totalTasks,
                blocked: blockedTasks,
                inProgress: inProgressTasks,
                pending: pendingTasks,
                percentage: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
            },
            tasks: offboarding.offboardingTasks.map((t) => ({
                id: t.id,
                taskId: t.taskId,
                title: t.task.title,
                description: t.task.description,
                assigneeType: t.task.assigneeType,
                dueDaysBefore: t.task.dueDaysBefore,
                isRequired: t.task.isRequired,
                sortOrder: t.task.sortOrder,
                status: t.status,
                dueDate: t.dueDate,
                assignee: t.assignee,
                completedBy: t.completer,
                completedAt: t.completedAt,
                blockedReason: t.blockedReason,
                blockedAt: t.blockedAt,
                note: t.note,
            })),
            assetReturns: offboarding.assetReturns,
            exitInterview,
            exitInterviewCompleted: offboarding.exitInterviewCompleted,
            severanceCalculated: offboarding.severanceCalculated,
            itAccountDeactivated: offboarding.itAccountDeactivated,
            startedAt: offboarding.startedAt,
            completedAt: offboarding.completedAt,
        })
    },
    perm(MODULE.ONBOARDING, ACTION.VIEW),
)
