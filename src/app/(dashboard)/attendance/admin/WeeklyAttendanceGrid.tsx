'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Weekly Attendance Grid (직원 × 7일 매트릭스)
// GET /api/v1/attendance/admin/weekly 소비. 셀 = 근태 + 승인휴가 오버레이.
// 데이터는 전부 서버 응답 — 클라 날조 없음 (빈 응답 = 빈 상태).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { ChevronLeft, ChevronRight, CalendarOff } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface WeeklyCell {
  date: string
  attendance: {
    clockIn: string | null
    clockOut: string | null
    totalMinutes: number
    overtimeMinutes: number
    status: string
    workType: string
  } | null
  leave: { leaveType: string; halfDayType: string | null } | null
}

interface WeeklyRow {
  employeeId: string
  name: string
  employeeNo: string
  department: string | null
  cells: WeeklyCell[]
}

interface WeeklyData {
  weekStart: string
  days: string[]
  rows: WeeklyRow[]
  nextCursor: string | null
}

// ─── Helpers (UTC 날짜연산 — tz drift 회피) ──────────────────

function addDaysUTC(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

function isWeekend(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow === 0 || dow === 6
}

function fmtHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`
}

// ─── Component ──────────────────────────────────────────────

export function WeeklyAttendanceGrid() {
  const t = useTranslations('attendance')
  const locale = useLocale()

  const [data, setData] = useState<WeeklyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // start=null → 서버가 현재 주 월요일로 기본 설정
  const fetchWeek = useCallback(async (start: string | null) => {
    setLoading(true)
    try {
      const res = await apiClient.get<WeeklyData>(
        '/api/v1/attendance/admin/weekly',
        start ? { start } : undefined,
      )
      setData(res.data)
    } catch (err) {
      toast({
        title: t('loadFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchWeek(null)
  }, [fetchWeek])

  const loadMore = useCallback(async () => {
    if (!data?.nextCursor) return
    setLoadingMore(true)
    try {
      const res = await apiClient.get<WeeklyData>('/api/v1/attendance/admin/weekly', {
        start: data.weekStart,
        cursor: data.nextCursor,
      })
      const more = res.data
      if (more) {
        setData((prev) =>
          prev ? { ...more, rows: [...prev.rows, ...more.rows] } : more,
        )
      }
    } catch (err) {
      toast({
        title: t('loadFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoadingMore(false)
    }
  }, [data, t])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data) {
    return <EmptyState icon={CalendarOff} title={t('loadFailed')} />
  }

  const { weekStart, days, rows } = data
  const weekEnd = days[days.length - 1]
  const todayStr = new Date().toISOString().slice(0, 10)

  // 페이지 기준 outlier 집계 (전체 모집단 아님 — 라벨 명시)
  let lateN = 0
  let absentN = 0
  let overtimeN = 0
  for (const row of rows) {
    for (const c of row.cells) {
      if (c.attendance?.status === 'LATE') lateN++
      if (c.attendance?.status === 'ABSENT') absentN++
      if ((c.attendance?.overtimeMinutes ?? 0) > 0) overtimeN++
    }
  }

  const dayName = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number)
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(Date.UTC(y, m - 1, dd)))
  }
  const dayNum = (d: string) => Number(d.split('-')[2])

  return (
    <div className="space-y-4">
      {/* ─── Week toolbar ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void fetchWeek(addDaysUTC(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" /> {t('weekly.prevWeek')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void fetchWeek(null)}>
          {t('weekly.thisWeek')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void fetchWeek(addDaysUTC(weekStart, 7))}>
          {t('weekly.nextWeek')} <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-1 text-sm font-semibold text-foreground tabular-nums">
          {weekStart} ~ {weekEnd}
        </span>
      </div>

      {/* ─── Outlier cards (현재 페이지 기준) ─── */}
      <div className="grid grid-cols-3 gap-3">
        <OutlierCard label={`${t('weekly.thisWeek')} ${t('late')}`} value={lateN} tone="warning" note={t('weekly.pageScopedNote')} />
        <OutlierCard label={`${t('weekly.thisWeek')} ${t('absent')}`} value={absentN} tone="danger" note={t('weekly.pageScopedNote')} />
        <OutlierCard label={`${t('weekly.thisWeek')} ${t('overtime')}`} value={overtimeN} tone="muted" note={t('weekly.pageScopedNote')} />
      </div>

      {/* ─── Matrix ─── */}
      {rows.length === 0 ? (
        <EmptyState icon={CalendarOff} title={t('emptyTitle')} description={t('emptyDesc')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{t('weekly.member')}</th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={cn(
                      'px-1 py-2 text-center text-xs font-medium',
                      isWeekend(d) ? 'text-muted-foreground' : 'text-foreground',
                      d === todayStr && 'bg-primary/5',
                    )}
                  >
                    <span className="block text-[10px] text-muted-foreground">{dayName(d)}</span>
                    <span className="tabular-nums">{dayNum(d)}</span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">{t('weekly.weekTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const totalMin = row.cells.reduce((s, c) => s + (c.attendance?.totalMinutes ?? 0), 0)
                return (
                  <tr key={row.employeeId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <p className="font-medium text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.department ?? row.employeeNo}</p>
                    </td>
                    {row.cells.map((c) => (
                      <td
                        key={c.date}
                        className={cn('px-1 py-2 text-center align-middle', isWeekend(c.date) && 'bg-muted/20')}
                      >
                        <WeekCell cell={c} todayStr={todayStr} t={t} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <span className="font-semibold tabular-nums text-foreground">{fmtHours(totalMin)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Load more (cursor) ─── */}
      {data.nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
            {t('weekly.loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Cell ───────────────────────────────────────────────────

function WeekCell({
  cell,
  todayStr,
  t,
}: {
  cell: WeeklyCell
  todayStr: string
  t: ReturnType<typeof useTranslations>
}) {
  const { attendance: att, leave, date } = cell

  // 승인 휴가 오버레이 우선 (반차면 ½)
  if (leave) {
    return (
      <span className="inline-flex items-center rounded-full bg-ctr-info-bg px-1.5 py-0.5 text-[10px] font-medium text-ctr-info">
        {t('onLeave')}{leave.halfDayType ? ' ½' : ''}
      </span>
    )
  }

  if (att) {
    if (att.status === 'ABSENT') {
      return <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">{t('absent')}</span>
    }
    const hrs = fmtHours(att.totalMinutes)
    const ot = att.overtimeMinutes > 0
    if (att.status === 'LATE' || att.status === 'EARLY_OUT') {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[11px] tabular-nums text-foreground">{hrs}</span>
          <span className="rounded-full bg-warning-bright/15 px-1.5 text-[9px] font-medium text-ctr-warning">
            {att.status === 'LATE' ? t('late') : t('earlyOut')}
          </span>
        </div>
      )
    }
    // NORMAL
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[11px] tabular-nums text-foreground">{hrs}</span>
        {ot && <span className="rounded-full bg-wd-orange/15 px-1 text-[9px] font-semibold text-wd-orange-ink">OT</span>}
      </div>
    )
  }

  // 미래일/주말/무기록 — 옅은 대시
  return <span className={cn('text-[11px]', date > todayStr ? 'text-border' : 'text-muted-foreground')}>—</span>
}

// ─── Outlier card ───────────────────────────────────────────

function OutlierCard({
  label,
  value,
  tone,
  note,
}: {
  label: string
  value: number
  tone: 'warning' | 'danger' | 'muted'
  note: string
}) {
  const valueColor = tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-ctr-warning' : 'text-foreground'
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', valueColor)}>{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{note}</p>
    </div>
  )
}
