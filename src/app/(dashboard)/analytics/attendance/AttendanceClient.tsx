'use client'

import { useTranslations, useLocale } from 'next-intl'
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
import { CHART_THEME } from '@/lib/styles'
import type { SessionUser } from '@/types'

export default function AttendanceClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('analytics')
  const ta = useTranslations('attendance')
  const locale = useLocale()

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
      toast({ title: t('dataLoadFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [t])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return <div className="space-y-6 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl" />)}</div>
  }

  const { kpis, charts } = data

  // Heatmap data processing
  const heatmapDays = [ta('dayMon'), ta('dayTue'), ta('dayWed'), ta('dayThu'), ta('dayFri')]
  const heatmapHours = Array.from({ length: 13 }, (_, i) => i + 7) // 7~19

  const maxCount = Math.max(...charts.weekdayPattern.map((p) => p.count), 1)

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard {...kpis.leaveUsageRate} icon={CalendarDays} tooltip={t('leaveUsageTooltip')} />
        <KpiCard {...kpis.weeklyOvertimeViolations} icon={AlertTriangle} tooltip={t('overtimeViolationsTooltip')} />
        <KpiCard {...kpis.avgOvertimeHours} icon={Clock} tooltip={t('avgOvertimeTooltip')} />
        <KpiCard {...kpis.negativeBalanceCount} icon={Users} tooltip={t('negativeBalanceTooltip')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t('chartOvertimeTrend')}>
          {charts.overtimeTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={charts.overtimeTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v: string) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(v + '-01'))} />
                <YAxis fontSize={11} label={{ value: t('kr_kebb684'), position: 'insideLeft', style: { fontSize: 11 } }} />
                <Tooltip labelFormatter={(v) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(String(v) + '-01'))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="avgMinutes" name={t('avgOTMinutes')} stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('chartViolationTrend')}>
          {charts.violationTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.violationTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v: string) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(v + '-01'))} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(String(v) + '-01'))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name={t('violationCount')} fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Weekday pattern heatmap */}
      <ChartCard title={t('chartWeekdayPattern')}>
        {charts.weekdayPattern.length === 0 ? <EmptyChart message={t('noPatternData')} /> : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="flex items-center gap-1 mb-2 pl-12">
                {heatmapHours.map((h) => (
                  <span key={h} className="text-[10px] text-muted-foreground/60 w-8 text-center">{t('heatmapHourSuffix', { hour: h })}</span>
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
                        title={t('heatmapCellTooltip', { day, hour, count })}
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
