// ═══════════════════════════════════════════════════════════
// DELETE /api/v1/payroll/[runId]/adjustments/[adjustmentId]
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'

export const DELETE = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId, adjustmentId } = await context.params

        const adjustment = await prisma.payrollAdjustment.findUnique({
            where: { id: adjustmentId },
            include: { payrollRun: { select: { id: true, status: true, companyId: true } } },
        })

        if (!adjustment) throw notFound('조정 항목을 찾을 수 없습니다.')
        if (adjustment.payrollRunId !== runId) throw badRequest('잘못된 요청입니다.')
        if (adjustment.payrollRun.status !== 'ADJUSTMENT') {
            throw badRequest('ADJUSTMENT 상태에서만 조정을 삭제할 수 있습니다.')
        }

        await prisma.$transaction(async (tx) => {
            await tx.payrollAdjustment.delete({ where: { id: adjustmentId } })

            const allAdjs = await tx.payrollAdjustment.findMany({
                where: { payrollRunId: runId },
                select: { amount: true },
            })
            const adjustmentTotal = allAdjs.reduce((s, a) => s + Number(a.amount), 0)

            await tx.payrollRun.update({
                where: { id: runId },
                data: { adjustmentCount: allAdjs.length, adjustmentTotal },
            })

            const hasRemainingForEmployee = await tx.payrollAdjustment.count({
                where: { payrollRunId: runId, employeeId: adjustment.employeeId },
            })
            if (hasRemainingForEmployee === 0) {
                await tx.payrollItem.updateMany({
                    where: { runId, employeeId: adjustment.employeeId },
                    data: { isManuallyAdjusted: false, adjustmentReason: null },
                })
            }
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_ADJUSTMENT_DELETE',
            resourceType: 'PayrollAdjustment',
            resourceId: adjustmentId,
            companyId: adjustment.payrollRun.companyId,
            changes: { runId, adjustmentId },
            ip,
            userAgent,
        })

        return apiSuccess({ success: true }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
