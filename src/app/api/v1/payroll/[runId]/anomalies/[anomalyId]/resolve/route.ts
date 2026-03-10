// ═══════════════════════════════════════════════════════════
// PUT /api/v1/payroll/[runId]/anomalies/[anomalyId]/resolve
// 이상 항목 해소 (개별)
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'

const schema = z.object({
    resolution: z.enum(['CONFIRMED_NORMAL', 'CORRECTED', 'WHITELISTED']),
    note: z.string().max(500).optional(),
})

export const PUT = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId, anomalyId } = await context.params
        const body = await req.json()
        const { resolution, note } = schema.parse(body)

        const anomaly = await prisma.payrollAnomaly.findUnique({
            where: { id: anomalyId },
            include: { payrollRun: { select: { id: true, status: true, companyId: true } } },
        })
        if (!anomaly) throw notFound('이상 항목을 찾을 수 없습니다.')
        if (anomaly.payrollRunId !== runId) throw badRequest('잘못된 요청입니다.')
        if (anomaly.payrollRun.status !== 'REVIEW') {
            throw badRequest('REVIEW 상태에서만 이상 항목을 해소할 수 있습니다.')
        }
        if (anomaly.status !== 'OPEN') {
            throw badRequest(`이미 ${anomaly.status} 상태입니다.`)
        }

        // 트랜잭션: 이상 해소 + PayrollRun 집계 갱신
        const updated = await prisma.$transaction(async (tx) => {
            const updatedAnomaly = await tx.payrollAnomaly.update({
                where: { id: anomalyId },
                data: {
                    status: resolution === 'WHITELISTED' ? 'WHITELISTED' : 'RESOLVED',
                    resolvedBy: user.employeeId,
                    resolvedAt: new Date(),
                    resolution,
                    whitelisted: resolution === 'WHITELISTED',
                    whitelistReason: resolution === 'WHITELISTED' ? (note ?? null) : null,
                },
            })

            // 미해소 이상 항목 수 재계산
            const openCount = await tx.payrollAnomaly.count({
                where: { payrollRunId: runId, status: 'OPEN' },
            })

            await tx.payrollRun.update({
                where: { id: runId },
                data: {
                    anomalyCount: await tx.payrollAnomaly.count({ where: { payrollRunId: runId } }),
                    allAnomaliesResolved: openCount === 0,
                },
            })

            return updatedAnomaly
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_ANOMALY_RESOLVE',
            resourceType: 'PayrollAnomaly',
            resourceId: anomalyId,
            companyId: anomaly.payrollRun.companyId,
            changes: { resolution, note, ruleCode: anomaly.ruleCode },
            ip,
            userAgent,
        })

        return apiSuccess({ anomaly: updated }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
