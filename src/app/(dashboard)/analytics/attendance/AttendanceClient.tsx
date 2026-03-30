'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import React, { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { CalendarDays, AlertTriangle, Clock, Users } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import type { AttendanceResponse } from '@/lib/analytics/types'
import { CHART_THEME } from '@/lib/styles'
import type { SessionUser } from '@/types'

export default function AttendanceClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('analytics')

  const [data, setData] = useState<AttendanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, compRes] = await Promise.all([
        fetch(`/api/v1/analytics/attendance/overview${window.location.search}`),
        fetch('/api/v1/companies'),
      ])
      if (res.ok) { const j = await res.json(); setData(j.data) }
      if (compRes.ok) { const c = await compRes.json(); setCompanies(c.data || []) }
    } catch (err) {
      toast({ title: '근태 분석 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return <div className="space-y-6 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl" />)}</div>
  }

  const { kpis, charts } = data

  // Heatmap data processing
  const heatmapDays = ['월', '화', '수', '목', '금']
  const heatmapHours = Array.from({ length: 13 }, (_, i) => i + 7) // 7~19

  const maxCount = Math.max(...charts.weekdayPattern.map((p) => p.count), 1)

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard {...kpis.leaveUsageRate} icon={CalendarDays} tooltip="전체 부여 연차 중 사용한 비율 (%)" />
        <KpiCard {...kpis.weeklyOvertimeViolations} icon={AlertTriangle} tooltip="주 52시간 근무 한도를 초과한 건수 (당월)" />
        <KpiCard {...kpis.avgOvertimeHours} icon={Clock} tooltip="전체 직원의 월 평균 초과근무 시간" />
        <KpiCard {...kpis.negativeBalanceCount} icon={Users} tooltip="잔여 연차가 0 미만인 직원 수 (마이너스 연차 사용 중)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="⏰ 월별 초과근무 추이">
          {charts.overtimeTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={charts.overtimeTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
                <YAxis fontSize={11} label={{ value: t('kr_kebb684'), position: 'insideLeft', style: { fontSize: 11 } }} />
                <Tooltip labelFormatter={(v) => `${String(v).split('-')[1]}월`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="avgMinutes" name="평균 OT(분)" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="🚨 52h 위반 추이">
          {charts.violationTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.violationTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => `${String(v).split('-')[1]}월`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name="위반 건수" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Weekday pattern heatmap */}
      <ChartCard title="📅 요일별 출근 패턴">
        {charts.weekdayPattern.length === 0 ? <EmptyChart message="출근 패턴 데이터가 없습니다" /> : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="flex items-center gap-1 mb-2 pl-12">
                {heatmapHours.map((h) => (
                  <span key={h} className="text-[10px] text-muted-foreground/60 w-8 text-center">{h}시</span>
                ))}
              </div>
              {heatmapDays.map((day) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <span className="text-xs text-muted-foreground w-10 text-right pr-2">{day}</span>
                  {heatmapHours.map((hour) => {
                    const cell = charts.weekdayPattern.find((p) => p.day === day && p.hour === hour)
                    const count = cell?.count || 0
                    const intensity = count / maxCount
                    const bgColor = count === 0 ? '#F3F4F6'
                      : intensity < 0.3 ? '#DBEAFE'
                      : intensity < 0.6 ? '#93C5FD'
                      : intensity < 0.8 ? '#5E81F4'
                      : '#3B5FCA'
                    return (
                      <div key={`${day}-${hour}`}
                        className="w-8 h-6 rounded-sm cursor-default"
                        style={{ backgroundColor: bgColor }}
                        title={`${day} ${hour}시: ${count}건`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </ChartCard>
    </div>
  )
}
