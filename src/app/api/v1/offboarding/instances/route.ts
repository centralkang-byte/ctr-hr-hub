// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/offboarding/instances
// List active offboarding instances with progress + D-Day
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { apiPaginated, buildPagination } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
    async (req: NextRequest, _ctx, user: SessionUser) => {
        const p = Object.fromEntries(req.nextUrl.searchParams)
        const page = Math.max(1, Number(p.page ?? 1))
        const limit = Math.min(50, Math.max(1, Number(p.limit ?? 20)))
        const statusFilter = p.status as 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | undefined
        const resignTypeFilter = p.resignType as string | undefined
        const companyId =
            user.role === 'SUPER_ADMIN' ? (p.companyId ?? undefined) : user.companyId

        const where: Prisma.EmployeeOffboardingWhereInput = {
            ...(statusFilter ? { status: statusFilter } : { status: { in: ['IN_PROGRESS', 'COMPLETED'] } }),
            ...(resignTypeFilter ? { resignType: resignTypeFilter as 'VOLUNTARY' | 'INVOLUNTARY' | 'RETIREMENT' | 'CONTRACT_END' } : {}),
            ...(companyId
                ? { employee: { assignments: { some: { companyId, isPrimary: true, endDate: null } } } }
                : {}),
        }

        const [total, offboardings] = await Promise.all([
            prisma.employeeOffboarding.count({ where }),
            prisma.employeeOffboarding.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null },
                                take: 1,
                                include: {
                                    department: { select: { name: true } },
                                    position: { select: { titleKo: true } },
                                    company: { select: { name: true, code: true } },
                                },
                            },
                        },
                    },
                    offboardingTasks: {
                        include: {
                            task: { select: { isRequired: true, title: true } },
                        },
                    },
                    exitInterviews: { select: { id: true }, take: 1 },
                },
                orderBy: { lastWorkingDate: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ])

        const now = Date.now()

        const enriched = offboardings.map((ob) => {
            const totalTasks = ob.offboardingTasks.length
            const doneTasks = ob.offboardingTasks.filter((t) => t.status === 'DONE').length
            const blockedTasks = ob.offboardingTasks.filter((t) => t.status === 'BLOCKED').length
            const daysRemaining = Math.ceil(
                (new Date(ob.lastWorkingDate).getTime() - now) / 86_400_000,
            )

            const assignment = ob.employee?.assignments?.[0]

            return {
                id: ob.id,
                employeeId: ob.employeeId,
                employeeName: ob.employee?.name ?? '—',
                department: assignment?.department?.name ?? '—',
                position: assignment?.position?.titleKo ?? '—',
                company: assignment?.company?.name ?? '—',
                companyCode: assignment?.company?.code ?? '—',
                resignType: ob.resignType,
                lastWorkingDate: ob.lastWorkingDate,
                daysRemaining,
                status: ob.status,
                progress: { done: doneTasks, total: totalTasks, percentage: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0 },
                blockedCount: blockedTasks,
                hasExitInterview: ob.exitInterviews.length > 0,
                startedAt: ob.startedAt,
                completedAt: ob.completedAt,
            }
        })

        return apiPaginated(enriched, buildPagination(page, limit, total))
    },
    perm(MODULE.OFFBOARDING, ACTION.VIEW),
)
