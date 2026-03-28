// ═══════════════════════════════════════════════════════════
// POST /api/v1/payroll/attendance-close — 근태 마감
// 근태 잠금 후 PayrollRun 생성/갱신 → ATTENDANCE_CLOSED
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'

const schema = z.object({
    companyId: z.string().min(1),
    year: z.number().int().min(2020).max(2099),
    month: z.number().int().min(1).max(12),
    excludeEmployeeIds: z.array(z.string()).default([]),
})

export const POST = withPermission(
    async (req: NextRequest, _context, user) => {
        const body = await req.json()
        const { companyId, year, month, excludeEmployeeIds } = schema.parse(body)

        const company = await prisma.company.findUnique({ where: { id: companyId } })
        if (!company) throw badRequest('존재하지 않는 법인입니다.')

        const yearMonth = `${year}-${String(month).padStart(2, '0')}`
        const firstDay = new Date(year, month - 1, 1)
        const lastDay = new Date(year, month, 0)

        // 기존 PayrollRun 조회
        const existing = await prisma.payrollRun.findFirst({ where: { companyId, yearMonth } })
        if (existing && !['DRAFT'].includes(existing.status)) {
            throw conflict(`${yearMonth} 급여 실행이 이미 ${existing.status} 상태입니다. 마감 불가.`)
        }

        // 해당 월 재직자 수 (effectiveDate ≤ 말일, endDate 미만이거나 null)
        const totalEmployees = await prisma.employee.count({
            where: {
                assignments: {
                    some: {
                        companyId,
                        isPrimary: true,
                        status: 'ACTIVE',
                        effectiveDate: { lte: lastDay },
                        OR: [{ endDate: null }, { endDate: { gte: firstDay } }],
                    },
                },
            },
        })

        // 확정 기준: 해당 월에 clockOut이 완료된 출근 기록이 있는 직원
        const confirmedEmployeeIds = (await prisma.attendance.findMany({
            where: {
                workDate: { gte: firstDay, lte: lastDay },
                clockOut: { not: null },
                employee: {
                    assignments: {
                        some: { companyId, isPrimary: true },
                    },
                },
            },
            select: { employeeId: true },
            distinct: ['employeeId'],
        })).map((a) => a.employeeId)

        const confirmedCount = confirmedEmployeeIds.length

        // PayrollRun 생성 또는 갱신 (트랜잭션)
        const run = await prisma.$transaction(async (tx) => {
            const runData = {
                companyId,
                yearMonth,
                year,
                month,
                name: `${yearMonth} 월급 (${company.name})`,
                status: 'ATTENDANCE_CLOSED' as const,
                attendanceClosedAt: new Date(),
                attendanceClosedBy: user.employeeId,
                excludedEmployeeIds: excludeEmployeeIds,
                periodStart: firstDay,
                periodEnd: lastDay,
                createdById: user.employeeId,
            }

            if (existing) {
                return tx.payrollRun.update({
                    where: { id: existing.id },
                    data: {
                        status: runData.status,
                        attendanceClosedAt: runData.attendanceClosedAt,
                        attendanceClosedBy: runData.attendanceClosedBy,
                        excludedEmployeeIds: runData.excludedEmployeeIds,
                    },
                })
            }
            return tx.payrollRun.create({ data: runData })
        })

        // 이벤트 발행
        void eventBus.publish(DOMAIN_EVENTS.PAYROLL_ATTENDANCE_CLOSED, {
            ctx: { companyId, actorId: user.employeeId, occurredAt: new Date() },
            payrollRunId: run.id,
            companyId,
            yearMonth,
            year,
            month,
            totalEmployees,
            confirmedCount,
            excludedCount: excludeEmployeeIds.length,
        })

        const { ip, userAgent } = extractRequestMeta(req.headers)
        logAudit({
            actorId: user.employeeId,
            action: 'PAYROLL_ATTENDANCE_CLOSE',
            resourceType: 'PayrollRun',
            resourceId: run.id,
            companyId,
            changes: { yearMonth, totalEmployees, confirmedCount },
            ip,
            userAgent,
        })

        return apiSuccess({
            payrollRun: run,
            summary: {
                totalEmployees,
                confirmedCount,
                unconfirmedCount: totalEmployees - confirmedCount,
                excludedCount: excludeEmployeeIds.length,
            },
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.UPDATE),
)
