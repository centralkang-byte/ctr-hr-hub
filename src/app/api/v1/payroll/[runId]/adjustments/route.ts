// ═══════════════════════════════════════════════════════════
// GET  /api/v1/payroll/[runId]/adjustments — 조정 목록
// POST /api/v1/payroll/[runId]/adjustments — 조정 추가
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
    async (_req: NextRequest, context, _user) => {
        const { runId } = await context.params

        const run = await prisma.payrollRun.findUnique({
            where: { id: runId },
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
        const body = await req.json()
        const data = createSchema.parse(body)

        const run = await prisma.payrollRun.findUnique({ where: { id: runId } })
        if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')
        if (run.status !== 'ADJUSTMENT') {
            throw badRequest(`ADJUSTMENT 상태에서만 조정을 추가할 수 있습니다. (현재: ${run.status})`)
        }

        const employee = await prisma.employee.findFirst({
            where: {
                id: data.employeeId,
                assignments: { some: { companyId: run.companyId, isPrimary: true, endDate: null } },
            },
        })
        if (!employee) throw badRequest('해당 법인 소속 직원이 아닙니다.')

        const adjustment = await prisma.$transaction(async (tx) => {
            const adj = await tx.payrollAdjustment.create({
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
                include: { employee: { select: { id: true, name: true, email: true } } },
            })

            const allAdjs = await tx.payrollAdjustment.findMany({
                where: { payrollRunId: runId },
                select: { amount: true },
            })
            const adjustmentTotal = allAdjs.reduce((s, a) => s + Number(a.amount), 0)

            await tx.payrollRun.update({
                where: { id: runId },
                data: { adjustmentCount: allAdjs.length, adjustmentTotal },
            })

            await tx.payrollItem.updateMany({
                where: { runId, employeeId: data.employeeId },
                data: { isManuallyAdjusted: true, adjustmentReason: `${data.type}: ${data.description}` },
            })

            return adj
        })

        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_ADJUSTMENT_ADDED, {
            ctx: { companyId: run.companyId, actorId: user.employeeId, occurredAt: new Date() },
            payrollRunId: runId,
            companyId: run.companyId,
            adjustmentId: adjustment.id,
            employeeId: data.employeeId,
            amount: data.amount,
            type: data.type,
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_ADJUSTMENT_CREATE',
            resourceType: 'PayrollAdjustment',
            resourceId: adjustment.id,
            companyId: run.companyId,
            changes: { runId, employeeId: data.employeeId, type: data.type, amount: data.amount },
            ip,
            userAgent,
        })

        return apiSuccess(adjustment, 201)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
