'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Executive Dashboard Client
// 탭 제거 리팩터: ExecutiveSummaryClient 로직 흡수, 단일 대시보드
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AiInsightBanner } from '@/components/analytics/AiInsightBanner'
import { InsightSurfacingBanner } from '@/components/analytics/InsightSurfacingBanner'
import { OrgTreemap } from '@/components/analytics/OrgTreemap'
import { TurnoverHeatmap } from '@/components/analytics/TurnoverHeatmap'
import { RecruitmentFunnel } from '@/components/analytics/RecruitmentFunnel'
import { KpiDrilldownSheet } from '@/components/analytics/KpiDrilldownSheet'
import { evaluateInsights } from '@/lib/analytics/insight-surfacing'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'
import { CHART_THEME } from '@/lib/styles/chart'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { ExecutiveSummaryResponse, KpiDrilldownType } from '@/lib/analytics/types'
import { TURNOVER_BENCHMARKS } from '@/lib/analytics/benchmarks'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

// ─── Component ──────────────────────────────────────────────

export function DashboardClient({ user }: Props) {
  const t = useTranslations('analytics')
  const te = useTranslations('analytics.executive')
  const searchParams = useSearchParams()

  const [data, setData] = useState<ExecutiveSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [drilldownType, setDrilldownType] = useState<KpiDrilldownType | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = searchParams.toString()
      const url = params
        ? `/api/v1/analytics/executive/summary?${params}`
        : '/api/v1/analytics/executive/summary'
      const res = await apiClient.get<ExecutiveSummaryResponse>(url)
      setData(res.data ?? null)
    } catch (err) {
      toast({
        title: '대시보드 데이터 로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Loading ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-pulse">
        <div className="h-12 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Error ──────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <EmptyState
          title={te('loadFailed')}
          description={te('loadFailedDesc')}
          action={{ label: t('retry'), onClick: fetchData }}
        />
      </div>
    )
  }

  const { kpis, charts, riskAlerts, companyComparison } = data
  const surfacedInsights = evaluateInsights(data)

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          전사 인사 현황을 한눈에 파악하고 효율적으로 관리합니다.
        </p>
      </div>

      {/* 글로벌 필터바 */}
      <AnalyticsFilterBar />

      {/* 위험 신호 서피싱 */}
      {surfacedInsights.length > 0 ? (
        <InsightSurfacingBanner insights={surfacedInsights} />
      ) : (
        <AiInsightBanner />
      )}

      {/* KPI 6개 — 클릭 시 드릴다운 Sheet */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard {...kpis.totalEmployees} tooltip={te('tooltipTotalEmp')} onClick={() => setDrilldownType('headcount')} />
        <KpiCard {...kpis.monthlyTurnoverRate} tooltip={te('tooltipTurnover')} onClick={() => setDrilldownType('turnover')} />
        <KpiCard {...kpis.avgTenureYears} tooltip={te('tooltipTenure')} onClick={() => setDrilldownType('tenure')} />
        <KpiCard {...kpis.monthlyLaborCost} tooltip={te('tooltipLaborCost')} onClick={() => setDrilldownType('laborCost')} />
        <KpiCard {...kpis.recruitmentPipeline} tooltip={te('tooltipRecruitment')} onClick={() => setDrilldownType('recruitment')} />
        <KpiCard {...kpis.onboardingCompletionRate} tooltip={te('tooltipOnboarding')} onClick={() => setDrilldownType('onboarding')} />
      </div>

      {/* 차트 2×2 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 인원 추이 */}
        <ChartCard title={te('headcountTrend')}>
          {charts.headcountTrend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={charts.headcountTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
                <YAxis fontSize={11} />
                <Tooltip
                  labelFormatter={(v) => `${String(v).split('-')[1]}월`}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="hires" name={te('hires')} stackId="1" fill={CHART_COLORS.success} stroke={CHART_COLORS.success} fillOpacity={0.6} />
                <Area type="monotone" dataKey="exits" name={te('exits')} stackId="2" fill={CHART_COLORS.danger} stroke={CHART_COLORS.danger} fillOpacity={0.4} />
                <Line type="monotone" dataKey="net" name={te('netChange')} stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 이직률 추이 */}
        <ChartCard title={te('turnoverTrend')}>
          {charts.turnoverTrend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={charts.turnoverTrend}>
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis dataKey="month" fontSize={11} tickFormatter={(v) => v.split('-')[1] + '월'} />
                <YAxis fontSize={11} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={TURNOVER_BENCHMARKS.manufacturing.value} label={TURNOVER_BENCHMARKS.manufacturing.label} stroke={CHART_COLORS.danger} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="rate" name={te('turnoverRateLabel')} stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 법인별 인력 분포 — Treemap */}
        <ChartCard title={te('companyDistribution')}>
          <OrgTreemap data={charts.companyDistribution} />
        </ChartCard>

        {/* 부서×월 이직률 Heatmap */}
        <ChartCard title="부서별 이직률 히트맵">
          {data.departmentTurnoverHeatmap && data.departmentTurnoverHeatmap.length > 0 ? (
            <TurnoverHeatmap data={data.departmentTurnoverHeatmap} />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 채용 파이프라인 Funnel */}
        <ChartCard title="채용 파이프라인">
          {data.recruitmentFunnel && data.recruitmentFunnel.length > 0 ? (
            <RecruitmentFunnel data={data.recruitmentFunnel} />
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 위험 신호 */}
        <ChartCard title={te('riskAlerts')}>
          {riskAlerts.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              감지된 위험 신호가 없습니다.
            </div>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto">
              {riskAlerts.map((alert, i) => (
                <a
                  key={i}
                  href={alert.link}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border-l-4 hover:bg-muted/50 transition-colors',
                    alert.severity === 'HIGH' && 'border-l-red-500 bg-red-50/30 dark:bg-red-950/20',
                    alert.severity === 'MEDIUM' && 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20',
                    alert.severity !== 'HIGH' && alert.severity !== 'MEDIUM' && 'border-l-primary bg-primary/5',
                  )}
                >
                  <AlertTriangle
                    className={cn('h-4 w-4', alert.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500')}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{alert.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {te('detected', { count: alert.count })}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* KPI 드릴다운 Sheet */}
      <KpiDrilldownSheet
        open={!!drilldownType}
        onOpenChange={(open) => !open && setDrilldownType(null)}
        kpiType={drilldownType}
        filterParams={{
          companyId: searchParams.get('companyId') || undefined,
          startDate: searchParams.get('startDate') || undefined,
          endDate: searchParams.get('endDate') || undefined,
        }}
      />

      {/* 법인 비교 테이블 */}
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
              <tbody className="divide-y divide-border">
                {companyComparison.map((c) => (
                  <tr key={c.companyId} className={TABLE_STYLES.row}>
                    <td className={TABLE_STYLES.cell}>{c.companyName}</td>
                    <td className={TABLE_STYLES.cellRight}>{c.headcount}명</td>
                    <td className={cn(TABLE_STYLES.cellRight, c.turnoverRate > 5 && 'text-red-600')}>
                      {c.turnoverRate}%
                    </td>
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
