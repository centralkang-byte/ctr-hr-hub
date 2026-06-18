// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/manager-hub/members
// 매니저 직속부하 로스터 (팀원 탭 + 개요 미리보기 grid).
// per-member: 직책·부서·당월 초과근무·연차사용률·성과등급(공개분만)·이직위험·오늘 상태.
// 스코프: getDirectReportIds(직속부하) + 자사 active primary (타 법인 0 노출).
//   summary 헤드카운트는 getAllReportIds(cross-company dotted-line 포함)라 미세 불일치 가능 —
//   로스터는 same-company 직속부하만(per-member 상세 노출 최소 표면).
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import { leaveAvailable, leaveUtilizationRate, annualBalanceWhere } from '@/lib/leave/utilization'
import type { SessionUser } from '@/types'

// ─── Helpers ────────────────────────────────────────────────

type MemberStatus = 'PRESENT' | 'LEAVE' | 'HALF_DAY' | 'VACATION' | 'ABSENT'
type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH'

// summary 라우트와 동일한 오늘 상태 판정 (SSOT 일치).
function resolveMemberStatus(
  employeeId: string,
  attendanceMap: Map<string, boolean>,
  leaveMap: Map<string, { isHalfDay: boolean; days: number }>,
): MemberStatus {
  const hasAttendance = attendanceMap.has(employeeId)
  const leave = leaveMap.get(employeeId)
  if (leave) {
    if (leave.isHalfDay) return 'HALF_DAY'
    return leave.days >= 2 ? 'VACATION' : 'LEAVE'
  }
  return hasAttendance ? 'PRESENT' : 'ABSENT'
}

// summary 의 attritionRiskScore>=70 임계와 정합.
function riskBand(score: number | null | undefined): RiskBand {
  const s = score ?? 0
  if (s >= 70) return 'HIGH'
  if (s >= 40) return 'MEDIUM'
  return 'LOW'
}

// ─── Route ──────────────────────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      // manager-hub 라우트 패턴(team-health/alerts)과 동일 — EMPLOYEE 거부.
      if (user.role === 'EMPLOYEE') throw forbidden('매니저 이상만 접근할 수 있습니다.')

      const companyId = user.companyId
      const directIds = await getDirectReportIds(user.employeeId)
      if (directIds.length === 0) return apiSuccess({ members: [] })

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart)
      todayEnd.setDate(todayEnd.getDate() + 1)
      const year = now.getFullYear()

      // "현재 활성" = effectiveDate<=now AND endDate null|미래 (예약 조직개편 현 발령 포함,
      // endDate:null 단독은 undercount — Codex Gate2 P1) + status:'ACTIVE'
      // (오프보딩 RESIGNED/TERMINATED 이나 endDate 열린 계정의 민감정보 노출 차단 —
      // Codex Gate2 P1; summary 라우트 status:'ACTIVE' 와 정렬).
      const activePrimary = {
        companyId,
        isPrimary: true,
        status: 'ACTIVE',
        effectiveDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      }

      // 자사 active primary 직속부하만 (전출자/타 법인 제외)
      const memberRows = await prisma.employee.findMany({
        where: {
          id: { in: directIds },
          assignments: { some: activePrimary },
        },
        select: {
          id: true,
          name: true,
          attritionRiskScore: true,
          isHighPotential: true,
          assignments: {
            where: activePrimary,
            select: {
              position: {
                select: { titleKo: true, department: { select: { name: true } } },
              },
            },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
      })
      const memberIds = memberRows.map((m) => m.id)
      if (memberIds.length === 0) return apiSuccess({ members: [] })

      const [overtimeRecords, todayAttendance, todayLeaves, balances, latestCycle] =
        await Promise.all([
          // companyId 스코프 — 전출직원의 이전 법인 attendance/leave 행 집계 차단 (Codex Gate2 P2)
          prisma.attendance.findMany({
            where: {
              employeeId: { in: memberIds },
              companyId,
              workDate: { gte: monthStart },
              overtimeMinutes: { gt: 0 },
            },
            select: { employeeId: true, overtimeMinutes: true },
          }),
          prisma.attendance.findMany({
            where: {
              employeeId: { in: memberIds },
              companyId,
              workDate: { gte: todayStart, lt: todayEnd },
            },
            select: { employeeId: true },
          }),
          prisma.leaveRequest.findMany({
            where: {
              employeeId: { in: memberIds },
              companyId,
              status: 'APPROVED',
              startDate: { lt: todayEnd },
              endDate: { gte: todayStart },
            },
            select: { employeeId: true, days: true },
          }),
          // 연차(annual)만 + 자사 스코프 (annualBalanceWhere = 전출자 잔여행 차단)
          prisma.leaveYearBalance.findMany({
            where: { employeeId: { in: memberIds }, year, ...annualBalanceWhere(companyId) },
            select: {
              employeeId: true,
              entitled: true,
              used: true,
              carriedOver: true,
              adjusted: true,
            },
          }),
          prisma.performanceCycle.findFirst({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          }),
        ])

      // 성과등급 = 통보된(notifiedAt != null) 리뷰의 finalGrade 만 노출 (미공개 차단).
      const gradeMap = new Map<string, string>()
      if (latestCycle) {
        const reviews = await prisma.performanceReview.findMany({
          where: {
            cycleId: latestCycle.id,
            employeeId: { in: memberIds },
            notifiedAt: { not: null },
            finalGrade: { not: null },
          },
          select: { employeeId: true, finalGrade: true },
        })
        for (const r of reviews) if (r.finalGrade) gradeMap.set(r.employeeId, r.finalGrade)
      }

      // per-member 당월 초과근무 합 (summary 와 동일 naive monthStart)
      const overtimeMap = new Map<string, number>()
      for (const r of overtimeRecords) {
        overtimeMap.set(
          r.employeeId,
          (overtimeMap.get(r.employeeId) ?? 0) + (r.overtimeMinutes ?? 0),
        )
      }

      const attendanceMap = new Map<string, boolean>()
      for (const a of todayAttendance) attendanceMap.set(a.employeeId, true)

      const leaveMap = new Map<string, { isHalfDay: boolean; days: number }>()
      for (const lr of todayLeaves) {
        const days = Number(lr.days)
        const existing = leaveMap.get(lr.employeeId)
        if (existing) {
          const total = existing.days + days
          leaveMap.set(lr.employeeId, { isHalfDay: total < 1, days: total })
        } else {
          leaveMap.set(lr.employeeId, { isHalfDay: days < 1, days })
        }
      }

      // 연차 잔액 — annual def 가 자사+글로벌 2행일 수 있어 직원별 합산.
      const balMap = new Map<string, { used: number; available: number }>()
      for (const b of balances) {
        const avail = leaveAvailable(b)
        const existing = balMap.get(b.employeeId)
        if (existing) {
          balMap.set(b.employeeId, { used: existing.used + b.used, available: existing.available + avail })
        } else {
          balMap.set(b.employeeId, { used: b.used, available: avail })
        }
      }

      const members = memberRows.map((emp) => {
        const bal = balMap.get(emp.id)
        const rate = bal ? leaveUtilizationRate(bal.used, bal.available) : null
        return {
          id: emp.id,
          name: emp.name,
          positionTitle: emp.assignments[0]?.position?.titleKo ?? '',
          departmentName: emp.assignments[0]?.position?.department?.name ?? '',
          overtimeMinutesMonth: overtimeMap.get(emp.id) ?? 0,
          leaveUsagePct: rate === null ? null : Math.round(rate * 100),
          performanceGrade: gradeMap.get(emp.id) ?? null,
          riskBand: riskBand(emp.attritionRiskScore),
          attritionRiskScore: emp.attritionRiskScore ?? 0,
          isHighPotential: emp.isHighPotential,
          status: resolveMemberStatus(emp.id, attendanceMap, leaveMap),
        }
      })

      return apiSuccess({ members })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
