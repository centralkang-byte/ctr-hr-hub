'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Trends Tab (PR-4)
// HR 추세: 부서별 비교(30일) · 출근시각 분포(30일) · 근태유형 추이(6개월).
// 전부 실데이터(API /attendance/admin/trends). 출근율%는 PR-4b 별도.
// 프로토 page-attendance.jsx trend 뷰를 semantic 토큰·CSS 막대로 정합.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface DeptRow {
  departmentId: string
  departmentName: string
  employeeCount: number
  lateCount: number
  absentCount: number
  avgClockIn: string | null
  avgClockOut: string | null
  avgOvertimeHours: number | null
}

interface ArrivalBucket {
  label: string // "HH:mm" | "before" | "after"
  count: number
  afterStart: boolean
}

interface TypeTrendRow {
  month: string // "YYYY-MM"
  normal: number
  late: number
  earlyOut: number
  absent: number
  leaveRequests: number
}

interface TrendsData {
  timezone: string
  cohortMin: number
  window: { deptStart: string; deptEnd: string; trendStart: string }
  departments: DeptRow[]
  arrival: { workStartTime: string | null; shiftEnabled: boolean; buckets: ArrivalBucket[] }
  typeTrend: TypeTrendRow[]
}

// ─── Helpers ────────────────────────────────────────────────

function fmtTime(v: string | null): string {
  return v ?? '—'
}

function fmtOt(v: number | null): string {
  return v == null ? '—' : `${v}h`
}

// ─── Component ──────────────────────────────────────────────

export function AttendanceTrendsTab() {
  const t = useTranslations('attendance')
  const tc = useTranslations('common')

  const [data, setData] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await apiClient.get<TrendsData>('/api/v1/attendance/admin/trends')
      setData(res.data)
    } catch (err) {
      setError(true)
      toast({
        title: '로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">데이터를 불러올 수 없습니다</p>
        <button
          onClick={() => void fetchData()}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          다시 시도
        </button>
      </div>
    )
  }

  const depts = data?.departments ?? []
  const buckets = data?.arrival.buckets ?? []
  const typeTrend = data?.typeTrend ?? []
  const isEmpty =
    depts.length === 0 &&
    typeTrend.every((m) => m.normal + m.late + m.earlyOut + m.absent + m.leaveRequests === 0) &&
    buckets.every((b) => b.count === 0)

  if (isEmpty) {
    return <EmptyState title={tc('noData')} />
  }

  return (
    <div className="space-y-4">
      {/* ── Block A: 부서별 비교 ── */}
      <section
        aria-labelledby="trend-dept-title"
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-border flex items-baseline gap-2">
          <h3 id="trend-dept-title" className="text-sm font-semibold text-foreground">
            {t('trend.deptTitle')}
          </h3>
          <span className="text-xs text-muted-foreground">
            {t('trend.deptSub')} · {t('trend.currentRosterNote')}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-5 py-2">{t('trend.department')}</th>
                <th className="text-right font-medium px-3 py-2">{t('trend.lateCount')}</th>
                <th className="text-right font-medium px-3 py-2">{t('trend.absentCount')}</th>
                <th className="text-right font-medium px-3 py-2">{t('trend.avgClockIn')}</th>
                <th className="text-right font-medium px-3 py-2">{t('trend.avgClockOut')}</th>
                <th className="text-right font-medium px-5 py-2">{t('trend.avgOvertime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {depts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    {t('trend.cohortNote')}
                  </td>
                </tr>
              ) : (
                depts.map((d) => (
                  <tr key={d.departmentId}>
                    <td className="px-5 py-2.5 font-medium text-foreground">{d.departmentName}</td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right tabular-nums',
                        d.lateCount >= 5 ? 'text-ctr-warning font-semibold' : 'text-muted-foreground',
                      )}
                    >
                      {d.lateCount}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right tabular-nums',
                        d.absentCount >= 2 ? 'text-destructive font-semibold' : 'text-muted-foreground',
                      )}
                    >
                      {d.absentCount}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{fmtTime(d.avgClockIn)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{fmtTime(d.avgClockOut)}</td>
                    <td
                      className={cn(
                        'px-5 py-2.5 text-right tabular-nums font-semibold',
                        d.avgOvertimeHours != null && d.avgOvertimeHours >= 10
                          ? 'text-destructive'
                          : d.avgOvertimeHours != null && d.avgOvertimeHours >= 5
                            ? 'text-ctr-warning'
                            : 'text-foreground',
                      )}
                    >
                      {fmtOt(d.avgOvertimeHours)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2.5 text-xs text-muted-foreground border-t border-border bg-muted/30">
          {t('trend.cohortNote')}
        </p>
      </section>

      {/* ── Block B: 출근 시각 분포 ── */}
      <ArrivalHistogram
        buckets={buckets}
        workStartTime={data?.arrival.workStartTime ?? null}
        shiftEnabled={data?.arrival.shiftEnabled ?? false}
      />

      {/* ── Block C: 근태 유형 추이 ── */}
      <TypeTrend rows={typeTrend} />
    </div>
  )
}

// ─── Block B: Arrival histogram (CSS 막대 — recharts 헤드리스 빈렌더 회피) ──

function ArrivalHistogram({
  buckets,
  workStartTime,
  shiftEnabled,
}: {
  buckets: ArrivalBucket[]
  workStartTime: string | null
  shiftEnabled: boolean
}) {
  const t = useTranslations('attendance')
  const max = Math.max(1, ...buckets.map((b) => b.count))

  const label = (b: ArrivalBucket): string =>
    b.label === 'before' ? t('trend.beforeBucket') : b.label === 'after' ? t('trend.afterBucket') : b.label

  return (
    <section aria-labelledby="trend-arrival-title" className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-baseline gap-2 mb-4">
        <h3 id="trend-arrival-title" className="text-sm font-semibold text-foreground">
          {t('trend.arrivalTitle')}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t('trend.arrivalSub')}
          {workStartTime ? ` · ${workStartTime}` : ''}
        </span>
      </div>

      {buckets.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">—</p>
      ) : (
        <>
          <div
            className="flex gap-1.5"
            role="img"
            aria-label={`${t('trend.arrivalTitle')}: ${buckets.map((b) => `${label(b)} ${b.count}`).join(', ')}`}
          >
            {buckets.map((b, i) => (
              <div key={`${b.label}-${i}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground h-3">
                  {b.count > 0 ? b.count : ''}
                </span>
                {/* 고정높이 막대 트랙 — height:% 가 확정높이 부모에 대해 해석됨 */}
                <div className="w-full h-28 flex items-end">
                  <div
                    className={cn(
                      'w-full rounded-t-md transition-all',
                      shiftEnabled ? 'bg-primary' : b.afterStart ? 'bg-warning-bright' : 'bg-tertiary',
                      b.count === 0 && 'opacity-20',
                    )}
                    style={{ height: `${Math.max(2, (b.count / max) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{label(b)}</span>
              </div>
            ))}
          </div>
          {!shiftEnabled && (
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-tertiary" />
                {t('trend.refBefore')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-warning-bright" />
                {t('trend.refAfter')}
              </span>
            </div>
          )}
          {shiftEnabled && (
            <p className="mt-3 text-xs text-muted-foreground">{t('trend.shiftNote')}</p>
          )}
        </>
      )}
    </section>
  )
}

// ─── Block C: Type trend (per-type 6개월 스파크라인, 각 행 자체 스케일) ──

const TYPE_SERIES = [
  { key: 'normal', labelKey: 'normal', bar: 'bg-tertiary' },
  { key: 'late', labelKey: 'late', bar: 'bg-warning-bright' },
  { key: 'earlyOut', labelKey: 'earlyOut', bar: 'bg-wd-orange' },
  { key: 'absent', labelKey: 'absent', bar: 'bg-destructive' },
  { key: 'leaveRequests', labelKey: 'trend.leaveRequests', bar: 'bg-primary' },
] as const

function TypeTrend({ rows }: { rows: TypeTrendRow[] }) {
  const t = useTranslations('attendance')

  return (
    <section aria-labelledby="trend-type-title" className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-baseline gap-2 mb-4">
        <h3 id="trend-type-title" className="text-sm font-semibold text-foreground">
          {t('trend.typeTitle')}
        </h3>
        <span className="text-xs text-muted-foreground">{t('trend.typeSub')}</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">—</p>
      ) : (
        <div className="space-y-3">
          {TYPE_SERIES.map((s) => {
            const series = rows.map((r) => r[s.key])
            const seriesMax = Math.max(1, ...series)
            const last = series[series.length - 1] ?? 0
            const first = series[0] ?? 0
            const delta = last - first
            return (
              <div key={s.key} className="grid grid-cols-[72px_1fr_72px] items-center gap-3 text-xs">
                <span className="text-foreground">{t(s.labelKey)}</span>
                <div
                  className="flex items-end gap-1 h-7"
                  role="img"
                  aria-label={`${t(s.labelKey)}: ${series.join(', ')}`}
                >
                  {series.map((v, i) => (
                    <div
                      key={i}
                      className={cn('flex-1 rounded-sm', s.bar)}
                      style={{
                        height: `${Math.max(4, (v / seriesMax) * 100)}%`,
                        opacity: 0.4 + (i / Math.max(1, series.length - 1)) * 0.6,
                      }}
                    />
                  ))}
                </div>
                <span className="text-right font-mono tabular-nums font-semibold text-foreground">
                  {last}
                  {delta !== 0 && (
                    <span className="text-[10px] text-muted-foreground ml-0.5">
                      ({delta > 0 ? '+' : ''}
                      {delta})
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
