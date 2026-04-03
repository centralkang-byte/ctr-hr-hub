'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Total Rewards Client
// 직원 본인 총 보상 명세 (기본급/상여/수당/복리후생/포상)
// ═══════════════════════════════════════════════════════════

import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Wallet, Gift, Briefcase, Heart, Award, TrendingUp } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import { CHART_THEME } from '@/lib/styles'
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

// ─── Constants ──────────────────────────────────────────────

const PIE_COLORS = ['#4a40e0', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6']

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
        <div className="bg-card rounded-2xl shadow-sm p-12 text-center">
          <Wallet className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        </div>
      </div>
    )
  }

  const pieData = [
    { name: t('baseSalary'), value: data.baseSalary },
    { name: t('bonuses'), value: data.bonuses },
    { name: t('allowances'), value: data.allowances },
    { name: t('benefits'), value: data.benefits },
    { name: t('rewards'), value: data.rewards },
  ].filter((d) => d.value > 0)

  const kpiCards = [
    { label: t('baseSalary'), value: data.baseSalary, icon: Briefcase, color: 'text-primary' },
    { label: t('bonuses'), value: data.bonuses, icon: Gift, color: 'text-emerald-600' },
    { label: t('allowances'), value: data.allowances, icon: Wallet, color: 'text-amber-600' },
    { label: t('benefits'), value: data.benefits, icon: Heart, color: 'text-pink-500' },
    { label: t('rewards'), value: data.rewards, icon: Award, color: 'text-purple-500' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {/* Total */}
      <div className="bg-card rounded-2xl shadow-sm p-6">
        <p className="text-xs text-muted-foreground mb-1">{t('annualTotal')}</p>
        <p className="text-4xl font-bold text-primary font-mono tabular-nums">
          {formatCurrency(data.total)}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground font-mono tabular-nums">
              {formatCurrency(kpi.value)}
            </p>
          </div>
        ))}
      </div>

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
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
                  stroke="#4a40e0"
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
