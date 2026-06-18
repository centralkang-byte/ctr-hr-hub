// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Manager-Hub 활동(1:1·칭찬·주간일정·위임) 집계
//   GET /api/v1/manager-hub/activity
// 매니저 허브 "1:1 · 활동" 탭(PR-2)용 단일 집계 엔드포인트.
// 4개 섹션을 한 번에 반환 — RBAC·법인 스코프·N+1 가드를 한곳에 모음.
//   · 다가오는 1:1   = OneOnOne.managerId = 본인 (CFR 위계 = managerId, CLAUDE.md)
//   · 보낸 칭찬       = Recognition.senderId = 본인
//   · 팀 주간일정     = 직속부하(getDirectReportIds)의 이번 주 APPROVED 휴가
//   · 위임 현황       = ApprovalDelegation.delegatorId = 본인 (현재 유효한 활성건)
// 전 쿼리 companyId 스코프(전출직원/타 법인 행 차단). 글로벌 쓰기 없음(읽기 전용).
//
// 시간대: 주/분기 경계는 법인 timezone 기준으로 계산(서버 UTC off-by-one 방지).
// 휴가(startDate/endDate)는 UTC-자정 date-only 저장이라 주 윈도도 UTC-자정 date-only로
// 맞춰 비교 — "오늘"만 법인 tz로 판정하고 경계 산식은 date-only 공간에서 수행.
// [[hrhub-attendance-naive-timestamp-tz]]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import { formatToTz, getStartOfDayTz } from '@/lib/timezone'
import type { SessionUser } from '@/types'

// ─── Constants ──────────────────────────────────────────────

const LIST_LIMIT = 12 // 1:1·칭찬 미리보기 상한 (전체는 /performance 페이지)
const DEFAULT_TZ = 'Asia/Seoul'
const WEEKDAY_COUNT = 5 // 월~금

// ─── Helpers ────────────────────────────────────────────────

/** 법인 tz 기준 "오늘"의 UTC-자정 Date + 'yyyy-MM-dd' 문자열.
 *  휴가는 UTC-자정 date-only로 저장되므로 경계 산식은 이 공간에서 수행. */
function tzToday(now: Date, tz: string): { utcMidnight: Date; iso: string } {
  const iso = formatToTz(now, tz, 'yyyy-MM-dd') // 법인 tz 달력일
  const [y, m, d] = iso.split('-').map(Number)
  return { utcMidnight: new Date(Date.UTC(y, m - 1, d)), iso }
}

/** 이번 주 [월요일, 다음 월요일) UTC-자정 윈도 + 월~금 'yyyy-MM-dd' 배열. */
function weekWindow(todayUtcMidnight: Date): {
  weekStart: Date
  weekEnd: Date
  weekDates: string[]
} {
  const dow = todayUtcMidnight.getUTCDay() // 0=일 .. 6=토
  const sinceMonday = (dow + 6) % 7
  const weekStart = new Date(todayUtcMidnight)
  weekStart.setUTCDate(todayUtcMidnight.getUTCDate() - sinceMonday)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7)
  const weekDates = Array.from({ length: WEEKDAY_COUNT }, (_, i) => {
    const d = new Date(weekStart)
    d.setUTCDate(weekStart.getUTCDate() + i)
    return formatToTz(d, 'UTC', 'yyyy-MM-dd')
  })
  return { weekStart, weekEnd, weekDates }
}

/** 현재 분기 시작 instant (법인 tz 자정). completedAt/createdAt 은 실 timestamp라 instant 비교. */
function quarterStartInstant(todayIso: string, tz: string): Date {
  const [y, m] = todayIso.split('-').map(Number)
  const qStartMonth = Math.floor((m - 1) / 3) * 3 // 0,3,6,9
  // 정오 UTC 앵커 → 음수 오프셋 tz에서도 같은 달력일 유지 후 tz 자정으로 환산.
  return getStartOfDayTz(new Date(Date.UTC(y, qStartMonth, 1, 12)), tz)
}

// ─── Handler ────────────────────────────────────────────────

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      if (user.role === 'EMPLOYEE') throw forbidden('매니저 이상만 접근할 수 있습니다.')

      const companyId = user.companyId
      const managerId = user.employeeId
      const now = new Date()

      // tz(법인)·직속부하 ID는 서로 독립 → 병렬.
      const [company, directIds] = await Promise.all([
        prisma.company.findUnique({ where: { id: companyId }, select: { timezone: true } }),
        getDirectReportIds(managerId),
      ])
      const tz = company?.timezone || DEFAULT_TZ
      const { utcMidnight, iso: todayIso } = tzToday(now, tz)
      const { weekStart, weekEnd, weekDates } = weekWindow(utcMidnight)
      const quarterStart = quarterStartInstant(todayIso, tz)

      // 주간일정용 팀원 = members/announce 와 동일한 활성 자사 primary 발령 필터.
      // getDirectReportIds 는 발령 status 를 안 거르므로(날짜창만), 퇴직/비활성 발령·타 법인을
      // 여기서 배제 → weeklyLeave ⊆ /members 로스터 보장(퇴직자 휴가 노출 차단). (Codex G2)
      const activeMemberIds =
        directIds.length === 0
          ? []
          : (
              await prisma.employee.findMany({
                where: {
                  id: { in: directIds },
                  assignments: {
                    some: {
                      companyId,
                      isPrimary: true,
                      status: 'ACTIVE',
                      effectiveDate: { lte: now },
                      OR: [{ endDate: null }, { endDate: { gt: now } }],
                    },
                  },
                },
                select: { id: true },
              })
            ).map((e) => e.id)

      // 모든 쿼리 companyId 스코프 — 병렬 (독립적).
      const [
        upcomingOneOnOnes,
        upcoming1on1Count,
        completed1on1Quarter,
        sentRecognitions,
        sentRecognitionsQuarter,
        weeklyLeaveRows,
        delegations,
      ] = await Promise.all([
        prisma.oneOnOne.findMany({
          where: { companyId, managerId, status: 'SCHEDULED', scheduledAt: { gte: now } },
          orderBy: { scheduledAt: 'asc' },
          take: LIST_LIMIT,
          select: {
            id: true,
            scheduledAt: true,
            meetingType: true,
            agenda: true,
            employee: { select: { id: true, name: true } },
          },
        }),
        prisma.oneOnOne.count({
          where: { companyId, managerId, status: 'SCHEDULED', scheduledAt: { gte: now } },
        }),
        prisma.oneOnOne.count({
          where: { companyId, managerId, status: 'COMPLETED', completedAt: { gte: quarterStart } },
        }),
        prisma.recognition.findMany({
          where: { companyId, senderId: managerId },
          orderBy: { createdAt: 'desc' },
          take: LIST_LIMIT,
          select: {
            id: true,
            coreValue: true,
            message: true,
            createdAt: true,
            receiver: { select: { id: true, name: true } },
          },
        }),
        prisma.recognition.count({
          where: { companyId, senderId: managerId, createdAt: { gte: quarterStart } },
        }),
        activeMemberIds.length === 0
          ? Promise.resolve([])
          : prisma.leaveRequest.findMany({
              where: {
                companyId,
                employeeId: { in: activeMemberIds },
                status: 'APPROVED',
                startDate: { lt: weekEnd },
                endDate: { gte: weekStart },
              },
              orderBy: { startDate: 'asc' },
              select: {
                id: true,
                startDate: true,
                endDate: true,
                days: true,
                halfDayType: true,
                employee: { select: { id: true, name: true } },
                leaveTypeDef: { select: { name: true } },
              },
            }),
        prisma.approvalDelegation.findMany({
          where: {
            companyId,
            delegatorId: managerId,
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now },
          },
          orderBy: { endDate: 'asc' },
          select: {
            id: true,
            scope: true,
            startDate: true,
            endDate: true,
            delegatee: { select: { id: true, name: true } },
          },
        }),
      ])

      const oneOnOnes = upcomingOneOnOnes.map((o) => ({
        id: o.id,
        employee: o.employee,
        scheduledAt: o.scheduledAt.toISOString(),
        meetingType: o.meetingType,
        agenda: o.agenda,
      }))

      const recognitions = sentRecognitions.map((r) => ({
        id: r.id,
        receiver: r.receiver,
        coreValue: r.coreValue,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
      }))

      // 휴가는 date-only — 'yyyy-MM-dd'(UTC)로 반환해 클라가 tz 산식 없이 주별 버킷.
      const weeklyLeave = weeklyLeaveRows.map((l) => ({
        id: l.id,
        employee: l.employee,
        startDate: formatToTz(l.startDate, 'UTC', 'yyyy-MM-dd'),
        endDate: formatToTz(l.endDate, 'UTC', 'yyyy-MM-dd'),
        days: Number(l.days),
        halfDayType: l.halfDayType,
        leaveTypeName: l.leaveTypeDef?.name ?? null,
      }))

      const delegationList = delegations.map((d) => ({
        id: d.id,
        delegatee: d.delegatee,
        scope: d.scope,
        startDate: d.startDate.toISOString(),
        endDate: d.endDate.toISOString(),
      }))

      return apiSuccess({
        weekDates,
        oneOnOnes,
        recognitions,
        weeklyLeave,
        delegations: delegationList,
        counts: {
          upcomingOneOnOnes: upcoming1on1Count,
          completedOneOnOnesQuarter: completed1on1Quarter,
          sentRecognitionsQuarter,
          activeDelegations: delegationList.length,
        },
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
