// ═══════════════════════════════════════════════════════════
// DELETE /api/v1/payroll/whitelist/[anomalyId]
// 화이트리스트 해제
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
        const { anomalyId } = await context.params

        const anomaly = await prisma.payrollAnomaly.findUnique({
            where: { id: anomalyId },
            include: { payrollRun: { select: { companyId: true } } },
        })
        if (!anomaly) throw notFound('이상 항목을 찾을 수 없습니다.')
        if (!anomaly.whitelisted) throw badRequest('화이트리스트 등록된 항목이 아닙니다.')

        await prisma.payrollAnomaly.update({
            where: { id: anomalyId },
            data: {
                whitelisted: false,
                whitelistReason: null,
            },
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_WHITELIST_REMOVE',
            resourceType: 'PayrollAnomaly',
            resourceId: anomalyId,
            companyId: anomaly.payrollRun.companyId,
            changes: { ruleCode: anomaly.ruleCode, employeeId: anomaly.employeeId },
            ip,
            userAgent,
        })

        return apiSuccess({ success: true }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
