'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

import React, { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Target, CheckCircle2, Scale, FileText } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import type { PerformanceResponse } from '@/lib/analytics/types'
import { CHART_THEME } from '@/lib/styles/chart'
import type { SessionUser } from '@/types'

export default function PerformanceClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('analytics')

  const [data, setData] = useState<PerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [res, compRes] = await Promise.all([
        fetch(`/api/v1/analytics/performance/overview${window.location.search}`),
        fetch('/api/v1/companies'),
      ])
      if (res.ok) { const j = await res.json(); setData(j.data) }
      else { setError(true) }
      if (compRes.ok) { const c = await compRes.json(); setCompanies(c.data || []) }
    } catch { setError(true) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return <div className="space-y-6 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl" />)}</div>
  }

  if (error || !data) {
    return (
      <EmptyState
        title={t('error.loadFailed')}
        description={t('error.loadFailedDescription')}
        action={{ label: t('retry'), onClick: () => fetchData() }}
      />
    )
  }

  const { kpis, charts } = data

  // Check for bias: if any actual > guideline by 10%+
  const hasBias = charts.gradeDistribution.some((g) => g.actual > g.guideline + 10)

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard {...kpis.currentCyclePhase} icon={Target} tooltip={t('performance.tooltips.cyclePhase')} />
        <KpiCard {...kpis.evaluationCompletionRate} icon={CheckCircle2} tooltip={t('performance.tooltips.evalCompletion')} />
        <KpiCard {...kpis.calibrationAdjustmentRate} icon={Scale} tooltip={t('performance.tooltips.calibrationRate')} />
        <KpiCard {...kpis.goalSubmissionRate} icon={FileText} tooltip={t('performance.tooltips.goalSubmission')} />
      </div>

      <ChartCard
        title={t('performance.charts.gradeDistribution')}
        badge={hasBias ? t('performance.charts.biasDetected') : undefined}
        badgeColor="bg-amber-500/10 text-amber-700 border-amber-200"
      >
        {charts.gradeDistribution.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={charts.gradeDistribution}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="grade" fontSize={11} />
              <YAxis fontSize={11} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="actual" name={t('performance.charts.actual')} fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="guideline" name={t('performance.charts.guideline')} fill={CHART_COLORS.neutral} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t('performance.charts.deptGradeDist')}>
          {charts.departmentGradeDist.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.departmentGradeDist}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="department" fontSize={10} angle={-15} textAnchor="end" height={50} />
                <YAxis fontSize={11} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} />
                {/* i18n: intentional DB value match — dataKeys match API response fields */}
                <Bar dataKey="탁월(E)" stackId="a" fill={CHART_COLORS.secondary[1]} maxBarSize={30} />
                <Bar dataKey="우수(M+)" stackId="a" fill={CHART_COLORS.primary} maxBarSize={30} />
                <Bar dataKey="보통(M)" stackId="a" fill={CHART_COLORS.warning} maxBarSize={30} />
                <Bar dataKey="미흡(B)" stackId="a" fill={CHART_COLORS.danger} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('performance.charts.evalProgress')}>
          {charts.evaluationProgress.length === 0 ? <EmptyChart /> : (
            <div className="space-y-4 py-2">
              {charts.evaluationProgress.map((stage) => {
                const pct = stage.total > 0 ? Math.round((stage.completed / stage.total) * 100) : 0
                return (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-foreground">{stage.stage}</span>
                      <span className="text-muted-foreground">{stage.completed}/{stage.total} ({pct}%)</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dim transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
