// ═══════════════════════════════════════════════════════════
// DELETE /api/v1/payroll/[runId]/adjustments/[adjustmentId]
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'
import {
    readAdjustmentAggregate,
    updatePayrollRunInPhase,
    withLockedPayrollRunPhase,
} from '@/lib/payroll/phase-writer-service'

export const DELETE = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId, adjustmentId } = await context.params

        const candidateAdjustment = await prisma.payrollAdjustment.findUnique({
            where: { id: adjustmentId },
            select: {
                id: true,
                payrollRunId: true,
                payrollRun: {
                    select: { id: true, companyId: true, yearMonth: true },
                },
            },
        })

        if (!candidateAdjustment) throw notFound('조정 항목을 찾을 수 없습니다.')
        // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인만 (존재 oracle 차단 위해 runId-match보다 앞)
        if (user.role !== ROLE.SUPER_ADMIN && candidateAdjustment.payrollRun.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여 데이터에 접근할 수 없습니다.')
        }
        if (candidateAdjustment.payrollRunId !== runId) throw badRequest('잘못된 요청입니다.')

        const { ip, userAgent } = extractRequestMeta(req.headers)
        await withLockedPayrollRunPhase({
            candidate: candidateAdjustment.payrollRun,
            expectedStatus: 'ADJUSTMENT',
            operation: 'payroll-adjustment-delete',
            statusError: 'ADJUSTMENT 상태에서만 조정을 삭제할 수 있습니다.',
            mutate: async (tx, run) => {
                const adjustment = await tx.payrollAdjustment.findFirst({
                    where: { id: adjustmentId, payrollRunId: runId },
                    select: { id: true, employeeId: true },
                })
                if (!adjustment) throw notFound('조정 항목을 찾을 수 없습니다.')
                await tx.payrollAdjustment.delete({ where: { id: adjustment.id } })
                const hasRemainingForEmployee = await tx.payrollAdjustment.count({
                    where: { payrollRunId: runId, employeeId: adjustment.employeeId },
                })
                if (hasRemainingForEmployee === 0) {
                    await tx.payrollItem.updateMany({
                        where: { runId, employeeId: adjustment.employeeId },
                        data: { isManuallyAdjusted: false, adjustmentReason: null },
                    })
                }
                const aggregate = await readAdjustmentAggregate(tx, runId)
                await updatePayrollRunInPhase(tx, run, 'ADJUSTMENT', aggregate)
                await tx.auditLog.create({
                    data: {
                        actorId: user.employeeId,
                        action: 'PAYROLL_ADJUSTMENT_DELETE',
                        resourceType: 'PayrollAdjustment',
                        resourceId: adjustmentId,
                        companyId: run.companyId,
                        changes: { runId, adjustmentId },
                        ipAddress: ip ?? null,
                        userAgent: userAgent ?? null,
                    },
                })
            },
        })

        return apiSuccess({ success: true }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
