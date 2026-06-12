'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Total Rewards Client
// 직원 본인 총 보상 명세 (기본급/상여/수당/복리후생/포상)
// ═══════════════════════════════════════════════════════════

import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Wallet, Gift, Heart, Award, TrendingUp } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import { CHART_THEME } from '@/lib/styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface TotalRewardsData {
  baseSalary: number
  bonuses: number
  allowances: number
  benefits: number
  rewards: number
  total: number
  currency: string
  yearlyBreakdown: Array<{ year: number; totalPaid: number }>
}

// ─── Component ──────────────────────────────────────────────

export default function TotalRewardsClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('totalRewards')
  const [data, setData] = useState<TotalRewardsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get<TotalRewardsData>('/api/v1/employees/me/total-rewards')
      setData(res.data)
    } catch (err) {
      toast({
        title: t('loadError'),
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <HomeSkeleton />

  if (!data || data.total === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">{t('title')}</h1>
        <EmptyState icon={Wallet} title={t('empty')} standalone />
      </div>
    )
  }

  // 5개 보상 구성요소에 IDENTITY 기준 고정색 부여(필터 전) → 0 제외돼도 색 불변
  const pieData = [
    { name: t('baseSalary'), value: data.baseSalary, color: CHART_THEME.colors[0] },
    { name: t('bonuses'), value: data.bonuses, color: CHART_THEME.colors[1] },
    { name: t('allowances'), value: data.allowances, color: CHART_THEME.colors[2] },
    { name: t('benefits'), value: data.benefits, color: CHART_THEME.colors[3] },
    { name: t('rewards'), value: data.rewards, color: CHART_THEME.colors[4] },
  ].filter((d) => d.value > 0)

  const statItems = [
    { label: t('bonuses'), value: formatCurrency(data.bonuses), icon: Gift },
    { label: t('allowances'), value: formatCurrency(data.allowances), icon: Wallet },
    { label: t('benefits'), value: formatCurrency(data.benefits), icon: Heart },
    { label: t('rewards'), value: formatCurrency(data.rewards), icon: Award },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* Hero — 총보상(주) + 기본급(보조) */}
      <div className="bg-card rounded-2xl shadow-sm p-6">
        <p className="text-xs text-muted-foreground mb-1">{t('annualTotal')}</p>
        <p className="text-4xl font-bold text-primary font-mono tabular-nums">
          {formatCurrency(data.total)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('baseSalary')}{' '}
          <span className="font-medium text-foreground tabular-nums">
            {formatCurrency(data.baseSalary)}
          </span>
        </p>
      </div>

      {/* KPI 스트립 — 상여·수당·복리후생·포상 */}
      <WdStatStrip items={statItems} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-foreground mb-4">{t('composition')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={CHART_THEME.tooltip.contentStyle}
                labelStyle={CHART_THEME.tooltip.labelStyle}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Trend Line */}
        {data.yearlyBreakdown.length > 1 && (
          <div className="bg-card rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold text-foreground">{t('yearlyTrend')}</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.yearlyBreakdown}>
                <CartesianGrid
                  stroke={CHART_THEME.grid.stroke}
                  strokeDasharray={CHART_THEME.grid.strokeDasharray}
                />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000000)}M`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={CHART_THEME.tooltip.contentStyle}
                  formatter={(value) => formatCurrency(Number(value))}
                />
                <Line
                  type="monotone"
                  dataKey="totalPaid"
                  stroke={CHART_THEME.colors[0]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name={t('totalPaid')}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
