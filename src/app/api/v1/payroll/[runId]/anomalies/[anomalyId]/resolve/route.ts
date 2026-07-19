// ═══════════════════════════════════════════════════════════
// PUT /api/v1/payroll/[runId]/anomalies/[anomalyId]/resolve
// 이상 항목 해소 (개별)
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
    resolution: z.enum(['CONFIRMED_NORMAL', 'CORRECTED', 'WHITELISTED']),
    note: z.string().max(500).optional(),
})

export const PUT = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId, anomalyId } = await context.params
        const body = await req.json()
        const { resolution, note } = schema.parse(body)

        const candidateAnomaly = await prisma.payrollAnomaly.findUnique({
            where: { id: anomalyId },
            select: {
                id: true,
                payrollRunId: true,
                payrollRun: {
                    select: { id: true, companyId: true, yearMonth: true },
                },
            },
        })
        if (!candidateAnomaly) throw notFound('이상 항목을 찾을 수 없습니다.')
        // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인만 (존재 oracle 차단 위해 runId-match보다 앞)
        if (user.role !== ROLE.SUPER_ADMIN && candidateAnomaly.payrollRun.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여 데이터에 접근할 수 없습니다.')
        }
        if (candidateAnomaly.payrollRunId !== runId) throw badRequest('잘못된 요청입니다.')

        const { ip, userAgent } = extractRequestMeta(req.headers)
        const updated = await withLockedPayrollRunPhase({
            candidate: candidateAnomaly.payrollRun,
            expectedStatus: 'REVIEW',
            operation: 'payroll-anomaly-resolve',
            statusError: 'REVIEW 상태에서만 이상 항목을 해소할 수 있습니다.',
            mutate: async (tx, run) => {
                const anomaly = await tx.payrollAnomaly.findFirst({
                    where: { id: anomalyId, payrollRunId: runId },
                })
                if (!anomaly) throw notFound('이상 항목을 찾을 수 없습니다.')
                if (anomaly.status !== 'OPEN') {
                    throw badRequest(`이미 ${anomaly.status} 상태입니다.`)
                }
                const updatedAnomaly = await tx.payrollAnomaly.update({
                    where: { id: anomaly.id },
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
                        action: 'PAYROLL_ANOMALY_RESOLVE',
                        resourceType: 'PayrollAnomaly',
                        resourceId: anomalyId,
                        companyId: run.companyId,
                        changes: { resolution, note, ruleCode: anomaly.ruleCode },
                        ipAddress: ip ?? null,
                        userAgent: userAgent ?? null,
                    },
                })
                return updatedAnomaly
            },
        })

        return apiSuccess({ anomaly: updated }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
