'use client'

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

export default function ExecutiveSummaryClient() {
  const [data, setData] = useState<ExecutiveSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, compRes] = await Promise.all([
        fetch(`/api/v1/analytics/executive/summary${window.location.search}`),
        fetch('/api/v1/companies'),
      ])
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      }
      if (compRes.ok) {
        const cJson = await compRes.json()
        setCompanies(cJson.data || [])
      }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
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

  const { kpis, charts, riskAlerts, companyComparison } = data
  const kpiList = [
    { ...kpis.totalEmployees, icon: Users, tooltip: '현재 ACTIVE 상태인 전체 직원 수' },
    { ...kpis.monthlyTurnoverRate, icon: TrendingDown, tooltip: '당월 퇴사자 ÷ 전월 말 재직자 × 100' },
    { ...kpis.avgTenureYears, icon: Clock, tooltip: '전체 재직자의 입사일 기준 평균 근속 연수' },
    { ...kpis.monthlyLaborCost, icon: Wallet, tooltip: '최근 확정된 급여의 법인별 합산 (KRW 변환)' },
    { ...kpis.recruitmentPipeline, icon: UserPlus, tooltip: '현재 진행 중인 채용 공고 수' },
    { ...kpis.onboardingCompletionRate, icon: CheckCircle2, tooltip: '완료된 온보딩 ÷ 전체 온보딩 × 100' },
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
        <ChartCard title="📈 인원 추이">
          {charts.headcountTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={charts.headcountTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
                <YAxis fontSize={11} />
                <Tooltip labelFormatter={(v) => `${String(v).split('-')[1]}월`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="hires" name="입사" stackId="1" fill={CHART_COLORS.success} stroke={CHART_COLORS.success} fillOpacity={0.6} />
                <Area type="monotone" dataKey="exits" name="퇴사" stackId="2" fill={CHART_COLORS.danger} stroke={CHART_COLORS.danger} fillOpacity={0.4} />
                <Line type="monotone" dataKey="net" name="순증감" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="📉 이직률 추이">
          {charts.turnoverTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={charts.turnoverTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
                <YAxis fontSize={11} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={4.5} label="업계 평균" stroke={CHART_COLORS.danger} stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <Line type="monotone" dataKey="rate" name="이직률" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="🏢 법인별 인원 분포">
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

        <ChartCard title="⚠️ 위험 신호">
          {riskAlerts.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-gray-400">
              현재 감지된 위험 신호가 없습니다 ✅
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
                    <p className="text-xs text-gray-500">{alert.count}건 감지됨</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Company comparison table */}
      {companyComparison.length > 0 && (
        <ChartCard title="🏢 법인 비교">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">법인</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">인원</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">이직률</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">평균 근속</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">인건비</th>
                </tr>
              </thead>
              <tbody>
                {companyComparison.map((c) => (
                  <tr key={c.companyId} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 px-3 font-medium text-gray-700">{c.companyName}</td>
                    <td className="text-right py-2 px-3">{c.headcount}명</td>
                    <td className={`text-right py-2 px-3 ${c.turnoverRate > 5 ? 'text-red-600' : ''}`}>{c.turnoverRate}%</td>
                    <td className="text-right py-2 px-3">{c.avgTenure}년</td>
                    <td className="text-right py-2 px-3">{c.laborCost}</td>
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
