'use client'

import { EmptyState } from '@/components/ui/EmptyState'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Analytics Client
// 근태 분석 (주별트렌드/초과근무/지각)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsKpiCard } from '@/components/analytics/AnalyticsKpiCard'
import type { AttendanceData } from '@/lib/analytics/types'
import { CHART_THEME } from '@/lib/styles/chart'

export default function AttendanceAnalyticsClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined
  const t = useTranslations('analytics.attendancePage')
  const ta = useTranslations('analytics')

  const [data, setData] = useState<AttendanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await apiClient.get<AttendanceData>('/api/v1/analytics/attendance', {
        company_id: companyId,
      })
      setData(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <AnalyticsPageLayout title={t('title')}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AnalyticsPageLayout>
    )
  }

  if (error || !data) {
    return (
      <AnalyticsPageLayout title={t('title')}>
        <div className="py-20">
          <EmptyState
            title={ta('dataLoadErrorTitle')}
            description={ta('dataLoadErrorDesc')}
            action={{ label: t('retry'), onClick: () => fetchData() }}
          />
        </div>
      </AnalyticsPageLayout>
    )
  }

  if (!data) {
    return (
      <AnalyticsPageLayout title={t('title')}>
        <EmptyChart />
      </AnalyticsPageLayout>
    )
  }

  return (
    <AnalyticsPageLayout title={t('title')} description={t('description')}>
      {/* 52시간 초과 위험 KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AnalyticsKpiCard
          label={t('over52hRisk')}
          value={data.over52hCount}
          icon={AlertTriangle}
          suffix={ta('personSuffix')}
          color={data.over52hCount > 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 주별 근무시간 트렌드 */}
        <ChartCard title={t('weeklyHoursTrend')} className="lg:col-span-2">
          {data.weeklyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={data.weeklyTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="week_start" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                <Legend />
                <Area type="monotone" dataKey="avg_total_hours" stroke={CHART_THEME.colors[3]} fill={CHART_THEME.colors[3]} fillOpacity={0.1} strokeWidth={2} name={t('avgWorkHours')} />
                <Area type="monotone" dataKey="avg_overtime_hours" stroke={CHART_THEME.colors[2]} fill={CHART_THEME.colors[2]} fillOpacity={0.1} strokeWidth={2} name={t('avgOvertime')} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 초과근무 상위 부서 */}
        <ChartCard title={t('topOvertimeDepts')}>
          {data.overtimeByDept.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.overtimeByDept} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis type="number" unit="h" />
                <YAxis type="category" dataKey="department_name" width={70} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                <Bar dataKey="avg_overtime_hours" fill={CHART_THEME.colors[2]} radius={[0, 4, 4, 0]} name={t('avgOvertimeHours')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 지각/결근/조퇴 트렌드 */}
        <ChartCard title={t('issuesTrend')}>
          {data.issuesTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.issuesTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="week_start" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
                <Legend />
                <Bar dataKey="late_count" stackId="a" fill={CHART_THEME.colors[2]} name={t('late')} />
                <Bar dataKey="absent_count" stackId="a" fill={CHART_THEME.colors[4]} name={t('absent')} />
                <Bar dataKey="early_out_count" stackId="a" fill={CHART_THEME.colors[2]} name={t('earlyOut')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>
    </AnalyticsPageLayout>
  )
}
