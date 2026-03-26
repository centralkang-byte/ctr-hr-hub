'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import React, { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'
import { Users, TrendingDown, Clock, Wallet, UserPlus, CheckCircle2, AlertTriangle } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AiInsightBanner } from '@/components/analytics/AiInsightBanner'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import type { ExecutiveSummaryResponse } from '@/lib/analytics/types'
import { TABLE_STYLES } from '@/lib/styles'
import { CHART_THEME } from '@/lib/styles/chart'
import { cn } from '@/lib/utils'

export default function ExecutiveSummaryClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('analytics')
  const te = useTranslations('analytics.executive')

  const [data, setData] = useState<ExecutiveSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [res, compRes] = await Promise.all([
        fetch(`/api/v1/analytics/executive/summary${window.location.search}`),
        fetch('/api/v1/companies'),
      ])
      if (res.ok) {
        const json = await res.json()
        setData(json.data ?? null)
      } else {
        toast({ title: '경영진 요약 로드 실패', description: `API 오류: ${res.status}`, variant: 'destructive' })
        setError(true)
      }
      if (compRes.ok) {
        const cJson = await compRes.json()
        setCompanies(cJson.data || [])
      }
    } catch (err) {
      toast({ title: '경영진 요약 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
      setError(true)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-72 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title={te('loadFailed')}
        description={te('loadFailedDesc')}
        action={{ label: t('retry'), onClick: () => fetchData() }}
      />
    )
  }

  const { kpis, charts, riskAlerts, companyComparison } = data
  const kpiList = [
    { ...kpis.totalEmployees, icon: Users, tooltip: te('tooltipTotalEmp') },
    { ...kpis.monthlyTurnoverRate, icon: TrendingDown, tooltip: te('tooltipTurnover') },
    { ...kpis.avgTenureYears, icon: Clock, tooltip: te('tooltipTenure') },
    { ...kpis.monthlyLaborCost, icon: Wallet, tooltip: te('tooltipLaborCost') },
    { ...kpis.recruitmentPipeline, icon: UserPlus, tooltip: te('tooltipRecruitment') },
    { ...kpis.onboardingCompletionRate, icon: CheckCircle2, tooltip: te('tooltipOnboarding') },
  ]

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />
      <AiInsightBanner />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiList.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Charts 2×2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={te('headcountTrend')}>
          {charts.headcountTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={charts.headcountTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => `${String(v).split('-')[1]}월`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="hires" name={te('hires')} stackId="1" fill={CHART_COLORS.success} stroke={CHART_COLORS.success} fillOpacity={0.6} />
                <Area type="monotone" dataKey="exits" name={te('exits')} stackId="2" fill={CHART_COLORS.danger} stroke={CHART_COLORS.danger} fillOpacity={0.4} />
                <Line type="monotone" dataKey="net" name={te('netChange')} stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={te('turnoverTrend')}>
          {charts.turnoverTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={charts.turnoverTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
                <YAxis fontSize={11} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={4.5} label={te('industryAvg')} stroke={CHART_COLORS.danger} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <Line type="monotone" dataKey="rate" name={te('turnoverRateLabel')} stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={te('companyDistribution')}>
          {charts.companyDistribution.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={charts.companyDistribution} dataKey="count" nameKey="company" cx="50%" cy="50%" outerRadius={100}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(entry: any) => `${entry.company} ${entry.percentage}%`} labelLine={{ strokeWidth: 1 }}>
                  {charts.companyDistribution.map((_, i) => (
                    <Cell key={i} fill={[CHART_COLORS.primary, ...CHART_COLORS.secondary][i % 8]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={te('riskAlerts')}>
          {riskAlerts.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              {t('kr_ked9884ec_keab090ec_risk_kec8b')}
            </div>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {riskAlerts.map((alert, i) => (
                <a key={i} href={alert.link}
                  className={`flex items-center gap-3 p-3 rounded-lg border-l-4 hover:bg-gray-50 transition-colors ${
                    alert.severity === 'HIGH' ? 'border-l-red-500 bg-red-50/30' :
                    alert.severity === 'MEDIUM' ? 'border-l-amber-500 bg-amber-50/30' :
                    'border-l-primary bg-primary/5'
                  }`}>
                  <AlertTriangle className={`h-4 w-4 ${alert.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{alert.type}</p>
                    <p className="text-xs text-gray-500">{te('detected', { count: alert.count })}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Company comparison table */}
      {companyComparison.length > 0 && (
        <ChartCard title={te('companyComparison')}>
          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr>
                  <th className={TABLE_STYLES.headerCell}>{t('company')}</th>
                  <th className={TABLE_STYLES.headerCellRight}>{t('kr_kec9db8ec')}</th>
                  <th className={TABLE_STYLES.headerCellRight}>{t('kr_kec9db4ec')}</th>
                  <th className={TABLE_STYLES.headerCellRight}>{t('average_keab7bcec')}</th>
                  <th className={TABLE_STYLES.headerCellRight}>{t('kr_kec9db8ea')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F3]">
                {companyComparison.map((c) => (
                  <tr key={c.companyId} className={TABLE_STYLES.row}>
                    <td className={TABLE_STYLES.cell}>{c.companyName}</td>
                    <td className={TABLE_STYLES.cellRight}>{c.headcount}명</td>
                    <td className={cn(TABLE_STYLES.cellRight, c.turnoverRate > 5 && 'text-red-600')}>{c.turnoverRate}%</td>
                    <td className={TABLE_STYLES.cellRight}>{c.avgTenure}년</td>
                    <td className={TABLE_STYLES.cellRight}>{c.laborCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  )
}
