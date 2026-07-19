// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Admin Attendance Dashboard API
// GET /api/v1/attendance/admin
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { parseDateOnly, formatToTz } from '@/lib/timezone'
import { resolveDayContext } from '@/lib/attendance/judgeStatus'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    // 전사 근태 대시보드는 HR 전용 — 페이지(/attendance/admin = HR_UP)와 정합 (att-05)
    if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('전체 근태 조회 권한이 없습니다.')
    }

    const { searchParams } = new URL(req.url)

    // 1. Determine target company
    const queryCompanyId = searchParams.get('companyId')
    const companyId =
      user.role === ROLE.SUPER_ADMIN && queryCompanyId
        ? queryCompanyId
        : user.companyId
    const companyFilter = { companyId }

    // 2. Determine target date — 쓰기 경로(clock-in)와 동일하게 대상 법인 타임존의
    //    달력 날짜로 윈도우·라벨을 만든다 (date 미지정 시 그 법인의 "오늘")
    const dateParam = searchParams.get('date')
    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      throw badRequest('date는 YYYY-MM-DD 형식이어야 합니다.')
    }
    const dayCtx = await resolveDayContext(companyId, new Date())
    const dateStr = dateParam ?? dayCtx.localDateStr
    const targetDate = parseDateOnly(dateStr)
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)

    // 근무일 여부 — 주말·공휴일이면 "결근" 집계가 무의미하므로 FE 표기 분기용으로 내려줌.
    // Holiday.date는 법인 현지자정 naive 저장이라 exact equality 대신 tz 변환 문자열로 비교
    const dow = targetDate.getUTCDay()
    let isWorkday = dow !== 0 && dow !== 6
    if (isWorkday) {
      const holidayCandidates = await prisma.holiday.findMany({
        where: {
          companyId,
          date: {
            gte: new Date(targetDate.getTime() - 24 * 60 * 60 * 1000),
            lte: nextDay,
          },
        },
        select: { date: true },
      })
      // 저장 관행이 이중(UTC자정 vs 현지자정-as-UTC — [[hrhub-attendance-naive-timestamp-tz]])이라
      // 두 해석 중 하나라도 대상 날짜와 일치하면 공휴일로 판정
      isWorkday = !holidayCandidates.some(
        (h) =>
          formatToTz(h.date, dayCtx.timezone, 'yyyy-MM-dd') === dateStr ||
          h.date.toISOString().slice(0, 10) === dateStr,
      )
    }

    // 3. Total employees count
    const totalEmployees = await prisma.employee.count({
      where: {
        deletedAt: null,
        assignments: {
          some: {
            companyId,
            isPrimary: true,
            effectiveDate: { lte: targetDate },
            OR: [
              { endDate: null },
              { endDate: { gt: targetDate } },
            ],
          },
        },
      },
    })

    // 4. Today's attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        ...companyFilter,
        workDate: { gte: targetDate, lt: nextDay },
      },
      include: {
        employee: {
          select: {
            name: true,
            employeeNo: true,
          },
        },
      },
    })

    // 5. Calculate KPIs
    const presentCount = attendanceRecords.length
    const lateCount = attendanceRecords.filter((a) => a.status === 'LATE').length
    const absentCount = totalEmployees - presentCount
    const totalMinutesSum = attendanceRecords.reduce(
      (sum, a) => sum + (a.totalMinutes ?? 0),
      0,
    )
    const avgMinutes = presentCount > 0 ? totalMinutesSum / presentCount : 0

    // 6. Anomaly list (LATE, EARLY_OUT, ABSENT status records)
    const anomalyStatuses = ['LATE', 'EARLY_OUT', 'ABSENT'] as const
    const anomalyList = attendanceRecords
      .filter((a) => (anomalyStatuses as readonly string[]).includes(a.status))
      .map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employee.name,
        employeeNo: a.employee.employeeNo,
        status: a.status,
        clockIn: a.clockIn,
        clockOut: a.clockOut,
        workType: a.workType,
        totalMinutes: a.totalMinutes,
        note: a.note,
      }))
      .slice(0, 20)

    return apiSuccess({
      date: dateStr,
      kpi: {
        totalEmployees,
        presentCount,
        lateCount,
        absentCount,
        avgTotalMinutes: Math.round(avgMinutes),
        isWorkday,
      },
      anomalies: anomalyList,
    })
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
