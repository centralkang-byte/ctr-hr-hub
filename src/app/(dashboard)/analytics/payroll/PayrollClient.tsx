'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

import React, { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart,
} from 'recharts'
import { Wallet, TrendingUp, User, AlertTriangle } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import type { PayrollResponse } from '@/lib/analytics/types'
import { CHART_THEME } from '@/lib/styles/chart'
import type { SessionUser } from '@/types'

export default function PayrollClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('analytics')

  const [data, setData] = useState<PayrollResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [res, compRes] = await Promise.all([
        fetch(`/api/v1/analytics/payroll/overview${window.location.search}`),
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

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard {...kpis.monthlyTotal} icon={Wallet} tooltip={t('payroll.tooltips.monthlyTotal')} />
        <KpiCard {...kpis.changeRate} icon={TrendingUp} tooltip={t('payroll.tooltips.changeRate')} />
        <KpiCard {...kpis.perCapita} icon={User} tooltip={t('payroll.tooltips.perCapita')} />
        <KpiCard {...kpis.anomalyCount} icon={AlertTriangle} tooltip={t('payroll.tooltips.anomalyCount')} />
      </div>

      <ChartCard title={t('payroll.charts.monthlyTrend')}>
        {charts.monthlyTrend.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={charts.monthlyTrend}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1]} />
              <YAxis fontSize={11} />
              <Tooltip labelFormatter={(v) => String(v).split('-')[1]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="baseSalary" name={t('payroll.charts.baseSalary')} fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Line type="monotone" dataKey="total" name={t('payroll.charts.total')} stroke={CHART_COLORS.danger} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t('payroll.charts.companyComparison')}>
          {charts.companyComparison.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.companyComparison} layout="vertical">
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="company" width={100} fontSize={11} />
                <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, t('payroll.charts.krwConverted')]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="amountKRW" name={t('payroll.charts.laborCostKRW')} fill={CHART_COLORS.secondary[0]} radius={[0, 4, 4, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('payroll.charts.compositionRatio')}>
          {charts.compositionRatio.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.compositionRatio}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1]} />
                <YAxis fontSize={11} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="basePct" name={t('payroll.charts.salary')} stackId="a" fill={CHART_COLORS.primary} />
                <Bar dataKey="deductionPct" name={t('payroll.charts.deduction')} stackId="a" fill={CHART_COLORS.warning} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
