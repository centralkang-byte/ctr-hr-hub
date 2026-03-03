// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 52시간 경고 체커 (B6-1)
// 주간 누적 근무시간 체크 + WorkHourAlert upsert
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifications'

// ─── Types ───────────────────────────────────────────────

export type AlertLevel = 'caution' | 'warning' | 'blocked'

interface AlertThresholds {
  caution: number
  warning: number
  blocked: number
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  caution: 44,
  warning: 48,
  blocked: 52,
}

// ─── 주 시작(월요일 00:00 KST) 계산 ──────────────────────────

function getWeekStart(date: Date = new Date()): Date {
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(date.getTime() + kstOffset)
  const dayOfWeek = kstNow.getUTCDay() // 0=Sun, 1=Mon … 6=Sat
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const mondayKst = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - daysFromMonday),
  )
  // KST Monday 00:00 → UTC
  return new Date(mondayKst.getTime() - kstOffset)
}

// ─── 이번 주 총 근무 시간(시간) 계산 ─────────────────────────

async function getWeeklyHours(employeeId: string, weekStart: Date): Promise<number> {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  const records = await prisma.attendance.findMany({
    where: {
      employeeId,
      workDate: { gte: weekStart, lt: weekEnd },
      clockOut: { not: null },
    },
    select: { totalMinutes: true },
  })

  const totalMinutes = records.reduce((sum, r) => sum + (r.totalMinutes ?? 0), 0)
  return totalMinutes / 60
}

// ─── 법인 임계값 조회 ─────────────────────────────────────────

async function getThresholds(companyId: string): Promise<AlertThresholds> {
  const setting = await prisma.attendanceSetting.findUnique({
    where: { companyId },
    select: { alertThresholds: true },
  })

  if (!setting?.alertThresholds) return DEFAULT_THRESHOLDS

  const raw = setting.alertThresholds as Record<string, number>
  return {
    caution: raw.caution ?? DEFAULT_THRESHOLDS.caution,
    warning: raw.warning ?? DEFAULT_THRESHOLDS.warning,
    blocked: raw.blocked ?? DEFAULT_THRESHOLDS.blocked,
  }
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
  const weekStart = getWeekStart()
  const [weeklyHours, thresholds] = await Promise.all([
    getWeeklyHours(employeeId, weekStart),
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
  const weekStart = getWeekStart()
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
  const weekStart = getWeekStart()
  return prisma.workHourAlert.findMany({
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
    orderBy: [{ alertLevel: 'desc' }, { totalHours: 'desc' }],
  })
}
