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
        title="데이터를 불러올 수 없습니다"
        description="인사이트 데이터를 불러오는 중 오류가 발생했습니다. 새로고침하거나 잠시 후 다시 시도해주세요."
        action={{ label: t('retry'), onClick: () => fetchData() }}
      />
    )
  }

  const { kpis, charts } = data

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard {...kpis.monthlyTotal} icon={Wallet} tooltip="최근 확정 급여의 총 인건비 합산" />
        <KpiCard {...kpis.changeRate} icon={TrendingUp} tooltip="전월 대비 총 인건비 변동률 (%)" />
        <KpiCard {...kpis.perCapita} icon={User} tooltip="총 인건비 ÷ 급여 대상 인원" />
        <KpiCard {...kpis.anomalyCount} icon={AlertTriangle} tooltip="급여 이상감지 규칙(급격 변동, 임계 초과 등)에 의해 감지된 건수" />
      </div>

      <ChartCard title="💰 월별 인건비 추이">
        {charts.monthlyTrend.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={charts.monthlyTrend}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
              <YAxis fontSize={11} />
              <Tooltip labelFormatter={(v) => `${String(v).split('-')[1]}월`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="baseSalary" name="기본급" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Line type="monotone" dataKey="total" name="총액" stroke={CHART_COLORS.danger} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="🏢 법인별 인건비 비교">
          {charts.companyComparison.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.companyComparison} layout="vertical">
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="company" width={100} fontSize={11} />
                <Tooltip formatter={(value) => [`₩${Number(value).toLocaleString()}`, 'KRW 환산']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="amountKRW" name="인건비(KRW)" fill={CHART_COLORS.secondary[0]} radius={[0, 4, 4, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="📊 급여 구성 비율">
          {charts.compositionRatio.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.compositionRatio}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
                <YAxis fontSize={11} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="basePct" name="급여" stackId="a" fill={CHART_COLORS.primary} />
                <Bar dataKey="deductionPct" name="공제" stackId="a" fill={CHART_COLORS.warning} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
