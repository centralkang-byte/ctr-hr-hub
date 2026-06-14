// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/admin/roster
// HR 전사 "오늘(또는 특정일)" 직원별 근태 명단 (직원 + 당일 근태 + 승인휴가 오버레이).
// 형제 weekly endpoint의 단일-날짜 변형. 신규 집계 없음 — 컬럼은 이미 존재.
// /attendance/admin(KPI·이상치)와 별개의 additive 엔드포인트 — 그 계약은 건드리지 않는다.
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
import type { SessionUser } from '@/types'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 50

// ─── 날짜 헬퍼 (UTC 연산 — 서버 tz drift 회피, weekly와 동일) ─────

// YYYY-MM-DD + n일 → YYYY-MM-DD
function addDaysUTC(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// 저장된 date-only(UTC 자정) → YYYY-MM-DD
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// 실제 달력 날짜인지 (정규식만으론 2026-02-31 등이 통과 후 보정됨)
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
    // 전사 근태 명단 = HR 전용 (라이브 /attendance/admin·weekly 스코프와 정합 — EXECUTIVE 제외, att-05)
    if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('전체 근태 조회 권한이 없습니다.')
    }

    const { searchParams } = new URL(req.url)
    // 멀티테넌트: 비-SUPER는 자기 법인 강제 (resolveCompanyId SSOT)
    const companyId = resolveCompanyId(user, searchParams.get('companyId'))

    // 대상 날짜 — 미지정 시 대상 법인 타임존의 "오늘". 쓰기 경로(clock-in)와 동일 달력일.
    const localToday = (await resolveDayContext(companyId, new Date())).localDateStr
    const dateParam = searchParams.get('date')
    if (dateParam && (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam) || !isRealDate(dateParam))) {
      throw badRequest('date는 유효한 YYYY-MM-DD 날짜여야 합니다.')
    }
    const dateStr = dateParam ?? localToday
    // 미래 날짜 거부 → date<=오늘 보장 → effectiveDate<=date도 미래 전적 PII 노출 불가 (Gate1 P1-1)
    if (dateStr > localToday) {
      throw badRequest('미래 날짜는 조회할 수 없습니다.')
    }
    const D = parseDateOnly(dateStr)
    const Dnext = parseDateOnly(addDaysUTC(dateStr, 1))

    // departmentId 필터: 제공 시 대상 법인 소속 검증 (타 법인 부서로 직원 필터링 차단 — Gate1-R2 P1)
    const departmentId = searchParams.get('departmentId')
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, companyId },
        select: { id: true },
      })
      if (!dept) throw badRequest('부서를 찾을 수 없습니다.')
    }

    // ── 직원 집합 술어: 날짜 D에 active였던 primary assignment (date-aware 역사 fence) ──
    //    effectiveDate<=D(=당일 입사 포함) · endDate null|>=D(이후 퇴직자 포함, 미입사 제외).
    //    @db.Date 컬럼 → parseDateOnly(UTC 자정) 경계. soft-deleted는 전역 정책상 제외.
    //    cursor 검증·페이지 쿼리에 동일 술어 재사용 (Gate1-R2 P2).
    const assignmentFence = {
      companyId,
      isPrimary: true,
      effectiveDate: { lte: D },
      OR: [{ endDate: null }, { endDate: { gte: D } }],
      ...(departmentId ? { departmentId } : {}),
    }
    const employeeWhere = {
      deletedAt: null,
      assignments: { some: assignmentFence },
    }

    // 커서 페이지네이션 (안정적인 employee.id — offset 금지: 명단 변동 내성)
    const cursor = searchParams.get('cursor')
    if (cursor) {
      if (!UUID_RE.test(cursor)) {
        throw badRequest('cursor 형식이 올바르지 않습니다.')
      }
      // cursor 소유권: 결과집합과 동일 술어로 검증 → 타 테넌트/범위 밖 UUID 커서 차단 (Gate1 P2-1)
      const owns = await prisma.employee.count({ where: { id: cursor, ...employeeWhere } })
      if (owns !== 1) {
        throw badRequest('cursor가 올바르지 않습니다.')
      }
    }
    const limitRaw = Number(searchParams.get('limit') ?? DEFAULT_LIMIT)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_LIMIT),
    )

    // ── 1. 직원 페이지 ──
    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        name: true,
        employeeNo: true,
        // D 시점 부서명: 동일 fence + 최신 effectiveDate. department.companyId는 JS에서 재검증
        // (타 법인 부서 mislink 시 이름 노출 차단 — Gate1-R2 P1; take 1은 그대로 D-era assignment).
        assignments: {
          where: assignmentFence,
          orderBy: { effectiveDate: 'desc' },
          take: 1,
          select: { department: { select: { name: true, companyId: true } } },
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

    // ── 2+3. 근태(직원당 ≤1, @@unique) · 승인 휴가 bulk (페이지 직원 한정, per-employee 없음) ──
    const [attendanceRows, leaveRows] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          companyId,
          employeeId: { in: employeeIds },
          workDate: { gte: D, lt: Dnext },
        },
        select: {
          id: true,
          employeeId: true,
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
          // 연관 policy도 동일 법인 (mislink 시 타 법인 정책명 노출 차단 — Gate1 P1-3)
          policy: { companyId },
          // D와 겹치는 승인 휴가: start < D+1 AND end >= D (weekly overlap predicate 미러)
          startDate: { lt: Dnext },
          endDate: { gte: D },
        },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
          halfDayType: true,
          policy: { select: { leaveType: true } },
        },
      }),
    ])

    // ── 4. JS 병합 ──
    // 근태: @@unique([employeeId, workDate]) → 직원당 단일 객체.
    const attMap = new Map<string, (typeof attendanceRows)[number]>()
    for (const a of attendanceRows) {
      attMap.set(a.employeeId, a)
    }
    // 휴가: 직원당 배열 (같은날 AM/PM 반차·중복 표현). 멤버십 재확인 — leave 날짜는 로컬 달력일의
    // UTC-자정 저장이므로 toDateStr(UTC 절단)이 달력일을 정확히 복원 (leave/requests:74-75 불변조건).
    const leavesMap = new Map<string, Array<{ leaveType: string; halfDayType: string | null }>>()
    for (const lv of leaveRows) {
      if (toDateStr(lv.startDate) <= dateStr && dateStr <= toDateStr(lv.endDate)) {
        const arr = leavesMap.get(lv.employeeId) ?? []
        arr.push({ leaveType: lv.policy.leaveType, halfDayType: lv.halfDayType })
        leavesMap.set(lv.employeeId, arr)
      }
    }

    const rows = pageEmployees.map((emp) => {
      const dept = emp.assignments[0]?.department
      const department = dept && dept.companyId === companyId ? dept.name : null
      const att = attMap.get(emp.id) ?? null
      return {
        employeeId: emp.id,
        name: emp.name,
        employeeNo: emp.employeeNo,
        department,
        // 다중 fact: 근태 + 휴가 오버레이 (AttendanceStatus enum에 휴가를 욱여넣지 않음)
        attendance: att
          ? {
              id: att.id,
              clockIn: att.clockIn?.toISOString() ?? null,
              clockOut: att.clockOut?.toISOString() ?? null,
              totalMinutes: att.totalMinutes ?? 0,
              overtimeMinutes: att.overtimeMinutes ?? 0,
              status: att.status,
              workType: att.workType,
            }
          : null,
        leaves: leavesMap.get(emp.id) ?? [],
      }
    })

    return apiSuccess({ date: dateStr, rows, nextCursor })
  },
  // weekly/admin과 동일 게이트(att-05): HR 전용 — 핸들러 내 명시 role 체크와 이중 방어
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
