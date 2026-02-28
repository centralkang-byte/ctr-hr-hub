'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Client
// 내 근태: 출퇴근 기록, 주간 요약, 상태 배지
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, LogIn, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import { ko } from '@/lib/i18n/ko'
import type { SessionUser } from '@/types'

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

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

const STATUS_COLORS: Record<string, string> = {
  NORMAL: 'bg-ctr-success text-white',
  LATE: 'bg-ctr-warning text-white',
  EARLY_OUT: 'bg-orange-500 text-white',
  ABSENT: 'bg-ctr-accent text-white',
  ON_LEAVE: 'bg-purple-500 text-white',
  HOLIDAY: 'bg-blue-400 text-white',
}

const STATUS_LABELS: Record<string, string> = {
  NORMAL: ko.attendance.normal,
  LATE: ko.attendance.late,
  EARLY_OUT: ko.attendance.earlyOut,
  ABSENT: ko.attendance.absent,
  ON_LEAVE: ko.attendance.onLeave,
  HOLIDAY: ko.attendance.holiday,
}

const WORK_TYPE_LABELS: Record<string, string> = {
  NORMAL: ko.attendance.regular,
  REMOTE: ko.attendance.remote,
  FIELD: ko.attendance.field,
  BUSINESS_TRIP: ko.attendance.businessTrip,
}

const WORK_TYPE_COLORS: Record<string, string> = {
  NORMAL: 'bg-gray-100 text-gray-700',
  REMOTE: 'bg-blue-100 text-blue-700',
  FIELD: 'bg-green-100 text-green-700',
  BUSINESS_TRIP: 'bg-purple-100 text-purple-700',
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
        title={ko.attendance.myAttendance}
        description={ko.attendance.todaySummary}
      />

      {/* ─── Section 1: Today Card ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-ctr-primary" />
            {ko.attendance.todaySummary}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clockState === 'NOT_CLOCKED_IN' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-center">
                <p className="text-lg font-medium text-muted-foreground">
                  {ko.attendance.notClockedIn}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  출근 버튼을 눌러 근무를 시작하세요
                </p>
              </div>
              <Button
                size="lg"
                className="h-16 w-48 bg-ctr-primary text-lg font-semibold hover:bg-ctr-primary/90"
                onClick={handleClockIn}
                disabled={clockLoading}
              >
                <LogIn className="mr-2 h-5 w-5" />
                {clockLoading ? ko.common.loading : ko.attendance.clockIn}
              </Button>
            </div>
          )}

          {clockState === 'WORKING' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Badge className="bg-ctr-success text-white px-3 py-1 text-sm">
                {ko.attendance.currentlyWorking}
              </Badge>
              <p className="font-mono text-4xl font-bold text-ctr-primary tabular-nums">
                {formatElapsedTime(elapsed)}
              </p>
              <p className="text-sm text-muted-foreground">
                {ko.attendance.clockIn}: {formatTime(today?.clockIn ?? null)}
              </p>
              <Button
                size="lg"
                variant="destructive"
                className="h-14 w-48 text-lg font-semibold"
                onClick={handleClockOut}
                disabled={clockLoading}
              >
                <LogOut className="mr-2 h-5 w-5" />
                {clockLoading ? ko.common.loading : ko.attendance.clockOut}
              </Button>
            </div>
          )}

          {clockState === 'COMPLETED' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex items-center gap-2 text-ctr-success">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-lg font-semibold">근무 완료</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatMinutesToHM(today?.totalMinutes)}
              </p>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span>
                  {ko.attendance.clockIn}: {formatTime(today?.clockIn ?? null)}
                </span>
                <span>
                  {ko.attendance.clockOut}: {formatTime(today?.clockOut ?? null)}
                </span>
              </div>
              {(today?.overtimeMinutes ?? 0) > 0 && (
                <p className="text-sm text-ctr-warning">
                  {ko.attendance.overtimeHours}: {formatMinutesToHM(today?.overtimeMinutes)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Section 2: Weekly Summary ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{ko.attendance.weeklySummary}</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <div className="relative h-6 flex-1 rounded bg-gray-100">
                      {/* Standard line at 8h */}
                      <div
                        className="absolute top-0 h-full border-l-2 border-dashed border-gray-300"
                        style={{ left: `${standardLinePct}%` }}
                      />
                      {/* Work bar */}
                      {hours > 0 && (
                        <div
                          className="h-full rounded bg-ctr-primary transition-all duration-300"
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
              <div className="mt-4 flex justify-between border-t pt-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">{ko.attendance.workHours}: </span>
                  <span className="font-semibold">
                    {formatMinutesToHM(weekly.totalMinutes)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{ko.attendance.overtimeHours}: </span>
                  <span className="font-semibold text-ctr-warning">
                    {formatMinutesToHM(weekly.totalOvertimeMinutes)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {ko.common.noData}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Section 3: Status Badges ─── */}
      {today && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            {/* Attendance status badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{ko.attendance.status}:</span>
              <Badge className={STATUS_COLORS[today.status] ?? 'bg-gray-200 text-gray-700'}>
                {STATUS_LABELS[today.status] ?? today.status}
              </Badge>
            </div>

            {/* Work type badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{ko.attendance.workType}:</span>
              <Badge className={WORK_TYPE_COLORS[today.workType] ?? 'bg-gray-100 text-gray-700'}>
                {WORK_TYPE_LABELS[today.workType] ?? today.workType}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
