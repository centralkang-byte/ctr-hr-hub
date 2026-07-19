// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/[runId]/adjustments — 조정 목록
// POST /api/v1/payroll/[runId]/adjustments — 조정 추가
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import {
    readAdjustmentAggregate,
    updatePayrollRunInPhase,
    withLockedPayrollRunPhase,
} from '@/lib/payroll/phase-writer-service'

const createSchema = z.object({
    employeeId: z.string().min(1),
    type: z.enum(['RETROACTIVE', 'BONUS', 'CORRECTION', 'DEDUCTION', 'OTHER']),
    category: z.string().min(1),
    description: z.string().min(1).max(500),
    amount: z.number().int(),
    evidenceUrl: z.string().url().optional(),
})

// GET
export const GET = withPermission(
    async (_req: NextRequest, context, user) => {
        const { runId } = await context.params

        // 멀티테넌트 스코프: 비-SUPER는 본인 법인 run만 (타 법인 runId는 notFound)
        const run = await prisma.payrollRun.findFirst({
            where: { id: runId, ...(user.role !== ROLE.SUPER_ADMIN ? { companyId: user.companyId } : {}) },
            select: { id: true, status: true, companyId: true },
        })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')

        const adjustments = await prisma.payrollAdjustment.findMany({
            where: { payrollRunId: runId },
            include: { employee: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        })

        const totalAdd = adjustments.filter((a) => Number(a.amount) > 0).reduce((s, a) => s + Number(a.amount), 0)
        const totalDeduct = adjustments.filter((a) => Number(a.amount) < 0).reduce((s, a) => s + Math.abs(Number(a.amount)), 0)

        return apiSuccess({
            adjustments,
            summary: { totalAdd, totalDeduct, netAdjustment: totalAdd - totalDeduct, count: adjustments.length },
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)

// POST
export const POST = withPermission(
    async (req: NextRequest, context, user) => {
        const { runId } = await context.params
        let body: unknown
        try {
            body = await req.json()
        } catch {
            throw badRequest('요청 본문이 올바른 JSON 형식이 아닙니다.')
        }
        const parsed = createSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.')
        }
        const data = parsed.data

        const candidate = await prisma.payrollRun.findUnique({
            where: { id: runId },
            select: { id: true, companyId: true, yearMonth: true },
        })
        if (!candidate) throw notFound('급여 실행을 찾을 수 없습니다.')
        // 멀티테넌트 가드: SUPER_ADMIN 외에는 본인 법인 급여 실행에만 접근 가능
        if (user.role !== ROLE.SUPER_ADMIN && candidate.companyId !== user.companyId) {
            throw forbidden('다른 법인의 급여 실행에 접근할 수 없습니다.')
        }
        const { ip, userAgent } = extractRequestMeta(req.headers)
        const adjustment = await withLockedPayrollRunPhase({
            candidate,
            expectedStatus: 'ADJUSTMENT',
            operation: 'payroll-adjustment-create',
            statusError: (status) =>
                `ADJUSTMENT 상태에서만 조정을 추가할 수 있습니다. (현재: ${status})`,
            mutate: async (tx, run) => {
                // A historical run owns its persisted roster. Current assignment
                // membership must not block a legitimate adjustment after transfer.
                const payrollItem = await tx.payrollItem.findFirst({
                    where: { runId, employeeId: data.employeeId },
                    select: { id: true },
                })
                if (!payrollItem) throw badRequest('해당 급여 실행의 정산 대상 직원이 아닙니다.')

                const created = await tx.payrollAdjustment.create({
                    data: {
                        payrollRunId: runId,
                        employeeId: data.employeeId,
                        type: data.type,
                        category: data.category,
                        description: data.description,
                        amount: data.amount,
                        evidenceUrl: data.evidenceUrl,
                        createdById: user.employeeId,
                    },
                    include: {
                        employee: { select: { id: true, name: true, email: true } },
                    },
                })
                await tx.payrollItem.updateMany({
                    where: { runId, employeeId: data.employeeId },
                    data: {
                        isManuallyAdjusted: true,
                        adjustmentReason: `${data.type}: ${data.description}`,
                    },
                })
                const aggregate = await readAdjustmentAggregate(tx, runId)
                await updatePayrollRunInPhase(tx, run, 'ADJUSTMENT', aggregate)
                await tx.auditLog.create({
                    data: {
                        actorId: user.employeeId,
                        action: 'PAYROLL_ADJUSTMENT_CREATE',
                        resourceType: 'PayrollAdjustment',
                        resourceId: created.id,
                        companyId: run.companyId,
                        changes: {
                            runId,
                            employeeId: data.employeeId,
                            type: data.type,
                            amount: data.amount,
                        },
                        ipAddress: ip ?? null,
                        userAgent: userAgent ?? null,
                    },
                })
                return created
            },
        })

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_ADJUSTMENT_ADDED, {
            ctx: { companyId: candidate.companyId, actorId: user.employeeId, occurredAt: new Date() },
            payrollRunId: runId,
            companyId: candidate.companyId,
            adjustmentId: adjustment.id,
            employeeId: data.employeeId,
            amount: data.amount,
            type: data.type,
        })

        return apiSuccess(adjustment, 201)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
