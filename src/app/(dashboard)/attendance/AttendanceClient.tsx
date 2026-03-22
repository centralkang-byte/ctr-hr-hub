'use client'

import { TableSkeleton } from '@/components/ui/LoadingSkeleton'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Client
// 내 근태: 출퇴근 기록, 주간 요약, 상태 배지
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Clock, LogIn, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'
import { STATUS_VARIANT } from '@/lib/styles/status'

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

// ─── Constants ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  NORMAL: STATUS_VARIANT.success,
  LATE: STATUS_VARIANT.error,
  EARLY_OUT: STATUS_VARIANT.warning,
  ABSENT: STATUS_VARIANT.error,
  ON_LEAVE: STATUS_VARIANT.info,
  HOLIDAY: STATUS_VARIANT.primary,
}

const WORK_TYPE_COLORS: Record<string, string> = {
  NORMAL: STATUS_VARIANT.neutral,
  REMOTE: STATUS_VARIANT.info,
  FIELD: STATUS_VARIANT.success,
  BUSINESS_TRIP: STATUS_VARIANT.primary,
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

function formatTime(isoStr: string | null): string {
  if (!isoStr) return '--:--'
  const d = new Date(isoStr)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
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
    NORMAL: t('regular'),
    REMOTE: t('remote'),
    FIELD: t('field'),
    BUSINESS_TRIP: t('businessTrip'),
  }

  const [today, setToday] = useState<AttendanceRecord | null>(null)
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null)
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

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchToday(), fetchWeekly()])
    setLoading(false)
  }, [fetchToday, fetchWeekly])

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

  // ─── Clock actions ───
  const handleClockIn = useCallback(async () => {
    setClockLoading(true)
    try {
      await apiClient.post('/api/v1/attendance/clock-in', { method: 'WEB' })
      await fetchToday()
    } catch {
      // Error handled by apiClient
    } finally {
      setClockLoading(false)
    }
  }, [fetchToday])

  const handleClockOut = useCallback(async () => {
    setClockLoading(true)
    try {
      await apiClient.post('/api/v1/attendance/clock-out', { method: 'WEB' })
      await Promise.all([fetchToday(), fetchWeekly()])
    } catch {
      // Error handled by apiClient
    } finally {
      setClockLoading(false)
    }
  }, [fetchToday, fetchWeekly])

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
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
        <h3 className="flex items-center gap-2 text-base font-bold text-[#1A1A1A] tracking-[-0.02em] mb-4">
          <Clock className="h-5 w-5 text-[#5E81F4]" />
          {t('todaySummary')}
        </h3>

          {clockState === 'NOT_CLOCKED_IN' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-center">
                <p className="text-lg font-medium text-[#666]">
                  {t('notClockedIn')}
                </p>
                <p className="mt-1 text-sm text-[#999]">
                  {t('clockInPrompt')}
                </p>
              </div>
              <Button
                size="lg"
                className="h-16 w-48 bg-[#5E81F4] hover:bg-[#4B6DE0] text-lg font-semibold text-white"
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
              <span className="inline-flex items-center px-3 py-1 rounded-[4px] text-sm font-semibold bg-[#EDF1FE] text-[#2E7D32]">
                {t('currentlyWorking')}
              </span>
              <p className="font-mono text-4xl font-bold text-[#5E81F4] tabular-nums">
                {formatElapsedTime(elapsed)}
              </p>
              <p className="text-sm text-[#999]">
                {t('clockIn')}: {formatTime(today?.clockIn ?? null)}
              </p>
              <Button
                size="lg"
                className="h-14 w-48 text-lg font-semibold bg-[#F44336] hover:bg-[#D32F2F] text-white"
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
              <div className="flex items-center gap-2 text-[#5E81F4]">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-lg font-semibold">{t('workCompleted')}</span>
              </div>
              <p className="text-2xl font-bold text-[#1A1A1A]">
                {formatMinutesToHM(today?.totalMinutes)}
              </p>
              <div className="flex gap-6 text-sm text-[#999]">
                <span>
                  {t('clockIn')}: {formatTime(today?.clockIn ?? null)}
                </span>
                <span>
                  {t('clockOut')}: {formatTime(today?.clockOut ?? null)}
                </span>
              </div>
              {(today?.overtimeMinutes ?? 0) > 0 && (
                <p className="text-sm text-[#FF9800] font-semibold">
                  {t('overtimeHours')}: {formatMinutesToHM(today?.overtimeMinutes)}
                </p>
              )}
            </div>
          )}
      </div>

      {/* ─── Section 2: Weekly Summary ─── */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
        <h3 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em] mb-4">{t('weeklySummary')}</h3>
          {weekly ? (
            <div className="space-y-3">
              {/* Day bars */}
              {weekly.days.map((day, idx) => {
                const hours = (day.totalMinutes ?? 0) / 60
                const barWidthPct = Math.min((hours / MAX_BAR_HOURS) * 100, 100)
                const standardLinePct = (STANDARD_WORK_HOURS / MAX_BAR_HOURS) * 100

                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-center text-sm font-medium text-[#999]">
                      {DAY_LABELS[idx]}
                    </span>
                    <div className="relative h-6 flex-1 rounded bg-[#F5F5F5]">
                      {/* Standard line at 8h */}
                      <div
                        className="absolute top-0 h-full border-l-2 border-dashed border-[#E0E0E0]"
                        style={{ left: `${standardLinePct}%` }}
                      />
                      {/* Work bar */}
                      {hours > 0 && (
                        <div
                          className="h-full rounded bg-[#5E81F4] transition-all duration-300"
                          style={{ width: `${barWidthPct}%` }}
                        />
                      )}
                    </div>
                    <span className="w-14 shrink-0 text-right text-sm tabular-nums text-[#999]">
                      {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                    </span>
                  </div>
                )
              })}

              {/* Totals row */}
              <div className="mt-4 flex justify-between border-t border-[#F0F0F0] pt-3">
                <div className="text-sm">
                  <span className="text-[#999]">{t('workHours')}: </span>
                  <span className="font-semibold text-[#1A1A1A]">
                    {formatMinutesToHM(weekly.totalMinutes)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-[#999]">{t('overtimeHours')}: </span>
                  <span className="font-semibold text-[#FF9800]">
                    {formatMinutesToHM(weekly.totalOvertimeMinutes)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-[#999]">
              {tc('noData')}
            </p>
          )}
      </div>

      {/* ─── Section 3: Status Badges ─── */}
      {today && (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Attendance status badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#999]">{t('status')}:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${STATUS_COLORS[today.status] ?? STATUS_VARIANT.neutral}`}>
                {STATUS_LABELS[today.status] ?? today.status}
              </span>
            </div>

            {/* Work type badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#999]">{t('workType')}:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${WORK_TYPE_COLORS[today.workType] ?? STATUS_VARIANT.neutral}`}>
                {WORK_TYPE_LABELS[today.workType] ?? today.workType}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
