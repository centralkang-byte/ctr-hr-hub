'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Today Roster List (직원별 근태 명단)
// GET /api/v1/attendance/admin/roster 소비. 행 = 직원 + 당일 근태 + 승인휴가 오버레이.
// /attendance/admin의 KPI·이상치(문제만)와 보완 관계 — 여기는 전 직원 명단.
// 데이터는 전부 서버 응답 — 클라 날조 없음 (빈 응답 = 빈 상태).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Users } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Types ──────────────────────────────────────────────────

interface RosterAttendance {
  id: string
  clockIn: string | null
  clockOut: string | null
  totalMinutes: number
  overtimeMinutes: number
  status: string
  workType: string
}

interface RosterLeave {
  leaveType: string
  halfDayType: string | null
}

interface RosterRow {
  employeeId: string
  name: string
  employeeNo: string
  department: string | null
  attendance: RosterAttendance | null
  leaves: RosterLeave[]
}

interface RosterData {
  date: string
  rows: RosterRow[]
  nextCursor: string | null
}

// ─── Helpers ────────────────────────────────────────────────

// 운영자 브라우저 TZ 기준 HH:mm (AttendanceAdminClient.formatTime과 동일 컨벤션; 법인 TZ 일원화=att-07 별 트랙)
function formatTime(t: string | null | undefined, locale: string): string {
  if (!t) return '—'
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(t))
}

// ─── Component ──────────────────────────────────────────────

export function TodayRosterList() {
  const t = useTranslations('attendance')
  const te = useTranslations('employee')
  const locale = useLocale()

  const STATUS_LABELS: Record<string, string> = {
    NORMAL: t('normal'),
    LATE: t('late'),
    EARLY_OUT: t('earlyOut'),
    ABSENT: t('absent'),
  }
  const WORKTYPE_LABELS: Record<string, string> = {
    NORMAL: t('normal'),
    OVERTIME: t('overtime'),
    NIGHT: t('night'),
    HOLIDAY: t('holiday'),
  }

  const [data, setData] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchRoster = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<RosterData>('/api/v1/attendance/admin/roster')
      setData(res.data)
    } catch (err) {
      toast({
        title: t('roster.loadFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchRoster()
  }, [fetchRoster])

  const loadMore = useCallback(async () => {
    if (!data?.nextCursor) return
    setLoadingMore(true)
    try {
      // date를 핀 (weekly의 start 핀과 동일) — 자정 경과 시 서버가 "오늘"을 재계산해
      // 커서가 다른 날짜 fence로 검증돼 실패하는 드문 경계 회피.
      const res = await apiClient.get<RosterData>('/api/v1/attendance/admin/roster', {
        date: data.date,
        cursor: data.nextCursor,
      })
      const more = res.data
      if (more) {
        setData((prev) => (prev ? { ...more, rows: [...prev.rows, ...more.rows] } : more))
      }
    } catch (err) {
      toast({
        title: t('roster.loadFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoadingMore(false)
    }
  }, [data, t])

  // 근태 상태 칩 — 휴가 오버레이 우선, 그다음 근태 상태, 무기록은 미출근
  const renderStatus = (row: RosterRow) => {
    if (row.leaves.length > 0) {
      const isHalf = row.leaves.some((l) => l.halfDayType)
      return <StatusBadge status="ON_LEAVE">{isHalf ? t('roster.halfDay') : t('onLeave')}</StatusBadge>
    }
    if (row.attendance) {
      const s = row.attendance.status
      return <StatusBadge status={s}>{STATUS_LABELS[s] ?? s}</StatusBadge>
    }
    return <Badge variant="neutral">{t('roster.notClockedIn')}</Badge>
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data) {
    return <EmptyState icon={Users} title={t('roster.loadFailed')} />
  }

  const { rows } = data

  return (
    <section aria-labelledby="today-roster-title" className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 id="today-roster-title" className="text-base font-semibold text-foreground">
          {t('roster.title')}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t('roster.countToday', { count: rows.length })}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={t('roster.empty')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{te('name')}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{te('employeeCode')}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{t('clockIn')}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{t('clockOut')}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{t('status')}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{t('workType')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employeeId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <p className="font-medium text-foreground">{row.name}</p>
                    {row.department && <p className="text-xs text-muted-foreground">{row.department}</p>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">{row.employeeNo}</td>
                  <td className="px-4 py-2 tabular-nums text-foreground">{formatTime(row.attendance?.clockIn, locale)}</td>
                  <td className="px-4 py-2 tabular-nums text-foreground">{formatTime(row.attendance?.clockOut, locale)}</td>
                  <td className="px-4 py-2">{renderStatus(row)}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {row.attendance ? (WORKTYPE_LABELS[row.attendance.workType] ?? row.attendance.workType) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
            {t('weekly.loadMore')}
          </Button>
        </div>
      )}
    </section>
  )
}
