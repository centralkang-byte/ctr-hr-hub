'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Profile · Attendance Tab (rich-fidelity)
// 본인 이번 달 근태 요약 + 일자별 히트맵 (/api/v1/attendance/monthly/[year]/[month])
// 월 경계는 백엔드가 KST 고정 — 현재 월도 KST 기준으로 산정.
// 히트맵은 응답의 days[] (date 문자열은 이미 KST 보정) 그대로 사용 —
//   `new Date('YYYY-MM-DD')` 파싱 금지(UTC 변환 off-by-one).
// 상태는 실제 AttendanceStatus(NORMAL/LATE/EARLY_OUT/ABSENT)만; "휴가"는
//   근태 상태가 아니라 별도 시스템 → 기록 없는 날은 '기록없음' 처리.
// ═══════════════════════════════════════════════════════════

// ─── Imports ────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Clock, CalendarCheck, Timer, ArrowRight } from 'lucide-react'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { EmptyState } from '@/components/ui/EmptyState'
import { KpiCardsSkeleton } from '@/components/shared/PageSkeleton'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatToTz } from '@/lib/timezone'

// ─── Types ──────────────────────────────────────────────────
interface AttendanceDay {
  date: string // 'YYYY-MM-DD' (KST 보정 완료)
  status: string | null
  totalMinutes: number
}

interface MonthlyAttendance {
  year: number
  month: number
  days: AttendanceDay[]
  summary: {
    workedDays: number
    totalMinutes: number
    totalOvertimeMinutes: number
  }
}

// ─── Constants ──────────────────────────────────────────────
// 히트맵 타일 색 (도메인 viz 팔레트 — 시맨틱 토큰, raw hex 금지)
const STATUS_TILE: Record<string, string> = {
  NORMAL: 'bg-tertiary',
  LATE: 'bg-warning-bright',
  EARLY_OUT: 'bg-wd-orange',
  ABSENT: 'bg-destructive',
}
const EMPTY_TILE = 'bg-muted'

const LEGEND = ['NORMAL', 'LATE', 'EARLY_OUT', 'ABSENT'] as const

// ─── Helpers ────────────────────────────────────────────────
const toHours = (min: number): string => (min / 60).toFixed(1)
// 'YYYY-MM-DD' → 'D' (문자열 파싱 — Date 변환 회피로 tz 안전)
const dayOfMonth = (dateStr: string): string => String(Number(dateStr.slice(8, 10)))

// ─── Component ──────────────────────────────────────────────
export function ProfileAttendanceTab() {
  const t = useTranslations('mySpace')
  const [data, setData] = useState<MonthlyAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)
      // 현재 월 = KST 기준 (백엔드 월 경계와 정합)
      const now = new Date()
      const year = formatToTz(now, 'Asia/Seoul', 'yyyy')
      const month = formatToTz(now, 'Asia/Seoul', 'M')
      const res = await apiClient.get<MonthlyAttendance>(`/api/v1/attendance/monthly/${year}/${month}`)
      setData(res.data ?? null)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <KpiCardsSkeleton count={3} />
  if (error) {
    return (
      <EmptyState
        icon={Clock}
        title={t('profile.summary.loadError')}
        action={{ label: t('profile.summary.retry'), onClick: load }}
      />
    )
  }

  const s = data?.summary
  const hasData = !!s && s.workedDays > 0
  // 라벨은 fetch된 데이터의 월 기준 (월 경계를 넘긴 채 페이지가 열려 있어도 데이터와 일치)
  const monthLabel = data
    ? `${data.year}.${String(data.month).padStart(2, '0')}`
    : formatToTz(new Date(), 'Asia/Seoul', 'yyyy.MM')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t('profile.attendanceTab.thisMonth', { month: monthLabel })}</p>
        <Link href="/attendance" className="flex items-center gap-1 text-sm text-primary hover:underline">
          {t('profile.summary.viewDetail')} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {hasData ? (
        <>
          <WdStatStrip
            items={[
              {
                label: t('profile.attendanceTab.workedDays'),
                value: s!.workedDays,
                icon: CalendarCheck,
                tone: 'info',
                foot: t('profile.attendanceTab.daysUnit'),
              },
              {
                label: t('profile.attendanceTab.workHours'),
                value: toHours(s!.totalMinutes),
                icon: Clock,
                tone: 'default',
                foot: t('profile.attendanceTab.hoursUnit'),
              },
              {
                label: t('profile.attendanceTab.overtime'),
                value: toHours(s!.totalOvertimeMinutes),
                icon: Timer,
                tone: s!.totalOvertimeMinutes > 0 ? 'warning' : 'success',
                foot: t('profile.attendanceTab.hoursUnit'),
              },
            ]}
          />

          {/* ── 이번 달 히트맵 ── */}
          {data && data.days.length > 0 && (
            <section aria-labelledby="att-heatmap-title" className="rounded-2xl border border-border bg-card p-6">
              <h2 id="att-heatmap-title" className="text-base font-semibold text-foreground mb-4">
                {t('profile.attendanceTab.heatmapTitle')}
              </h2>
              <div role="list" className="grid grid-cols-10 gap-1.5">
                {data.days.map((d) => {
                  const tile = d.status ? (STATUS_TILE[d.status] ?? EMPTY_TILE) : EMPTY_TILE
                  const statusLabel = d.status
                    ? t(`profile.attendanceTab.legend.${d.status}` as Parameters<typeof t>[0])
                    : t('profile.attendanceTab.legend.NONE')
                  return (
                    <div
                      key={d.date}
                      role="listitem"
                      title={`${dayOfMonth(d.date)}${t('profile.attendanceTab.daysUnit')} · ${statusLabel}`}
                      aria-label={`${dayOfMonth(d.date)}${t('profile.attendanceTab.daysUnit')} ${statusLabel}`}
                      className={cn('aspect-square rounded-md', tile)}
                    />
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {LEGEND.map((k) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className={cn('h-2.5 w-2.5 rounded-full', STATUS_TILE[k])} aria-hidden="true" />
                    <span>{t(`profile.attendanceTab.legend.${k}` as Parameters<typeof t>[0])}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <EmptyState icon={Clock} title={t('profile.attendanceTab.empty')} />
      )}
    </div>
  )
}
