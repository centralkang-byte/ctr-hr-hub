// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/[runId]/anomalies — GP#3 이상 항목 목록
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { buildPagination } from '@/lib/api'
import type { Prisma } from '@/generated/prisma/client'

const querySchema = z.object({
    status: z.enum(['OPEN', 'RESOLVED', 'WHITELISTED']).optional(),
    severity: z.enum(['CRITICAL', 'WARNING', 'INFO']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const GET = withPermission(
    async (req: NextRequest, context, _user) => {
        const { runId } = await context.params
        const url = new URL(req.url)
        const { status, severity, page, limit } = querySchema.parse(
            Object.fromEntries(url.searchParams),
        )

        const run = await prisma.payrollRun.findUnique({
            where: { id: runId },
            select: { id: true, status: true, companyId: true },
        })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

        const where: Prisma.PayrollAnomalyWhereInput = {
            payrollRunId: runId,
            ...(status && { status }),
            ...(severity && { severity }),
        }

        const [anomalies, total] = await Promise.all([
            prisma.payrollAnomaly.findMany({
                where,
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            employeeNo: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null },
                                take: 1,
                                include: {
                                    department: { select: { id: true, name: true } },
                                    position: { select: { id: true, titleKo: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.payrollAnomaly.count({ where }),
        ])

        // Summary counts (always full-run, not filtered)
        const allAnomalies = await prisma.payrollAnomaly.findMany({
            where: { payrollRunId: runId },
            select: { status: true, severity: true },
        })

        const open = allAnomalies.filter((a) => a.status === 'OPEN').length
        const resolved = allAnomalies.filter((a) => a.status === 'RESOLVED').length
        const whitelisted = allAnomalies.filter((a) => a.status === 'WHITELISTED').length

        return apiSuccess({
            anomalies,
            summary: {
                total: allAnomalies.length,
                open,
                resolved,
                whitelisted,
                bySeverity: {
                    CRITICAL: allAnomalies.filter((a) => a.severity === 'CRITICAL').length,
                    WARNING: allAnomalies.filter((a) => a.severity === 'WARNING').length,
                    INFO: allAnomalies.filter((a) => a.severity === 'INFO').length,
                },
                allResolved: open === 0,
            },
            pagination: buildPagination(page, limit, total),
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)
