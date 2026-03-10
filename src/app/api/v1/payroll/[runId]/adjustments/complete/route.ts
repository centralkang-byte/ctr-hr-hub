// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/[runId]/adjustments/complete
// 조정 완료 → REVIEW 전환 + 이상 탐지 실행
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { detectAnomalies } from '@/lib/payroll/anomaly-detector'

export const POST = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params

        const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

        if (run.status !== 'ADJUSTMENT') {
            throw badRequest(
                `ADJUSTMENT 상태에서만 이상 검토로 전환할 수 있습니다. (현재: ${run.status})`,
            )
        }

        // 이상 탐지 실행
        const anomalies = await detectAnomalies(runId)
        const anomalyCount = anomalies.length
        const allAnomaliesResolved = anomalyCount === 0

        // REVIEW 상태로 전환
        const updated = await prisma.payrollRun.update({
            where: { id: runId },
            data: { status: 'REVIEW', anomalyCount, allAnomaliesResolved },
        })

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_REVIEW_READY, {
            ctx: { companyId: run.companyId, actorId: user.employeeId, occurredAt: new Date() },
            payrollRunId: runId,
            companyId: run.companyId,
            yearMonth: run.yearMonth,
            anomalyCount,
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_ADJUSTMENT_COMPLETE',
            resourceType: 'PayrollRun',
            resourceId: runId,
            companyId: run.companyId,
            changes: { yearMonth: run.yearMonth, anomalyCount, adjustmentCount: run.adjustmentCount },
            ip,
            userAgent,
        })

        return apiSuccess({
            payrollRun: updated,
            anomalyCount,
            anomalySummary: {
                critical: anomalies.filter((a) => a.severity === 'CRITICAL').length,
                warning: anomalies.filter((a) => a.severity === 'WARNING').length,
                info: anomalies.filter((a) => a.severity === 'INFO').length,
            },
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
