// ═══════════════════════════════════════════════════════════
// DELETE /api/v1/payroll/whitelist/[anomalyId]
// 화이트리스트 해제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'

export const DELETE = withPermission(
    async (req: NextRequest, context, user) => {
        const { anomalyId } = await context.params

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
        // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인 급여 데이터에만 접근 가능
        if (user.role !== ROLE.SUPER_ADMIN && candidateAnomaly.payrollRun.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여 데이터에 접근할 수 없습니다.')
        }

        const { ip, userAgent } = extractRequestMeta(req.headers)
        await prisma.$transaction(async (tx) => {
            const anomaly = await tx.payrollAnomaly.findFirst({
                where: {
                    id: anomalyId,
                    payrollRunId: candidateAnomaly.payrollRunId,
                    payrollRun: { companyId: candidateAnomaly.payrollRun.companyId },
                },
            })
            if (!anomaly) throw notFound('이상 항목을 찾을 수 없습니다.')
            if (!anomaly.whitelisted) {
                throw badRequest('화이트리스트 등록된 항목이 아닙니다.')
            }
            const removed = await tx.payrollAnomaly.updateMany({
                where: { id: anomaly.id, whitelisted: true },
                data: { whitelisted: false, whitelistReason: null },
            })
            if (removed.count !== 1) {
                throw badRequest('화이트리스트가 이미 해제되었습니다.')
            }
            await tx.auditLog.create({
                data: {
                    actorId: user.employeeId,
                    action: 'PAYROLL_WHITELIST_REMOVE',
                    resourceType: 'PayrollAnomaly',
                    resourceId: anomalyId,
                    companyId: candidateAnomaly.payrollRun.companyId,
                    changes: {
                        ruleCode: anomaly.ruleCode,
                        employeeId: anomaly.employeeId,
                    },
                    ipAddress: ip ?? null,
                    userAgent: userAgent ?? null,
                },
            })
        })

        return apiSuccess({ success: true }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
