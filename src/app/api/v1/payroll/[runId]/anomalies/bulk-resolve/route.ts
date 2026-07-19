// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/[runId]/anomalies/bulk-resolve
// INFO 등급 이상 일괄 해소
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'
import {
    readAnomalyAggregate,
    updatePayrollRunInPhase,
    withLockedPayrollRunPhase,
} from '@/lib/payroll/phase-writer-service'

const schema = z.object({
    anomalyIds: z.array(z.string().min(1)).min(1).max(100),
    resolution: z.enum(['CONFIRMED_NORMAL', 'CORRECTED', 'WHITELISTED']),
    note: z.string().max(500).optional(),
})

export const POST = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params
        let body: unknown
        try {
            body = await req.json()
        } catch {
            throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
        }
        const parsed = schema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.')
        }
        const { anomalyIds, resolution, note } = parsed.data

        const candidate = await prisma.payrollRun.findUnique({
            where: { id: runId },
            select: { id: true, companyId: true, yearMonth: true },
        })
        if (!candidate) throw notFound('급여 실행을 찾을 수 없습니다.')
        // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인 급여 실행에만 접근 가능
        if (user.role !== ROLE.SUPER_ADMIN && candidate.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여 실행에 접근할 수 없습니다.')
        }

        const { ip, userAgent } = extractRequestMeta(req.headers)
        const resolvedCount = await withLockedPayrollRunPhase({
            candidate,
            expectedStatus: 'REVIEW',
            operation: 'payroll-anomaly-bulk-resolve',
            statusError: 'REVIEW 상태에서만 이상 항목을 해소할 수 있습니다.',
            mutate: async (tx, run) => {
                const eligible = await tx.payrollAnomaly.findMany({
                    where: {
                        id: { in: anomalyIds },
                        payrollRunId: runId,
                        status: 'OPEN',
                    },
                    select: { id: true },
                })
                const { count } = await tx.payrollAnomaly.updateMany({
                    where: {
                        id: { in: eligible.map((anomaly) => anomaly.id) },
                        payrollRunId: runId,
                        status: 'OPEN',
                    },
                    data: {
                        status: resolution === 'WHITELISTED' ? 'WHITELISTED' : 'RESOLVED',
                        resolvedBy: user.employeeId,
                        resolvedAt: new Date(),
                        resolution,
                        whitelisted: resolution === 'WHITELISTED',
                        whitelistReason: resolution === 'WHITELISTED' ? (note ?? null) : null,
                    },
                })
                const aggregate = await readAnomalyAggregate(tx, runId)
                await updatePayrollRunInPhase(tx, run, 'REVIEW', aggregate)
                await tx.auditLog.create({
                    data: {
                        actorId: user.employeeId,
                        action: 'PAYROLL_ANOMALY_BULK_RESOLVE',
                        resourceType: 'PayrollRun',
                        resourceId: runId,
                        companyId: run.companyId,
                        changes: JSON.parse(
                            JSON.stringify({ resolution, anomalyIds, resolvedCount: count, note }),
                        ),
                        ipAddress: ip ?? null,
                        userAgent: userAgent ?? null,
                    },
                })
                return count
            },
        })

        return apiSuccess({ resolved: resolvedCount }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
