'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Profile · Attendance Summary Tab
// 본인 이번 달 근태 요약 (/api/v1/attendance/monthly/[year]/[month])
// 월 경계는 백엔드가 KST 고정 — 현재 월도 KST 기준으로 산정.
// 30일 히트맵·지각/결근 정밀 집계는 후속.
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
import { formatToTz } from '@/lib/timezone'

// ─── Types ──────────────────────────────────────────────────
interface MonthlyAttendance {
  year: number
  month: number
  summary: {
    workedDays: number
    totalMinutes: number
    totalOvertimeMinutes: number
  }
}

// ─── Helpers ────────────────────────────────────────────────
const toHours = (min: number): string => (min / 60).toFixed(1)

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
      ) : (
        <EmptyState icon={Clock} title={t('profile.attendanceTab.empty')} />
      )}
    </div>
  )
}
