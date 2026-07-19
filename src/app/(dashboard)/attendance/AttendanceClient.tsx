'use client'


// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Client
// 내 근태: 출퇴근 기록, 주간 요약, 상태 배지
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, CalendarDays, CheckCircle2, Clock, FilePenLine, LogIn, LogOut } from 'lucide-react'
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
import { formatToTz } from '@/lib/timezone'
import {
  AttendanceCorrectionDrawer,
  type AttendanceCorrectionRecord,
} from './AttendanceCorrectionDrawer'

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
  id: string | null
  date: string
  status: string | null
  clockIn: string | null
  clockOut: string | null
  totalMinutes: number
  overtimeMinutes: number
  workType: string | null
  note: string | null
  correctionRequest: {
    id: string
    status: string
  } | null
}

interface MonthlyApiResponse {
  year: number
  month: number
  timezone: string
  days: MonthlyApiDay[]
  summary: {
    workedDays: number
    totalMinutes: number
    totalOvertimeMinutes: number
  }
}

interface MonthlyAttendanceRecord extends MonthlyApiDay {
  id: string
}

interface AttendanceClientProps {
  user: SessionUser
  companyTimezone: string
  initialYear: number
  initialMonth: number
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

function formatTime(isoStr: string | null, timeZone: string): string {
  if (!isoStr) return '--:--'
  return formatToTz(isoStr, timeZone, 'HH:mm')
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

function hasAttendanceRecord(day: MonthlyApiDay): day is MonthlyAttendanceRecord {
  return typeof day.id === 'string' && day.id.length > 0
}

// ─── Component ──────────────────────────────────────────────

export function AttendanceClient({
  user,
  companyTimezone,
  initialYear,
  initialMonth,
}: AttendanceClientProps) {
  void user

  const t = useTranslations('attendance')
  const tc = useTranslations('common')

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
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyAttendanceRecord[]>([])
  const [monthlyTimezone, setMonthlyTimezone] = useState(companyTimezone)
  const [monthlyError, setMonthlyError] = useState(false)
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceCorrectionRecord | null>(null)
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
      const res = await apiClient.get<MonthlyApiResponse>(
        `/api/v1/attendance/monthly/${initialYear}/${initialMonth}`,
      )
      setMonthlyError(false)
      setMonthlyTimezone(res.data.timezone)
      setMonthlyRecords((res.data?.days ?? []).filter(hasAttendanceRecord).reverse())
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
          ? {
              stats: aggregateMonthlyStats(res.data.days ?? [], summary),
              year: initialYear,
              month: initialMonth,
            }
          : null,
      )
    } catch {
      setMonthlyError(true)
      setMonthlyTimezone(companyTimezone)
      setMonthlyRecords([])
      setMonthlyCells([])
      setMonthlyStats(null)
      toast({ title: t('loadFailed'), variant: 'destructive' })
    }
  }, [companyTimezone, initialMonth, initialYear, t])

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

  const closeCorrectionDrawer = useCallback(() => {
    setCorrectionRecord(null)
  }, [])

  const correctionStatusLabels: Record<string, string> = {
    pending: t('statusPending'),
    approved: t('statusApproved'),
    rejected: t('statusRejected'),
    cancelled: t('statusCancelled'),
  }

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
                {t('clockIn')}: {formatTime(today?.clockIn ?? null, companyTimezone)}
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
                  {t('clockIn')}: {formatTime(today?.clockIn ?? null, companyTimezone)}
                </span>
                <span>
                  {t('clockOut')}: {formatTime(today?.clockOut ?? null, companyTimezone)}
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

      {/* ─── Section 2c: 월간 실제 근태 기록 및 보정 신청 ─── */}
      <section
        aria-labelledby="monthly-attendance-records-title"
        className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="monthly-attendance-records-title"
              className="flex items-center gap-2 text-base font-semibold text-foreground"
            >
              <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
              {t('dailyRecord')}
            </h2>
            {monthlyTimezone ? (
              <p className="mt-1 text-xs text-muted-foreground">{monthlyTimezone}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" asChild className="min-h-11 md:min-h-8">
            <Link href="/approvals/attendance?view=mine&requestType=attendance_correction">
              {tc('history')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {monthlyError ? (
          <EmptyState
            icon={CalendarDays}
            title={t('loadFailed')}
            sub={tc('retryDesc')}
            size="sm"
            action={{ label: tc('retry'), onClick: () => { void fetchMonthly() } }}
          />
        ) : monthlyRecords.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t('emptyTitle')}
            sub={t('emptyDesc')}
            size="sm"
          />
        ) : (
          <ul className="divide-y divide-border" aria-label={t('dailyRecord')}>
            {monthlyRecords.map((record) => {
              const correctionStatus = record.correctionRequest?.status.toLowerCase()
              const isPending = correctionStatus === 'pending'

              return (
                <li key={record.id} className="py-4 first:pt-0 last:pb-0">
                  <article className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {record.date}
                        </p>
                        {record.status ? (
                          <StatusBadge
                            status={record.status}
                            variant={ATTENDANCE_VARIANT_OVERRIDES[record.status]}
                          >
                            {STATUS_LABELS[record.status] ?? record.status}
                          </StatusBadge>
                        ) : null}
                        {correctionStatus ? (
                          <StatusBadge status={correctionStatus.toUpperCase()}>
                            {correctionStatusLabels[correctionStatus] ?? record.correctionRequest?.status}
                          </StatusBadge>
                        ) : null}
                      </div>

                      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        <div className="flex items-center gap-1.5">
                          <dt className="text-muted-foreground">{t('clockIn')}</dt>
                          <dd className="font-medium text-foreground tabular-nums">
                            {record.clockIn && monthlyTimezone
                              ? formatToTz(record.clockIn, monthlyTimezone, 'HH:mm')
                              : '--:--'}
                          </dd>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <dt className="text-muted-foreground">{t('clockOut')}</dt>
                          <dd className="font-medium text-foreground tabular-nums">
                            {record.clockOut && monthlyTimezone
                              ? formatToTz(record.clockOut, monthlyTimezone, 'HH:mm')
                              : '--:--'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {isPending ? (
                        <Button variant="outline" size="sm" asChild className="min-h-11 md:min-h-8">
                          <Link href="/approvals/attendance?view=mine&requestType=attendance_correction">
                            {t('myRequests')}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 md:min-h-8"
                          disabled={!monthlyTimezone}
                          onClick={() => {
                            setCorrectionRecord({
                              id: record.id,
                              date: record.date,
                              clockIn: record.clockIn,
                              clockOut: record.clockOut,
                            })
                          }}
                        >
                          <FilePenLine className="h-4 w-4" aria-hidden="true" />
                          {t('requestCorrection')}
                        </Button>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </section>

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

      <AttendanceCorrectionDrawer
        open={Boolean(correctionRecord)}
        record={correctionRecord}
        timezone={monthlyTimezone}
        onClose={closeCorrectionDrawer}
        onSubmitted={fetchMonthly}
      />
    </div>
  )
}
