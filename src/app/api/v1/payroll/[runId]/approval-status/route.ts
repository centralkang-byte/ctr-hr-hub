// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/[runId]/approval-status — 결재 현황
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { resolveApprovalFlow } from '@/lib/approval/resolve-approval-flow'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export const GET = withPermission(
    async (_req: NextRequest, context, user) => {
        const { runId } = await context.params

        const run = await prisma.payrollRun.findUnique({
            where: { id: runId, companyId: user.companyId },
            include: {
                company: { select: { code: true } },
                payrollApproval: {
                    include: {
                        steps: {
                            orderBy: { stepNumber: 'asc' },
                            include: {
                                approver: {
                                    select: {
                                        id: true,
                                        name: true,
                                        assignments: {
                                            where: { isPrimary: true, endDate: null },
                                            take: 1,
                                            include: {
                                                department: { select: { name: true } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

        // 승인 체인 미리보기 (Approval 레코드 생성 전 = submit 이전). ApprovalFlow SSOT 사용
        // → submit이 실제 생성할 단계와 일치. 미설정 시 hr_admin 단일 fallback.
        const resolvedPreview = await resolveApprovalFlow('payroll', run.companyId)
        const chain =
            resolvedPreview.length > 0
                ? resolvedPreview.map((s) => s.approverRole ?? 'hr_admin')
                : ['hr_admin']

        const approval = run.payrollApproval
        if (!approval) {
            return apiSuccess({
                run: { id: run.id, status: run.status, yearMonth: run.yearMonth },
                approval: null,
                chain: chain.map((role, idx) => ({
                    stepNumber: idx + 1,
                    roleRequired: role,
                    status: 'PENDING' as const,
                    approverName: null,
                    comment: null,
                    decidedAt: null,
                })),
            }, 200)
        }

        return apiSuccess({
            run: {
                id: run.id,
                status: run.status,
                yearMonth: run.yearMonth,
            },
            approval: {
                id: approval.id,
                currentStep: approval.currentStep,
                totalSteps: approval.totalSteps,
                status: approval.status,
                requestedBy: approval.requestedBy,
                requestedAt: approval.requestedAt,
                completedAt: approval.completedAt,
            },
            chain: approval.steps.map((step) => ({
                stepNumber: step.stepNumber,
                roleRequired: step.roleRequired,
                status: step.status,
                approverName: step.approver?.name ?? null,
                approverDept: extractPrimaryAssignment(step.approver?.assignments ?? [])?.department?.name ?? null,
                comment: step.comment,
                decidedAt: step.decidedAt,
            })),
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)
