// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/monthly/[year]/[month]
// 월별 근태 캘린더 데이터
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { resolveEffectiveAttendanceSettings } from '@/lib/attendance/timezone-resolver'

// ─── GET — 월별 근태 데이터 ──────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { year, month } = await context.params

      // 파라미터 유효성 검증
      const yearNum = parseInt(year, 10)
      const monthNum = parseInt(month, 10)

      if (
        isNaN(yearNum) ||
        isNaN(monthNum) ||
        yearNum < 2000 ||
        yearNum > 2100 ||
        monthNum < 1 ||
        monthNum > 12
      ) {
        throw badRequest('유효하지 않은 년/월 값입니다.')
      }

      const queryStart = new Date(Date.UTC(yearNum, monthNum - 1, 1))
      const queryEnd = new Date(Date.UTC(yearNum, monthNum, 1))
      const { timezone } = await resolveEffectiveAttendanceSettings(prisma, user.companyId)

      const records = await prisma.attendance.findMany({
        where: {
          employeeId: user.employeeId,
          companyId: user.companyId,
          workDate: {
            gte: queryStart,
            lt: queryEnd,
          },
        },
        orderBy: { workDate: 'asc' },
      })

      const corrections = records.length
        ? await prisma.attendanceApprovalRequest.findMany({
            where: {
              companyId: user.companyId,
              requesterId: user.employeeId,
              requestType: 'attendance_correction',
              referenceId: { in: records.map((record) => record.id) },
            },
            select: { id: true, referenceId: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : []
      const latestCorrectionByAttendance = new Map<
        string,
        { id: string; status: string }
      >()
      for (const correction of corrections) {
        if (
          correction.referenceId &&
          !latestCorrectionByAttendance.has(correction.referenceId)
        ) {
          latestCorrectionByAttendance.set(correction.referenceId, correction)
        }
      }

      // 일별 데이터 매핑
      const dayCount = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate()
      const days = Array.from({ length: dayCount }, (_, index) => {
        const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
        const record = records.find((row) => row.workDate.toISOString().slice(0, 10) === dateStr)
        const correction = record ? latestCorrectionByAttendance.get(record.id) : undefined

        return {
          date: dateStr,
          id: record?.id ?? null,
          status: record?.status ?? null,
          clockIn: record?.clockIn?.toISOString() ?? null,
          clockOut: record?.clockOut?.toISOString() ?? null,
          totalMinutes: record?.totalMinutes ?? 0,
          overtimeMinutes: record?.overtimeMinutes ?? 0,
          workType: record?.workType ?? null,
          note: record?.note ?? null,
          correctionRequest: correction ?? null,
        }
      })

      // 월간 합계
      const totalMinutes = days.reduce((sum, d) => sum + d.totalMinutes, 0)
      const totalOvertimeMinutes = days.reduce((sum, d) => sum + d.overtimeMinutes, 0)
      const workedDays = days.filter((d) => d.status !== null).length

      const result = {
        year: yearNum,
        month: monthNum,
        timezone,
        days,
        summary: {
          workedDays,
          totalMinutes,
          totalOvertimeMinutes,
        },
      }

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
