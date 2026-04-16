'use client'

import { useTranslations } from 'next-intl'
import { toast } from '@/hooks/use-toast'

import React, { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,   ResponsiveContainer, } from 'recharts'
import { CalendarDays, AlertTriangle, Clock, Users } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import type { AttendanceResponse } from '@/lib/analytics/types'
import { CHART_THEME, HEATMAP_COLORS } from '@/lib/styles'
import type { SessionUser } from '@/types'

export default function AttendanceClient({ user: _user }: { user: SessionUser }) {
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
      toast({ title: t('attendance.loadFailed'), description: err instanceof Error ? err.message : t('error.retryMessage'), variant: 'destructive' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return <div className="space-y-6 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl" />)}</div>
  }

  const { kpis, charts } = data

  // Heatmap data processing
  const heatmapDays = ['월', '화', '수', '목', '금'] // i18n: intentional DB value match (weekday pattern keys)
  const heatmapHours = Array.from({ length: 13 }, (_, i) => i + 7) // 7~19

  const maxCount = Math.max(...charts.weekdayPattern.map((p) => p.count), 1)

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard {...kpis.leaveUsageRate} icon={CalendarDays} tooltip={t('attendance.tooltips.leaveUsageRate')} />
        <KpiCard {...kpis.weeklyOvertimeViolations} icon={AlertTriangle} tooltip={t('attendance.tooltips.overtimeViolations')} />
        <KpiCard {...kpis.avgOvertimeHours} icon={Clock} tooltip={t('attendance.tooltips.avgOvertime')} />
        <KpiCard {...kpis.negativeBalanceCount} icon={Users} tooltip={t('attendance.tooltips.negativeBalance')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t('attendance.charts.overtimeTrend')}>
          {charts.overtimeTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={charts.overtimeTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1]} />
                <YAxis fontSize={11} label={{ value: t('attendance.charts.avgLabel'), position: 'insideLeft', style: { fontSize: 11 } }} />
                <Tooltip labelFormatter={(v) => String(v).split('-')[1]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="avgMinutes" name={t('attendance.charts.avgOTMinutes')} stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('attendance.charts.violationTrend')}>
          {charts.violationTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.violationTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1]} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => String(v).split('-')[1]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name={t('attendance.charts.violationCount')} fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Weekday pattern heatmap */}
      <ChartCard title={t('attendance.charts.weekdayPattern')}>
        {charts.weekdayPattern.length === 0 ? <EmptyChart message={t('attendance.charts.noPatternData')} /> : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="flex items-center gap-1 mb-2 pl-12">
                {heatmapHours.map((h) => (
                  <span key={h} className="text-[10px] text-muted-foreground/60 w-8 text-center">{h}</span>
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
                      : intensity < 0.3 ? HEATMAP_COLORS.scale[0]
                      : intensity < 0.6 ? HEATMAP_COLORS.scale[2]
                      : intensity < 0.8 ? HEATMAP_COLORS.scale[4]
                      : HEATMAP_COLORS.scale[6]
                    return (
                      <div key={`${day}-${hour}`}
                        className="w-8 h-6 rounded-sm cursor-default"
                        style={{ backgroundColor: bgColor }}
                        title={`${day} ${hour}: ${count}`}
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
