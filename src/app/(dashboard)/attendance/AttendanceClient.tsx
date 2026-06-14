'use client'


// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Client
// 내 근태: 출퇴근 기록, 주간 요약, 상태 배지
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { CheckCircle2, Clock, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  WdStatusHeatGrid,
  type AttStatusKey,
  type WdHeatCell,
} from '@/components/shared/WdStatusHeatGrid'
import {
  WdMonthlyStatCard,
  type WdMonthlyStatInput,
} from '@/components/shared/WdMonthlyStatCard'
import { aggregateMonthlyStats } from '@/lib/attendance/monthly-aggregate'

// ─── Types ──────────────────────────────────────────────────

interface AttendanceRecord {
  id: string
  employeeId: string
  workDate: string
  clockIn: string | null
  clockOut: string | null
  clockInMethod: string | null
  clockOutMethod: string | null
  workType: string
  totalMinutes: number | null
  overtimeMinutes: number | null
  status: string
  note: string | null
}

interface WeeklyDay {
  date: string
  dayOfWeek: number
  totalMinutes: number | null
  overtimeMinutes: number | null
  status: string | null
}

interface WeeklySummary {
  weekStart: string
  weekEnd: string
  days: WeeklyDay[]
  totalMinutes: number
  totalOvertimeMinutes: number
}

type ClockState = 'NOT_CLOCKED_IN' | 'WORKING' | 'COMPLETED'

interface MonthlyApiDay {
  date: string
  status: string | null
  overtimeMinutes: number
}

// AT-005 — monthly 라우트 전체 응답 (AT-004 MonthlyApiDay 불변, clockIn/Out·summary 가산)
interface MonthlyApiResponse {
  days: (MonthlyApiDay & { clockIn: string | null; clockOut: string | null })[]
  summary: { workedDays: number; totalOvertimeMinutes: number }
}

// ─── Constants ──────────────────────────────────────────────

// 근태 status enum → AttStatusKey (AT-004 히트 그리드).
// 우선순위 (F2 가디언 m0008): ABSENT > ON_LEAVE > LATE/EARLY_OUT >
//   overtimeMinutes>0 > NORMAL > off.
// - overtime 우선 매핑 제거 (LATE+overtime>0 → 'late' 지각 누락 방지)
// - EARLY_OUT → 'late' (프로토 5상태 외, 타이밍 이상 동류)
// - HOLIDAY/null → 'off' (프로토 6번째 neutral track, 주말·공휴일)
const ATT_STATUS_FROM_RECORD = (
  status: string | null,
  overtimeMinutes: number,
): AttStatusKey => {
  if (status === 'ABSENT') return 'absent'
  if (status === 'ON_LEAVE') return 'leave'
  if (status === 'LATE' || status === 'EARLY_OUT') return 'late'
  if ((overtimeMinutes ?? 0) > 0) return 'overtime'
  if (status === 'NORMAL') return 'present'
  return 'off' // HOLIDAY / null = 주말·공휴일 neutral track
}

const ATTENDANCE_VARIANT_OVERRIDES: Record<string, 'info'> = {
  ON_LEAVE: 'info',
}

const WORK_TYPE_VARIANT: Record<string, 'info' | 'accent' | 'neutral'> = {
  NORMAL: 'neutral',
  OVERTIME: 'info',
  NIGHT: 'accent',
  HOLIDAY: 'accent',
}

const STANDARD_WORK_HOURS = 8
const MAX_BAR_HOURS = 12

// ─── Helpers ────────────────────────────────────────────────

function formatMinutesToHM(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '0h 0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

function formatTime(isoStr: string | null, locale: string = 'ko'): string {
  if (!isoStr) return '--:--'
  const d = new Date(isoStr)
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d)
}

function getElapsedSeconds(clockIn: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(clockIn).getTime()) / 1000))
}

function formatElapsedTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getClockState(record: AttendanceRecord | null): ClockState {
  if (!record || !record.clockIn) return 'NOT_CLOCKED_IN'
  if (record.clockIn && !record.clockOut) return 'WORKING'
  return 'COMPLETED'
}

// ─── Component ──────────────────────────────────────────────

export function AttendanceClient({ user }: { user: SessionUser }) {
  void user

  const t = useTranslations('attendance')
  const tc = useTranslations('common')
  const locale = useLocale()

  const DAY_LABELS = [
    t('dayMon'), t('dayTue'), t('dayWed'), t('dayThu'),
    t('dayFri'), t('daySat'), t('daySun'),
  ]

  const STATUS_LABELS: Record<string, string> = {
    NORMAL: t('normal'),
    LATE: t('late'),
    EARLY_OUT: t('earlyOut'),
    ABSENT: t('absent'),
    ON_LEAVE: t('onLeave'),
    HOLIDAY: t('holiday'),
  }

  const WORK_TYPE_LABELS: Record<string, string> = {
    NORMAL: t('normal'),
    OVERTIME: t('overtime'),
    NIGHT: t('night'),
    HOLIDAY: t('holiday'),
  }

  const [today, setToday] = useState<AttendanceRecord | null>(null)
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null)
  const [monthlyCells, setMonthlyCells] = useState<WdHeatCell[]>([])
  const [monthlyStats, setMonthlyStats] = useState<
    { stats: WdMonthlyStatInput; year: number; month: number } | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [clockLoading, setClockLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Fetch data ───
  const fetchToday = useCallback(async () => {
    try {
      const res = await apiClient.get<AttendanceRecord | null>('/api/v1/attendance/today')
      setToday(res.data)
    } catch {
      setToday(null)
    }
  }, [])

  const fetchWeekly = useCallback(async () => {
    try {
      const res = await apiClient.get<WeeklySummary>('/api/v1/attendance/weekly-summary')
      setWeekly(res.data)
    } catch {
      setWeekly(null)
    }
  }, [])

  // AT-004 — 최근 월 근태 히트 그리드 (기존 monthly 라우트, 백엔드 0 변경)
  const fetchMonthly = useCallback(async () => {
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const res = await apiClient.get<MonthlyApiResponse>(
        `/api/v1/attendance/monthly/${year}/${month}`,
      )
      setMonthlyCells(
        (res.data?.days ?? []).map((d) => ({
          date: d.date,
          status: ATT_STATUS_FROM_RECORD(d.status, d.overtimeMinutes),
        })),
      )
      // AT-005 — 월간 통계 카나리 (동일 monthly 라우트 재사용, 클라이언트 집계 helper)
      const summary = res.data?.summary
      setMonthlyStats(
        summary
          ? { stats: aggregateMonthlyStats(res.data.days ?? [], summary), year, month }
          : null,
      )
    } catch {
      setMonthlyCells([])
      setMonthlyStats(null)
    }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchToday(), fetchWeekly(), fetchMonthly()])
    setLoading(false)
  }, [fetchToday, fetchWeekly, fetchMonthly])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  // ─── Timer for working state ───
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    const state = getClockState(today)
    if (state === 'WORKING' && today?.clockIn) {
      setElapsed(getElapsedSeconds(today.clockIn))
      timerRef.current = setInterval(() => {
        setElapsed(getElapsedSeconds(today.clockIn!))
      }, 1000)
    } else {
      setElapsed(0)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [today])

  // ─── Clock actions (optimistic UI) ───
  const handleClockIn = useCallback(async () => {
    setClockLoading(true)
    const now = new Date().toISOString()
    const prevToday = today
    // 낙관적 업데이트: 즉시 WORKING 상태로 전환
    setToday(prev => prev
      ? { ...prev, clockIn: now, clockInMethod: 'WEB', status: 'NORMAL' }
      : { id: 'optimistic', employeeId: '', workDate: now.slice(0, 10), clockIn: now, clockOut: null, clockInMethod: 'WEB', clockOutMethod: null, workType: 'NORMAL', totalMinutes: null, overtimeMinutes: null, status: 'NORMAL', note: null }
    )
    try {
      await apiClient.post('/api/v1/attendance/clock-in', { method: 'WEB' })
      // 서버 데이터로 동기화 — 월간 히트그리드/통계도 함께 (att-12)
      await Promise.all([fetchToday(), fetchMonthly()])
    } catch (err) {
      setToday(prevToday) // 롤백
      toast({
        title: '출근 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setClockLoading(false)
    }
  }, [fetchToday, fetchMonthly, today])

  const handleClockOut = useCallback(async () => {
    setClockLoading(true)
    const now = new Date().toISOString()
    const prevToday = today
    const prevWeekly = weekly
    // 낙관적 업데이트: 즉시 COMPLETED 상태로 전환
    setToday(prev => prev ? { ...prev, clockOut: now, clockOutMethod: 'WEB' } : prev)
    try {
      await apiClient.post('/api/v1/attendance/clock-out', { method: 'WEB' })
      // 월간 히트그리드/통계도 함께 갱신 (att-12)
      await Promise.all([fetchToday(), fetchWeekly(), fetchMonthly()])
    } catch (err) {
      setToday(prevToday) // 롤백
      setWeekly(prevWeekly)
      toast({
        title: '퇴근 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setClockLoading(false)
    }
  }, [fetchToday, fetchWeekly, fetchMonthly, today, weekly])

  // ─── Derived state ───
  const clockState = getClockState(today)

  // ─── Loading skeleton ───
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('myAttendance')}
        description={t('todaySummary')}
      />

      {/* ─── Section 1: Today Card ─── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="flex items-center gap-2 text-base font-bold text-foreground tracking-[-0.02em] mb-4">
          <Clock className="h-5 w-5 text-primary" />
          {t('todaySummary')}
        </h3>

          {clockState === 'NOT_CLOCKED_IN' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-center">
                <p className="text-lg font-medium text-muted-foreground">
                  {t('notClockedIn')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('clockInPrompt')}
                </p>
              </div>
              <Button
                size="lg"
                className="h-16 w-48 bg-warm hover:brightness-95 text-lg font-semibold text-white"
                onClick={handleClockIn}
                disabled={clockLoading}
              >
                <LogIn className="mr-2 h-5 w-5" />
                {clockLoading ? tc('loading') : t('clockIn')}
              </Button>
            </div>
          )}

          {clockState === 'WORKING' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-primary/10 text-tertiary">
                {t('currentlyWorking')}
              </span>
              <p className="font-mono text-4xl font-bold text-primary tabular-nums">
                {formatElapsedTime(elapsed)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('clockIn')}: {formatTime(today?.clockIn ?? null, locale)}
              </p>
              <Button
                size="lg"
                className="h-14 w-48 text-lg font-semibold bg-destructive hover:brightness-95 text-white"
                onClick={handleClockOut}
                disabled={clockLoading}
              >
                <LogOut className="mr-2 h-5 w-5" />
                {clockLoading ? tc('loading') : t('clockOut')}
              </Button>
            </div>
          )}

          {clockState === 'COMPLETED' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-lg font-semibold">{t('workCompleted')}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatMinutesToHM(today?.totalMinutes)}
              </p>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span>
                  {t('clockIn')}: {formatTime(today?.clockIn ?? null, locale)}
                </span>
                <span>
                  {t('clockOut')}: {formatTime(today?.clockOut ?? null, locale)}
                </span>
              </div>
              {(today?.overtimeMinutes ?? 0) > 0 && (
                <p className="text-sm text-wd-orange-ink font-semibold">
                  {t('overtimeHours')}: {formatMinutesToHM(today?.overtimeMinutes)}
                </p>
              )}
            </div>
          )}
      </div>

      {/* ─── Section 2: Weekly Summary ─── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-base font-bold text-foreground tracking-[-0.02em] mb-4">{t('weeklySummary')}</h3>
          {weekly ? (
            <div className="space-y-3">
              {/* Day bars */}
              {weekly.days.map((day, idx) => {
                const hours = (day.totalMinutes ?? 0) / 60
                const barWidthPct = Math.min((hours / MAX_BAR_HOURS) * 100, 100)
                const standardLinePct = (STANDARD_WORK_HOURS / MAX_BAR_HOURS) * 100

                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-center text-sm font-medium text-muted-foreground">
                      {DAY_LABELS[idx]}
                    </span>
                    <div className="relative h-6 flex-1 rounded bg-muted">
                      {/* Standard line at 8h */}
                      <div
                        className="absolute top-0 h-full border-l-2 border-dashed border-border"
                        style={{ left: `${standardLinePct}%` }}
                      />
                      {/* Work bar */}
                      {hours > 0 && (
                        <div
                          className="h-full rounded bg-primary transition-all duration-300"
                          style={{ width: `${barWidthPct}%` }}
                        />
                      )}
                    </div>
                    <span className="w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                      {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                    </span>
                  </div>
                )
              })}

              {/* Totals row */}
              <div className="mt-4 flex justify-between border-t border-border pt-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('workHours')}: </span>
                  <span className="font-semibold text-foreground">
                    {formatMinutesToHM(weekly.totalMinutes)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{t('overtimeHours')}: </span>
                  <span className="font-semibold text-wd-orange-ink">
                    {formatMinutesToHM(weekly.totalOvertimeMinutes)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {tc('noData')}
            </p>
          )}
      </div>

      {/* ─── Section 2a: 월간 통계 (PR-4 AT-005 카나리 — WdGroupedStatCard SSOT) ─── */}
      <WdMonthlyStatCard
        data={monthlyStats?.stats ?? null}
        year={monthlyStats?.year}
        month={monthlyStats?.month}
        loading={loading}
      />

      {/* ─── Section 2b: 최근 월 근태 히트 그리드 (PR-2 AT-004 카나리 — status.ts SSOT) ─── */}
      <WdStatusHeatGrid
        title={t('monthlyRecord')}
        cells={monthlyCells}
        emptyState={<EmptyState />}
      />

      {/* ─── Section 3: Status Badges ─── */}
      {today && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Attendance status badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('status')}:</span>
              <StatusBadge status={today.status} variant={ATTENDANCE_VARIANT_OVERRIDES[today.status]}>
                {STATUS_LABELS[today.status] ?? today.status}
              </StatusBadge>
            </div>

            {/* Work type badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('workType')}:</span>
              <Badge variant={WORK_TYPE_VARIANT[today.workType] ?? 'neutral'}>
                {WORK_TYPE_LABELS[today.workType] ?? today.workType}
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
