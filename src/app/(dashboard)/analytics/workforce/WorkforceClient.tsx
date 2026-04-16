'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

import React, { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, } from 'recharts'
import { Users, UserPlus, UserMinus, Calendar } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import { CHART_THEME } from '@/lib/styles/chart'
import type { WorkforceResponse } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'

export default function WorkforceClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('analytics')
  const [data, setData] = useState<WorkforceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [res, compRes] = await Promise.all([
        fetch(`/api/v1/analytics/workforce/overview${window.location.search}`),
        fetch('/api/v1/companies'),
      ])
      if (res.ok) { const j = await res.json(); setData(j.data) }
      else { setError(true) }
      if (compRes.ok) { const c = await compRes.json(); setCompanies(c.data || []) }
    } catch { setError(true) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return <div className="space-y-6 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl" />)}</div>
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
        <KpiCard {...kpis.totalEmployees} icon={Users} tooltip={t('workforce.tooltips.totalEmployees')} />
        <KpiCard {...kpis.newHires} icon={UserPlus} tooltip={t('workforce.tooltips.newHires')} />
        <KpiCard {...kpis.exits} icon={UserMinus} tooltip={t('workforce.tooltips.exits')} />
        <KpiCard {...kpis.avgAge} icon={Calendar} tooltip={t('workforce.tooltips.avgAge')} />
      </div>

      {/* Position Level Distribution - Full Width */}
      <ChartCard title={t('workforce.charts.positionDist')}>
        {charts.positionLevelDist.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.positionLevelDist} layout="vertical">
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis type="number" fontSize={11} />
              <YAxis type="category" dataKey="level" width={80} fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name={t('workforce.charts.headcount')} fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t('workforce.charts.deptDist')}>
          {charts.departmentDist.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.departmentDist.slice(0, 10)}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="department" fontSize={10} angle={-20} textAnchor="end" height={50} />
                <YAxis fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name={t('workforce.charts.headcount')} fill={CHART_COLORS.secondary[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('workforce.charts.tenureDist')}>
          {charts.tenureDist.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.tenureDist}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="range" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name={t('workforce.charts.headcount')} fill={CHART_COLORS.secondary[1]} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title={t('workforce.charts.monthlyHiresExits')}>
        {charts.monthlyHiresExits.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.monthlyHiresExits}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1]} />
              <YAxis fontSize={11} />
              <Tooltip labelFormatter={(v) => String(v).split('-')[1]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="hires" name={t('workforce.charts.hires')} fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
              <Bar dataKey="exits" name={t('workforce.charts.exits')} fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}
