'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Attendance Tab (B6-1)
// 직원 프로필 > 근태현황 탭
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Clock, AlertTriangle, CheckCircle2, MinusCircle, CalendarClock } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { ScheduleAdjustmentModal } from '@/components/attendance/ScheduleAdjustmentModal'

// ─── Types ───────────────────────────────────────────────

interface AttendanceRecord {
  id: string
  workDate: string
  clockIn: string | null
  clockOut: string | null
  status: string
  workType: string
  totalMinutes: number | null
  overtimeMinutes: number | null
}

interface WeeklySummary {
  weekStart: string
  weekEnd: string
  totalHours: number
  overtimeHours: number
  days: {
    date: string
    status: string
    totalMinutes: number
  }[]
}

interface AttendanceTabData {
  recentRecords: AttendanceRecord[]
  weeklyHours: number
  monthlyHours: number
  lateCount: number
  absentCount: number
  weekSummary?: WeeklySummary
}

// ─── Helpers ─────────────────────────────────────────────

function fmtTime(t: string | null): string {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
}

function fmtHours(minutes: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NORMAL: { label: 'attendanceStatusNormal', color: 'bg-emerald-500/15 text-emerald-700' },
  LATE: { label: 'attendanceStatusLate', color: 'bg-amber-500/15 text-amber-700' },
  EARLY_OUT: { label: 'attendanceStatusEarlyOut', color: 'bg-orange-500/10 text-orange-700' },
  ABSENT: { label: 'attendanceStatusAbsent', color: 'bg-destructive/10 text-destructive' },
  HOLIDAY: { label: 'attendanceStatusHoliday', color: 'bg-indigo-500/15 text-primary/90' },
}

// ─── Mini KPI ────────────────────────────────────────────

function MiniKpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${warn ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-card'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${warn ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────

interface Props {
  employeeId: string
}

export function AttendanceTab({ employeeId }: Props) {
  const t = useTranslations('employee')
  const [data, setData] = useState<AttendanceTabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch recent attendance records via existing API
      const res = await apiClient.get<{
        records: AttendanceRecord[]
        pagination: unknown
      }>(`/api/v1/attendance/employees/${employeeId}?limit=10`)

      const records = res.data?.records ?? []

      // Compute mini-stats client-side from recent records
      const weeklyHours = records
        .filter((r) => {
          const d = new Date(r.workDate)
          const now = new Date()
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          return d >= weekAgo
        })
        .reduce((s, r) => s + (r.totalMinutes ?? 0), 0) / 60

      const monthlyHours = records
        .filter((r) => {
          const d = new Date(r.workDate)
          const now = new Date()
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        .reduce((s, r) => s + (r.totalMinutes ?? 0), 0) / 60

      setData({
        recentRecords: records,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        monthlyHours: Math.round(monthlyHours * 10) / 10,
        lateCount: records.filter((r) => r.status === 'LATE').length,
        absentCount: records.filter((r) => r.status === 'ABSENT').length,
      })
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <Clock className="h-10 w-10 mb-3 text-border" />
          <p className="text-sm text-muted-foreground">{t('attendanceLoadError')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpi
          label={t('attendanceWeeklyWork')}
          value={`${data.weeklyHours}h`}
          sub={t('attendanceWeeklyLimit')}
          warn={data.weeklyHours >= 52}
        />
        <MiniKpi
          label={t('attendanceMonthlyWork')}
          value={`${data.monthlyHours}h`}
        />
        <MiniKpi
          label={t('attendanceLateCount')}
          value={`${data.lateCount}${t('attendanceCountSuffix')}`}
          warn={data.lateCount > 0}
        />
        <MiniKpi
          label={t('attendanceAbsentCount')}
          value={`${data.absentCount}${t('attendanceCountSuffix')}`}
          warn={data.absentCount > 0}
        />
      </div>

      {/* 52시간 경고 배너 (Actionable) */}
      {data.weeklyHours >= 44 && (
        <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
          data.weeklyHours >= 52
            ? 'border-red-400/30 bg-red-400/10'
            : 'border-amber-400/40 bg-amber-400/10'
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className={`h-4 w-4 shrink-0 ${
              data.weeklyHours >= 52 ? 'text-rose-600' : 'text-amber-700'
            }`} />
            <div>
              <p className={`text-sm font-semibold ${
                data.weeklyHours >= 52 ? 'text-rose-600' : 'text-amber-700'
              }`}>
                {data.weeklyHours >= 52
                  ? t('attendanceOver52h', { hours: data.weeklyHours })
                  : data.weeklyHours >= 48
                    ? t('attendanceOver48h', { hours: data.weeklyHours })
                    : t('attendanceOver44h', { hours: data.weeklyHours })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('attendanceAdjustSchedule')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAdjustModalOpen(true)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              data.weeklyHours >= 52
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-amber-700 text-white hover:bg-amber-800'
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {t('attendanceAdjustButton')}
          </button>
        </div>
      )}

      {/* Schedule Adjustment Modal */}
      <ScheduleAdjustmentModal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        weeklyHours={data.weeklyHours}
        employeeId={employeeId}
      />

      {/* 최근 근태 기록 테이블 */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">{t('attendanceRecentRecords')}</h3>
        </div>
        {data.recentRecords.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground">
            <MinusCircle className="h-8 w-8 mb-2 text-border" />
            <p className="text-sm">{t('attendanceNoRecords')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.recentRecords.map((rec) => {
              const statusCfg = STATUS_CONFIG[rec.status] ?? { label: rec.status, color: 'bg-background text-muted-foreground' }
              return (
                <div key={rec.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    {rec.status === 'NORMAL' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{fmtDate(rec.workDate)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtTime(rec.clockIn)} — {fmtTime(rec.clockOut)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {fmtHours(rec.totalMinutes)}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                      {t(statusCfg.label)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
