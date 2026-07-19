// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/admin/weekly
// HR 전사 주간 근태 매트릭스 (직원 × 7일 + 휴가 오버레이, 커서 페이지네이션)
// 단일 read path — 컬럼은 Attendance에 이미 존재, 신규 집계 없음.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { parseDateOnly } from '@/lib/timezone'
import { resolveDayContext } from '@/lib/attendance/judgeStatus'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 50
const WEEK_LENGTH = 7

// ─── 날짜 헬퍼 (UTC 연산 — 서버 tz drift 회피) ───────────────

// YYYY-MM-DD + n일 → YYYY-MM-DD
function addDaysUTC(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// dateStr이 속한 주의 월요일 (UTC 기준)
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=일 … 6=토
  const offset = dow === 0 ? -6 : 1 - dow
  return addDaysUTC(dateStr, offset)
}

// 저장된 date-only(UTC 자정) → YYYY-MM-DD
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// 실제 달력 날짜인지 (정규식만으론 2026-02-31 등이 통과 후 보정됨 — Gate2 P2)
function isRealDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── GET ─────────────────────────────────────────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    // 전사 주간 근태 = HR 전용 (라이브 /attendance/admin 스코프와 정합 — EXECUTIVE 제외, att-05)
    if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('전체 근태 조회 권한이 없습니다.')
    }

    const { searchParams } = new URL(req.url)
    // 멀티테넌트: 비-SUPER는 자기 법인 강제 (resolveCompanyId SSOT)
    const companyId = resolveCompanyId(user, searchParams.get('companyId'))

    // 주 시작(월요일). start 미지정 시 대상 법인 "오늘"의 주 월요일.
    const startParam = searchParams.get('start')
    if (startParam && (!/^\d{4}-\d{2}-\d{2}$/.test(startParam) || !isRealDate(startParam))) {
      throw badRequest('start는 유효한 YYYY-MM-DD 날짜여야 합니다.')
    }
    const now = new Date()
    const ctx = await resolveDayContext(companyId, now)
    const weekStart = mondayOf(startParam ?? ctx.localDateStr)
    const days = Array.from({ length: WEEK_LENGTH }, (_, i) => addDaysUTC(weekStart, i))
    const weekEndExclusive = addDaysUTC(weekStart, WEEK_LENGTH)
    const weekStartDate = parseDateOnly(weekStart)
    const weekEndExclusiveDate = parseDateOnly(weekEndExclusive)

    const departmentId = searchParams.get('departmentId')

    // 커서 페이지네이션 (안정적인 employee.id 기준 — offset 금지: 명단 변동 내성)
    const cursor = searchParams.get('cursor')
    if (cursor && !UUID_RE.test(cursor)) {
      throw badRequest('cursor 형식이 올바르지 않습니다.')
    }
    const limitRaw = Number(searchParams.get('limit') ?? DEFAULT_LIMIT)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_LIMIT),
    )

    // ── 1. 직원 페이지 (선택 주간과 겹치는 primary assignment · company[· dept]) ──
    //    EmployeeAssignment는 [effectiveDate, endDate) 반개방 구간이다.
    const assignmentFence = {
      companyId,
      isPrimary: true,
      effectiveDate: { lt: weekEndExclusiveDate },
      OR: [{ endDate: null }, { endDate: { gt: weekStartDate } }],
      ...(departmentId ? { departmentId } : {}),
    }
    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        assignments: {
          some: assignmentFence,
        },
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        // 응답 부서명도 동일 법인·주간으로 한정 (동시발령 시 타 법인 부서명 누출 방지)
        assignments: {
          where: assignmentFence,
          orderBy: { effectiveDate: 'desc' },
          take: 1,
          select: { department: { select: { name: true } } },
        },
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = employees.length > limit
    const pageEmployees = hasMore ? employees.slice(0, limit) : employees
    const nextCursor = hasMore ? pageEmployees[pageEmployees.length - 1]!.id : null
    const employeeIds = pageEmployees.map((e) => e.id)

    // ── 2+3. 근태 · 승인 휴가 bulk (페이지 직원 한정 — per-employee 쿼리 없음) ──
    // employeeIds=[] 이면 in:[] → 빈 결과 (안전). 항상 2쿼리로 타입 단순화.
    const [attendanceRows, leaveRows] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          workDate: { gte: weekStartDate, lt: weekEndExclusiveDate },
        },
        select: {
          employeeId: true,
          workDate: true,
          clockIn: true,
          clockOut: true,
          totalMinutes: true,
          overtimeMinutes: true,
          status: true,
          workType: true,
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          status: 'APPROVED',
          // 주 윈도우와 겹치는 승인 휴가: start < 주말(+1) AND end >= 주시작
          startDate: { lt: weekEndExclusiveDate },
          endDate: { gte: weekStartDate },
        },
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
          halfDayType: true,
          policy: { select: { leaveType: true } },
        },
      }),
    ])

    // ── 4. JS 병합 (직원 × 7일 셀) ──
    const attMap = new Map<string, (typeof attendanceRows)[number]>()
    for (const a of attendanceRows) {
      attMap.set(`${a.employeeId}|${toDateStr(a.workDate)}`, a)
    }
    // 승인 휴가를 일자별로 펼침 (date-only 문자열 동등 비교 — UTC 저장값 기준)
    const leaveMap = new Map<string, { leaveType: string; halfDayType: string | null }>()
    for (const lv of leaveRows) {
      const s = toDateStr(lv.startDate)
      const e = toDateStr(lv.endDate)
      for (const day of days) {
        if (day >= s && day <= e) {
          leaveMap.set(`${lv.employeeId}|${day}`, {
            leaveType: lv.policy.leaveType,
            halfDayType: lv.halfDayType,
          })
        }
      }
    }

    const rows = pageEmployees.map((emp) => {
      const department = extractPrimaryAssignment(emp.assignments)?.department?.name ?? null
      const cells = days.map((day) => {
        const att = attMap.get(`${emp.id}|${day}`) ?? null
        const leave = leaveMap.get(`${emp.id}|${day}`) ?? null
        return {
          date: day,
          // 셀은 다중 fact: 근태 + 휴가 오버레이 (AttendanceStatus enum에 휴가를 욱여넣지 않음)
          attendance: att
            ? {
                clockIn: att.clockIn?.toISOString() ?? null,
                clockOut: att.clockOut?.toISOString() ?? null,
                totalMinutes: att.totalMinutes ?? 0,
                overtimeMinutes: att.overtimeMinutes ?? 0,
                status: att.status,
                workType: att.workType,
              }
            : null,
          leave,
        }
      })
      return {
        employeeId: emp.id,
        name: emp.name,
        employeeNo: emp.employeeNo,
        department,
        cells,
      }
    })

    return apiSuccess({ weekStart, days, rows, nextCursor })
  },
  // /attendance/admin과 동일 게이트(att-05): HR 전용 — 핸들러 내 명시 role 체크와 이중 방어
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
