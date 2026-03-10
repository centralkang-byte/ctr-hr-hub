// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/[runId]/publish-status
// 발행 현황: 열람률, 이체파일 현황, 승인 이력
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'

export const GET = withPermission(
    async (_req: NextRequest, context, user) => {
        const { runId } = await context.params

        const run = await prisma.payrollRun.findUnique({
            where: { id: runId, companyId: user.companyId },
            include: {
                payrollApproval: {
                    include: {
                        steps: {
                            orderBy: { stepNumber: 'asc' },
                            include: {
                                approver: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
            },
        })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

        // 급여 명세서 열람 현황
        const payrollItems = await prisma.payrollItem.findMany({
            where: { runId },
            select: { id: true },
        })
        const itemIds = payrollItems.map((i) => i.id)

        const [totalPayslips, viewedPayslips] = await Promise.all([
            prisma.payslip.count({ where: { payrollItemId: { in: itemIds } } }),
            prisma.payslip.count({ where: { payrollItemId: { in: itemIds }, isViewed: true } }),
        ])

        // 이체 파일 현황
        const transferBatches = await prisma.bankTransferBatch.findMany({
            where: { payrollRunId: runId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                status: true,
                totalAmount: true,
                totalCount: true,
                generatedAt: true,
                createdAt: true,
                note: true,
            },
        })

        // 승인 이력
        const approvalHistory = run.payrollApproval?.steps
            .filter((s) => s.status !== 'PENDING')
            .map((s) => ({
                stepNumber: s.stepNumber,
                roleRequired: s.roleRequired,
                approverName: s.approver?.name ?? null,
                status: s.status,
                comment: s.comment,
                decidedAt: s.decidedAt,
            })) ?? []

        const viewRate = totalPayslips > 0
            ? Math.round((viewedPayslips / totalPayslips) * 100)
            : 0

        return apiSuccess({
            run: {
                id: run.id,
                yearMonth: run.yearMonth,
                status: run.status,
                headcount: run.headcount,
                totalNet: run.totalNet,
                totalGross: run.totalGross,
                totalDeductions: run.totalDeductions,
                approvedAt: run.approvedAt,
                paidAt: run.paidAt,
                adjustmentCount: run.adjustmentCount,
            },
            payslipStats: {
                total: totalPayslips,
                viewed: viewedPayslips,
                unviewed: totalPayslips - viewedPayslips,
                viewRate,
            },
            transferBatches,
            approvalHistory,
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)
