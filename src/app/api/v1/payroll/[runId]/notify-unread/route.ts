// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/[runId]/notify-unread
// 급여명세서 미열람자 재알림
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { sendNotifications } from '@/lib/notifications'

export const POST = withPermission(
    async (_req: NextRequest, context, user) => {
        const { runId } = await context.params

        const run = await prisma.payrollRun.findUnique({
            where: { id: runId, companyId: user.companyId },
        })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
        if (!['APPROVED', 'PAID'].includes(run.status)) {
            throw badRequest('APPROVED 또는 PAID 상태에서만 재알림이 가능합니다.')
        }

        // 미열람 payslip 조회 (이 run의 payrollItemId 기준)
        const items = await prisma.payrollItem.findMany({
            where: { runId },
            select: { id: true, employeeId: true },
        })
        const itemIds = items.map((i) => i.id)

        const unreadPayslips = await prisma.payslip.findMany({
            where: {
                payrollItemId: { in: itemIds },
                isViewed: false,
            },
            select: { employeeId: true },
        })

        if (unreadPayslips.length === 0) {
            return apiSuccess({ notifiedCount: 0, message: '미열람자가 없습니다.' }, 200)
        }

        const [yearStr, monthStr] = run.yearMonth.split('-')

        await sendNotifications(
            unreadPayslips.map((ps) => ({
                employeeId: ps.employeeId,
                triggerType: 'payslip_reminder',
                title: `${run.yearMonth} 급여명세서 미확인 알림`,
                body: `${yearStr}년 ${monthStr}월 급여명세서를 아직 확인하지 않으셨습니다. 확인해 주세요.`,
                link: '/my/payroll',
                priority: 'normal' as const,
                metadata: { payrollRunId: runId, yearMonth: run.yearMonth },
            })),
        )

        return apiSuccess({
            notifiedCount: unreadPayslips.length,
            message: `${unreadPayslips.length}명에게 재알림을 발송했습니다.`,
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
