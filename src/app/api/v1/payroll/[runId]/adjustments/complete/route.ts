// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/[runId]/adjustments/complete
// 조정 완료 → REVIEW 전환 + 이상 탐지 실행
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { forbidden, notFound } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import {
    detectAnomalies,
    resolveAnomalyThresholds,
} from '@/lib/payroll/anomaly-detector'
import {
    updatePayrollRunInPhase,
    withLockedPayrollRunPhase,
} from '@/lib/payroll/phase-writer-service'

export const POST = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params

        const candidate = await prisma.payrollRun.findUnique({
            where: { id: runId },
            select: { id: true, companyId: true, yearMonth: true },
        })
        if (!candidate) throw notFound('급여 실행을 찾을 수 없습니다.')

        // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인 급여 실행에만 접근 가능
        if (user.role !== ROLE.SUPER_ADMIN && candidate.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여 실행에 접근할 수 없습니다.')
        }

        // Settings are resolved before the exclusive transaction so the period
        // lock is held only for payroll/anomaly reads and writes.
        const thresholds = await resolveAnomalyThresholds(candidate.companyId)
        const { ip, userAgent } = extractRequestMeta(req.headers)
        const result = await withLockedPayrollRunPhase({
            candidate,
            expectedStatus: 'ADJUSTMENT',
            operation: 'payroll-adjustment-complete',
            statusError: (status) =>
                `ADJUSTMENT 상태에서만 이상 검토로 전환할 수 있습니다. (현재: ${status})`,
            mutate: async (tx, run) => {
                const anomalies = await detectAnomalies(runId, {
                    client: tx,
                    thresholds,
                })
                const anomalyCount = anomalies.length
                const allAnomaliesResolved = anomalyCount === 0
                await updatePayrollRunInPhase(tx, run, 'ADJUSTMENT', {
                    status: 'REVIEW',
                    anomalyCount,
                    allAnomaliesResolved,
                })
                await tx.auditLog.create({
                    data: {
                        actorId: user.employeeId,
                        action: 'PAYROLL_ADJUSTMENT_COMPLETE',
                        resourceType: 'PayrollRun',
                        resourceId: runId,
                        companyId: run.companyId,
                        changes: {
                            yearMonth: run.yearMonth,
                            anomalyCount,
                            adjustmentCount: run.adjustmentCount,
                        },
                        ipAddress: ip ?? null,
                        userAgent: userAgent ?? null,
                    },
                })
                return {
                    anomalies,
                    anomalyCount,
                    payrollRun: await tx.payrollRun.findUniqueOrThrow({
                        where: { id: runId },
                    }),
                }
            },
        })

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_REVIEW_READY, {
            ctx: { companyId: candidate.companyId, actorId: user.employeeId, occurredAt: new Date() },
            payrollRunId: runId,
            companyId: candidate.companyId,
            yearMonth: candidate.yearMonth,
            anomalyCount: result.anomalyCount,
        })

        return apiSuccess({
            payrollRun: result.payrollRun,
            anomalyCount: result.anomalyCount,
            anomalySummary: {
                critical: result.anomalies.filter((a) => a.severity === 'CRITICAL').length,
                warning: result.anomalies.filter((a) => a.severity === 'WARNING').length,
                info: result.anomalies.filter((a) => a.severity === 'INFO').length,
            },
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
