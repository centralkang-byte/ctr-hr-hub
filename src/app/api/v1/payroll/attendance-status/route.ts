// ═══════════════════════════════════════════════════════════
// GET /api/v1/payroll/attendance-status — 근태 마감 현황 조회
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'

const schema = z.object({
    companyId: z.string().min(1),
    year: z.coerce.number().int().min(2020).max(2099),
    month: z.coerce.number().int().min(1).max(12),
})

export const GET = withPermission(
    async (req: NextRequest, _context, _user) => {
        const url = new URL(req.url)
        const params = Object.fromEntries(url.searchParams)

        const parsed = schema.safeParse(params)
        if (!parsed.success) {
            throw badRequest('companyId, year, month 파라미터가 필요합니다.')
        }
        const { companyId, year, month } = parsed.data

        const yearMonth = `${year}-${String(month).padStart(2, '0')}`
        const firstDay = new Date(year, month - 1, 1)
        const lastDay = new Date(year, month, 0)

        // 재직자 목록 (effectiveDate ≤ 말일, endDate null이거나 ≥ 첫날)
        const employees = await prisma.employee.findMany({
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
            select: { id: true, name: true, email: true },
        })

        const totalEmployees = employees.length
        const employeeIds = employees.map((e) => e.id)

        // clockOut 완료된 근태가 하나 이상 있는 직원 = 확정
        const confirmedRecs = await prisma.attendance.findMany({
            where: {
                employeeId: { in: employeeIds },
                workDate: { gte: firstDay, lte: lastDay },
                clockOut: { not: null },
            },
            select: {
                employeeId: true,
                workDate: true,
                totalMinutes: true,
                overtimeMinutes: true,
            },
        })

        const confirmedEmployeeIds = [...new Set(confirmedRecs.map((r) => r.employeeId))]
        const confirmedCount = confirmedEmployeeIds.length

        // 미확정 직원
        const unconfirmedEmployees = employees
            .filter((e) => !confirmedEmployeeIds.includes(e.id))
            .map((e) => ({ id: e.id, name: e.name, email: e.email }))

        // 총 근무·초과근무 시간
        const totalWorkHours = confirmedRecs.reduce((sum, r) => sum + (r.totalMinutes ?? 0), 0) / 60
        const totalOvertimeHours = confirmedRecs.reduce((sum, r) => sum + (r.overtimeMinutes ?? 0), 0) / 60

        // 무급휴가 건수 (해당 월에 승인된 LeaveRequest 중 UNPAID 타입)
        const unpaidLeaveCount = await prisma.leaveRequest.count({
            where: {
                employeeId: { in: employeeIds },
                status: 'APPROVED',
                startDate: { lte: lastDay },
                endDate: { gte: firstDay },
            },
        })

        // 현재 PayrollRun 상태
        const payrollRun = await prisma.payrollRun.findFirst({
            where: { companyId, yearMonth },
            select: { id: true, status: true, attendanceClosedAt: true },
        })

        return apiSuccess({
            yearMonth,
            totalEmployees,
            confirmedCount,
            unconfirmedCount: totalEmployees - confirmedCount,
            unconfirmedEmployees,
            totalWorkHours: Math.round(totalWorkHours * 10) / 10,
            totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
            unpaidLeaveCount,
            payrollRunStatus: payrollRun?.status ?? null,
            payrollRunId: payrollRun?.id ?? null,
            attendanceClosedAt: payrollRun?.attendanceClosedAt ?? null,
        }, 200)
    },
    perm(MODULE.PAYROLL, ACTION.VIEW),
)
