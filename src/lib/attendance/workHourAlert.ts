// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 52시간 경고 체커 (B6-1)
// 주간 누적 근무시간 체크 + WorkHourAlert upsert
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'
import { getStartOfDayTz } from '@/lib/timezone'
import { formatInTimeZone } from 'date-fns-tz'
import { getAttendanceSetting } from '@/lib/settings/get-setting'

// ─── Types ───────────────────────────────────────────────

export type AlertLevel = 'caution' | 'warning' | 'blocked'

interface AlertThresholds {
  caution: number
  warning: number
  blocked: number
}

// Alert thresholds: AttendanceSetting (per-company) → CompanyProcessSetting → hardcoded
const DEFAULT_THRESHOLDS: AlertThresholds = {
  caution: 44,
  warning: 48,
  blocked: 52,
}

// ─── 타임존 해석 (Employee → AttendanceSetting → 기본값) ──

/**
 * 직원 개인 timezone → 법인 AttendanceSetting timezone → 'Asia/Seoul' 순으로 폴백.
 */
async function resolveTimezone(employeeId: string, companyId: string): Promise<string> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { timezone: true },
  })
  if (employee?.timezone) return employee.timezone

  const setting = await prisma.attendanceSetting.findUnique({
    where: { companyId },
    select: { timezone: true },
  })
  if (setting?.timezone) return setting.timezone

  return 'Asia/Seoul'
}

// ─── 주 시작(월요일 00:00 현지 기준) → UTC 계산 ────────────

/**
 * 주어진 날짜가 속한 주의 월요일 00:00:00을 현지 타임존 기준으로 계산하여 UTC Date로 반환.
 */
function getWeekStartTz(date: Date, timezone: string): Date {
  // 현지 타임존 기준 날짜 문자열 획득
  const localDateStr = formatInTimeZone(date, timezone, 'yyyy-MM-dd')
  const [year, month, day] = localDateStr.split('-').map(Number)

  // 해당 날짜의 요일 (0=일, 1=월 … 6=토) — UTC로 파싱해 요일만 사용
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  // 현지 기준 월요일 날짜 (UTC Date 객체로 날짜 계산만 수행)
  const mondayDate = new Date(Date.UTC(year, month - 1, day - daysFromMonday))

  // 현지 타임존의 해당 월요일 00:00:00 → UTC
  return getStartOfDayTz(mondayDate, timezone)
}

// ─── 이번 주 총 근무 시간(시간) 계산 ─────────────────────────

async function getWeeklyHours(
  employeeId: string,
  weekStart: Date,
  timezone: string,
): Promise<number> {
  // weekEnd = 다음 주 월요일 00:00 현지 기준 → UTC
  // weekStart의 현지 날짜에 7일 더한 날짜로 계산
  const mondayLocalStr = formatInTimeZone(weekStart, timezone, 'yyyy-MM-dd')
  const [year, month, day] = mondayLocalStr.split('-').map(Number)
  const nextMondayDate = new Date(Date.UTC(year, month - 1, day + 7))
  const weekEnd = getStartOfDayTz(nextMondayDate, timezone)

  // clockIn 기준 쿼리 (UTC 경계):
  // - clockIn >= weekStart: 해당 주에 출근한 레코드만 포함
  // - clockIn < weekEnd: 다음 주 출근 레코드 제외
  // 심야 교대 처리: clockIn이 이번 주에 속하면 clockOut이 다음 날(또는 다음 주 초)
  // 이어지더라도 totalMinutes 전체를 합산 → 경계 절단 없음
  const records = await prisma.attendance.findMany({
    where: {
      employeeId,
      clockIn: { gte: weekStart, lt: weekEnd },
      clockOut: { not: null },
    },
    select: { totalMinutes: true },
  })

  const totalMinutes = records.reduce((sum, r) => sum + (r.totalMinutes ?? 0), 0)
  return totalMinutes / 60
}

// ─── 법인 임계값 조회 ─────────────────────────────────────────

async function getThresholds(companyId: string): Promise<AlertThresholds> {
  // 1st: Try AttendanceSetting (existing per-company model)
  const setting = await prisma.attendanceSetting.findUnique({
    where: { companyId },
    select: { alertThresholds: true },
  })

  if (setting?.alertThresholds) {
    const raw = setting.alertThresholds as Record<string, number>
    return {
      caution: raw.caution ?? DEFAULT_THRESHOLDS.caution,
      warning: raw.warning ?? DEFAULT_THRESHOLDS.warning,
      blocked: raw.blocked ?? DEFAULT_THRESHOLDS.blocked,
    }
  }

  // 2nd: Try CompanyProcessSetting (new unified settings)
  const processSetting = await getAttendanceSetting<AlertThresholds>(
    'work-hour-thresholds',
    companyId,
  )

  if (processSetting) {
    return {
      caution: processSetting.caution ?? DEFAULT_THRESHOLDS.caution,
      warning: processSetting.warning ?? DEFAULT_THRESHOLDS.warning,
      blocked: processSetting.blocked ?? DEFAULT_THRESHOLDS.blocked,
    }
  }

  // 3rd: Hardcoded defaults
  return DEFAULT_THRESHOLDS
}

// ─── 경고 레벨 판정 ───────────────────────────────────────────

function determineAlertLevel(
  hours: number,
  thresholds: AlertThresholds,
): AlertLevel | null {
  if (hours >= thresholds.blocked) return 'blocked'
  if (hours >= thresholds.warning) return 'warning'
  if (hours >= thresholds.caution) return 'caution'
  return null
}

// ─── checkWorkHourAlert — 메인 함수 ──────────────────────────

/**
 * 퇴근(clock-out) 시 호출.
 * 이번 주 누적 근무시간을 계산하고 필요 시 WorkHourAlert를 upsert.
 * 기존에 해결된 경고도 새로운 수준이면 다시 활성화.
 *
 * @returns { alertLevel, weeklyHours, isBlocked }
 */
export async function checkWorkHourAlert(
  employeeId: string,
  companyId: string,
): Promise<{ alertLevel: AlertLevel | null; weeklyHours: number; isBlocked: boolean }> {
  const timezone = await resolveTimezone(employeeId, companyId)
  const weekStart = getWeekStartTz(new Date(), timezone)

  const [weeklyHours, thresholds] = await Promise.all([
    getWeeklyHours(employeeId, weekStart, timezone),
    getThresholds(companyId),
  ])

  const alertLevel = determineAlertLevel(weeklyHours, thresholds)

  if (alertLevel) {
    await prisma.workHourAlert.upsert({
      where: {
        employeeId_weekStart_alertLevel: {
          employeeId,
          weekStart,
          alertLevel,
        },
      },
      create: {
        employeeId,
        weekStart,
        totalHours: weeklyHours,
        alertLevel,
        threshold:
          alertLevel === 'caution'
            ? thresholds.caution
            : alertLevel === 'warning'
              ? thresholds.warning
              : thresholds.blocked,
        isResolved: false,
      },
      update: {
        totalHours: weeklyHours,
        isResolved: false,   // 다시 초과하면 재활성화
        resolvedAt: null,
        resolvedBy: null,
        resolveNote: null,
      },
    })

    // Fire-and-forget notifications for 48h warning and 52h block
    if (alertLevel === 'warning') {
      void sendNotification({
        employeeId,
        triggerType: 'overtime_warning_48h',
        title: '주 48시간 초과 경고',
        body: '이번 주 근무시간이 48시간을 초과했습니다. 추가 초과근무에 주의하세요.',
        titleKey: 'notifications.overtimeWarning48h.title',
        bodyKey: 'notifications.overtimeWarning48h.body',
        link: `/my/attendance`,
        priority: 'high',
        metadata: { weeklyHours },
      })
    } else if (alertLevel === 'blocked') {
      void sendNotification({
        employeeId,
        triggerType: 'overtime_blocked_52h',
        title: '주 52시간 한도 도달',
        body: '법정 최대 근무시간(52시간)에 도달했습니다. 추가 근무가 제한됩니다.',
        titleKey: 'notifications.overtimeBlocked52h.title',
        bodyKey: 'notifications.overtimeBlocked52h.body',
        link: `/my/attendance`,
        priority: 'urgent',
        metadata: { weeklyHours },
      })
    }
  }

  return {
    alertLevel,
    weeklyHours,
    isBlocked: alertLevel === 'blocked',
  }
}

/**
 * 특정 직원의 이번 주 경고 목록 조회 (미해결)
 */
export async function getActiveAlerts(employeeId: string) {
  // 직원의 현재 소속 법인을 통해 타임존 해석
  const assignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId, isPrimary: true, endDate: null },
    select: { companyId: true },
  })
  const companyId = assignment?.companyId ?? ''
  const timezone = await resolveTimezone(employeeId, companyId)
  const weekStart = getWeekStartTz(new Date(), timezone)

  return prisma.workHourAlert.findMany({
    where: {
      employeeId,
      weekStart,
      isResolved: false,
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * 법인 전체 미해결 경고 목록 (HR Admin 대시보드용)
 */
export async function getCompanyAlerts(companyId: string, resolvedOnly = false) {
  // 법인 AttendanceSetting 타임존 사용 (개별 직원 타임존 아님)
  const setting = await prisma.attendanceSetting.findUnique({
    where: { companyId },
    select: { timezone: true },
  })
  const timezone = setting?.timezone ?? 'Asia/Seoul'
  const weekStart = getWeekStartTz(new Date(), timezone)

  const alerts = await prisma.workHourAlert.findMany({
    where: {
      isResolved: resolvedOnly ? true : false,
      weekStart,
      employee: {
        assignments: {
          some: { companyId, isPrimary: true, endDate: null },
        },
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    // NOTE: alertLevel is VARCHAR — alphabetical sort gives wrong severity order.
    // We sort in-memory by numeric severity instead (blocked > warning > caution).
    orderBy: { totalHours: 'desc' },  // secondary sort: most hours first
  })

  // ─── 심각도 기준 내림차순 정렬 ────────────────────────────
  // blocked(52h+) > warning(48h+) > caution(44h+)
  const SEVERITY: Record<string, number> = {
    blocked: 3,
    warning: 2,
    caution: 1,
  }

  return alerts.sort(
    (a, b) => (SEVERITY[b.alertLevel] ?? 0) - (SEVERITY[a.alertLevel] ?? 0)
  )
}
