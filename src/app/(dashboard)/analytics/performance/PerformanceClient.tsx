'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

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

export default function PerformanceClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('analytics')

  const [data, setData] = useState<PerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, compRes] = await Promise.all([
        fetch(`/api/v1/analytics/performance/overview${window.location.search}`),
        fetch('/api/v1/companies'),
      ])
      if (res.ok) { const j = await res.json(); setData(j.data) }
      if (compRes.ok) { const c = await compRes.json(); setCompanies(c.data || []) }
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !data) {
    return <div className="space-y-6 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl" />)}</div>
  }

  const { kpis, charts } = data

  // Check for bias: if any actual > guideline by 10%+
  const hasBias = charts.gradeDistribution.some((g) => g.actual > g.guideline + 10)

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard {...kpis.currentCyclePhase} icon={Target} tooltip="현재 성과 관리 사이클 단계" />
        <KpiCard {...kpis.evaluationCompletionRate} icon={CheckCircle2} tooltip="평가 완료된 직원 ÷ 평가 대상 전체 × 100" />
        <KpiCard {...kpis.calibrationAdjustmentRate} icon={Scale} tooltip="캘리브레이션 과정에서 등급이 조정된 비율" />
        <KpiCard {...kpis.goalSubmissionRate} icon={FileText} tooltip="목표 제출 완료한 직원 ÷ 목표 설정 대상 × 100" />
      </div>

      <ChartCard
        title="📊 등급 분포 vs 가이드라인"
        badge={hasBias ? '⚠️ 상위 편향 감지' : undefined}
        badgeColor="bg-amber-50 text-amber-700 border-amber-200"
      >
        {charts.gradeDistribution.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={charts.gradeDistribution}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} stroke={CHART_COLORS.grid} />
              <XAxis dataKey="grade" fontSize={11} />
              <YAxis fontSize={11} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="actual" name="실제" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="guideline" name="가이드라인" fill="#D1D5DB" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="🏢 부서별 등급 분포">
          {charts.departmentGradeDist.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.departmentGradeDist}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="department" fontSize={10} angle={-15} textAnchor="end" height={50} />
                <YAxis fontSize={11} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="탁월(E)" stackId="a" fill={CHART_COLORS.secondary[1]} maxBarSize={30} />
                <Bar dataKey="우수(M+)" stackId="a" fill={CHART_COLORS.primary} maxBarSize={30} />
                <Bar dataKey="보통(M)" stackId="a" fill={CHART_COLORS.warning} maxBarSize={30} />
                <Bar dataKey="미흡(B)" stackId="a" fill={CHART_COLORS.danger} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="📈 평가 진행 현황">
          {charts.evaluationProgress.length === 0 ? <EmptyChart /> : (
            <div className="space-y-4 py-2">
              {charts.evaluationProgress.map((stage) => {
                const pct = stage.total > 0 ? Math.round((stage.completed / stage.total) * 100) : 0
                return (
                  <div key={stage.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{stage.stage}</span>
                      <span className="text-gray-500">{stage.completed}/{stage.total} ({pct}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#5E81F4] to-[#8B5CF6] transition-all duration-500" style={{ width: `${pct}%` }} />
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
