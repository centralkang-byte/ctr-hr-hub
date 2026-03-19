// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/onboarding/instances
// List active onboarding instances (HR dashboard)
// E-1: GP#2 Onboarding Pipeline
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { calculateProgress, getCurrentMilestone } from '@/lib/onboarding/milestone-helpers'
import type { SessionUser } from '@/types'

export const GET = withPermission(
    async (req, _ctx, _user: SessionUser) => {
        const url = new URL(req.url)
        const page = parseInt(url.searchParams.get('page') ?? '1', 10)
        const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
        const companyId = url.searchParams.get('companyId') ?? undefined
        const statusFilter = url.searchParams.get('status') ?? undefined

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma where clause dynamic type
            planType: 'ONBOARDING',
            ...(companyId ? { companyId } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
        }

        const [total, instances] = await Promise.all([
            prisma.employeeOnboarding.count({ where }),
            prisma.employeeOnboarding.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            hireDate: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null },
                                select: {
                                    department: { select: { name: true } },
                                    company: { select: { name: true } },
                                },
                                take: 1,
                            },
                        },
                    },
                    buddy: { select: { id: true, name: true } },
                    tasks: {
                        select: { status: true },
                    },
                    signer: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ])

        const data = instances.map((inst) => {
            const progress = calculateProgress(inst.tasks)
            const blockedCount = inst.tasks.filter((t) => t.status === 'BLOCKED').length
            const hireDate = inst.employee?.hireDate

            return {
                id: inst.id,
                employeeId: inst.employeeId,
                employeeName: inst.employee?.name ?? '',
                department: inst.employee?.assignments?.[0]?.department?.name ?? '',
                company: inst.employee?.assignments?.[0]?.company?.name ?? '',
                hireDate,
                buddy: inst.buddy ? { id: inst.buddy.id, name: inst.buddy.name } : null,
                status: inst.status,
                progress,
                blockedCount,
                currentMilestone: hireDate ? getCurrentMilestone(hireDate) : null,
                signOffStatus: inst.signOffAt ? 'COMPLETED' : inst.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
                signOffBy: inst.signer ? inst.signer.name : null,
                startedAt: inst.startedAt,
                completedAt: inst.completedAt,
                createdAt: inst.createdAt,
            }
        })

        return apiPaginated(data, buildPagination(page, limit, total))
    },
    perm(MODULE.ONBOARDING, ACTION.VIEW),
)
