// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/[runId]/approval-status — 결재 현황
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, hasPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { resolveApprovalFlow } from '@/lib/approval/resolve-approval-flow'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { callerHoldsPayrollStepRole } from '@/lib/payroll/approval-step-roles'

// 승인 화면이 필요로 하는 run 요약 (RunInfo와 동형) — EXECUTIVE가 payroll:view 없이 로드.
// Decimal은 JSON 직렬화 시 string → 클라이언트 fmt(Number()) 호환.
function runSummary(run: {
    id: string; name: string; yearMonth: string; status: string; headcount: number
    totalNet: unknown; totalGross: unknown; adjustmentCount: number
    allAnomaliesResolved: boolean; notes: string | null
}) {
    return {
        id: run.id,
        name: run.name,
        yearMonth: run.yearMonth,
        status: run.status,
        headcount: run.headcount,
        totalNet: run.totalNet as string | number | null,
        totalGross: run.totalGross as string | number | null,
        adjustmentCount: run.adjustmentCount,
        allAnomaliesResolved: run.allAnomaliesResolved,
        notes: run.notes,
    }
}

// CONVENTION NOTE: withAuth(≠ withPermission)는 의도적 예외다 — EXECUTIVE(법인 대표)는
// payroll:view 권한이 없지만 승인 UI를 위해 이 라우트에 도달해야 한다. 미들웨어가 reach를
// PAYROLL_APPROVERS로 제한하고, 핸들러가 2중 인가(canViewPayroll || isApprovalParticipant)를
// 강제한다. api.md §2(withAuth=self-service)의 문서화된 예외.
export const GET = withAuth(
    async (_req: NextRequest, context, user) => {
        const { runId } = await context.params

        // 비-SUPER는 companyId 하드 스코프 — 타 법인 run은 fetch 자체 불가(→ notFound, 오라클 없음).
        // SUPER_ADMIN은 스코프 해제 → 전 법인 결재현황 열람(아래 hasPermission bypass와 정합).
        const run = await prisma.payrollRun.findUnique({
            where: { id: runId, ...(user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }) },
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

        // 인가: 미들웨어는 reach만 연다(PAYROLL_APPROVERS). 여기서 실제 열람 자격을 재검증 —
        // payroll:view 보유자(HR; SUPER는 hasPermission이 bypass) 또는 이 run 승인의 실제 참여자
        // (현 단계 role 보유자 / 이미 처리한 사람)만. 그 외 같은 법인 EXECUTIVE의 runId 추측 열람 차단.
        const canViewPayroll = hasPermission(user, perm(MODULE.PAYROLL, ACTION.VIEW))
        let isApprovalParticipant = false
        if (run.payrollApproval) {
            const steps = run.payrollApproval.steps
            const actedBefore = steps.some((s) => s.approverId === user.employeeId)
            const current = steps.find((s) => s.status === 'PENDING')
            const holdsCurrentRole = current
                ? await callerHoldsPayrollStepRole(current.roleRequired, user.employeeId, run.companyId)
                : false
            isApprovalParticipant = actedBefore || holdsCurrentRole
        }
        if (!canViewPayroll && !isApprovalParticipant) {
            throw forbidden('이 급여 결재 현황을 조회할 권한이 없습니다.')
        }

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
                run: runSummary(run),
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
            run: runSummary(run),
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
)
