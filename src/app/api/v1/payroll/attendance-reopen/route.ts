// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/attendance-reopen — 근태 마감 해제
//
// Supported source states (cascading cleanup):
//   ATTENDANCE_CLOSED → DRAFT (기본)
//   ADJUSTMENT → DRAFT (계산 결과 + 이상 목록 초기화)
//   REVIEW → DRAFT (이상 목록 + 승인 체인 초기화)
//
// Preserved: PayrollAdjustment records (수동 조정은 유지)
// Cleared:   PayrollAnomaly records, allAnomaliesResolved flag,
//            PayrollApproval (if REVIEW→DRAFT), calculated totals
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'

const schema = z.object({
    payrollRunId: z.string().min(1),
    reason: z.string().max(500).optional(),        // 마감 해제 사유 (감사 로그용)
})

// 마감 해제 가능한 소스 상태
const REOPENABLE_STATUSES = ['ATTENDANCE_CLOSED', 'ADJUSTMENT', 'REVIEW'] as const
type ReopenableStatus = typeof REOPENABLE_STATUSES[number]

export const POST = withPermission(
    async (req: NextRequest, _context, user) => {
        const body = await req.json()
        const { payrollRunId, reason } = schema.parse(body)

        const run = await prisma.payrollRun.findUnique({ where: { id: payrollRunId } })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

        if (!REOPENABLE_STATUSES.includes(run.status as ReopenableStatus)) {
            throw badRequest(
                `${REOPENABLE_STATUSES.join(' | ')} 상태에서만 마감 해제가 가능합니다. (현재: ${run.status})`,
            )
        }

        const previousStatus = run.status

        // ── 계단식 정리 (CASCADE CLEANUP) ─────────────────────
        await prisma.$transaction(async (tx) => {

            // 1. 이상 목록 삭제 (ADJUSTMENT, REVIEW → DRAFT 시)
            if (['ADJUSTMENT', 'REVIEW'].includes(run.status)) {
                await tx.payrollAnomaly.deleteMany({ where: { payrollRunId } })
            }

            // 2. 계산된 PayrollItem 삭제 (재계산 시 새로 생성됨)
            if (['ADJUSTMENT', 'REVIEW'].includes(run.status)) {
                await tx.payrollItem.deleteMany({ where: { runId: payrollRunId } })
            }

            // 3. 진행 중인 PayrollApproval 삭제 (REVIEW → DRAFT 시 결재 체인 초기화)
            // Settings-connected: approval chain reset policy (default: auto-reset on reopen from REVIEW)
            if (run.status === 'REVIEW') {
                await tx.payrollApproval.deleteMany({ where: { payrollRunId } })
            }

            // 4. PayrollRun → DRAFT 초기화
            await tx.payrollRun.update({
                where: { id: payrollRunId },
                data: {
                    status: 'DRAFT',
                    attendanceClosedAt: null,
                    attendanceClosedBy: null,
                    excludedEmployeeIds: [],
                    // 계산 결과 초기화
                    totalGross: null,
                    totalDeductions: null,
                    totalNet: null,
                    headcount: 0,
                    // 이상 검토 초기화
                    anomalyCount: 0,
                    allAnomaliesResolved: false,
                },
            })
        })

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_ATTENDANCE_REOPENED, {
            ctx: { companyId: run.companyId, actorId: user.employeeId, occurredAt: new Date() },
            payrollRunId,
            companyId: run.companyId,
            yearMonth: run.yearMonth,
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_ATTENDANCE_REOPEN',
            resourceType: 'PayrollRun',
            resourceId: payrollRunId,
            companyId: run.companyId,
            changes: { yearMonth: run.yearMonth, previousStatus, reason: reason ?? null },
            ip,
            userAgent,
        })

        const updated = await prisma.payrollRun.findUniqueOrThrow({ where: { id: payrollRunId } })
        return apiSuccess({ payrollRun: updated, previousStatus }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
