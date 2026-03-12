'use client'

import { useTranslations } from 'next-intl'

import React, { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { Users, UserPlus, UserMinus, Calendar } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import { CHART_THEME } from '@/lib/styles/chart'
import type { WorkforceResponse } from '@/lib/analytics/types'

export default function WorkforceClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('analytics')
  const [data, setData] = useState<WorkforceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, compRes] = await Promise.all([
        fetch(`/api/v1/analytics/workforce/overview${window.location.search}`),
        fetch('/api/v1/companies'),
      ])
      if (res.ok) { const j = await res.json(); setData(j.data) }
      if (compRes.ok) { const c = await compRes.json(); setCompanies(c.data || []) }
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return <div className="space-y-6 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl" />)}</div>
  }

  const { kpis, charts } = data

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard {...kpis.totalEmployees} icon={Users} tooltip="현재 ACTIVE 상태인 전체 직원 수" />
        <KpiCard {...kpis.newHires} icon={UserPlus} tooltip="기간 내 신규 입사자 수" />
        <KpiCard {...kpis.exits} icon={UserMinus} tooltip="기간 내 퇴사자 수" />
        <KpiCard {...kpis.avgAge} icon={Calendar} tooltip="전체 재직자의 평균 연령" />
      </div>

      {/* Position Level Distribution - Full Width */}
      <ChartCard title="📊 직급 분포">
        {charts.positionLevelDist.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.positionLevelDist} layout="vertical">
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="level" width={80} fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="인원" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="🏢 부서별 인원">
          {charts.departmentDist.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.departmentDist.slice(0, 10)}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="department" fontSize={10} angle={-20} textAnchor="end" height={50} />
                <YAxis fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name="인원" fill={CHART_COLORS.secondary[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="📅 근속 분포">
          {charts.tenureDist.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.tenureDist}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="range" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name="인원" fill={CHART_COLORS.secondary[1]} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="📊 월별 입사/퇴사 추이">
        {charts.monthlyHiresExits.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.monthlyHiresExits}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
              <YAxis fontSize={11} />
              <Tooltip labelFormatter={(v) => `${String(v).split('-')[1]}월`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="hires" name="입사" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
              <Bar dataKey="exits" name="퇴사" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}
