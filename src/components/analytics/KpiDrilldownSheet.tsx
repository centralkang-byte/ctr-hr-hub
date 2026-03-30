'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — KPI Drilldown Sheet (Phase 2-A)
// AD-1: 별도 API lazy loading — Sheet 오픈 시에만 호출
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { ExternalLink } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import { CHART_THEME } from '@/lib/styles/chart'
import { TABLE_STYLES } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { KpiDrilldownType, KpiDrilldownData } from '@/lib/analytics/types'

// ─── Types ──────────────────────────────────────────────────

interface KpiDrilldownSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kpiType: KpiDrilldownType | null
  filterParams?: { companyId?: string; startDate?: string; endDate?: string }
}

// ─── Constants ──────────────────────────────────────────────

const KPI_CONFIG: Record<KpiDrilldownType, { title: string; link: string; chartType: 'area' | 'line' | 'bar' | 'none' }> = {
  headcount: { title: '재직인원 상세', link: '/analytics/workforce', chartType: 'area' },
  turnover: { title: '이직률 상세', link: '/analytics/turnover', chartType: 'line' },
  tenure: { title: '평균 근속 상세', link: '/analytics/workforce', chartType: 'none' },
  laborCost: { title: '인건비 상세', link: '/analytics/payroll', chartType: 'area' },
  recruitment: { title: '채용 현황 상세', link: '/analytics/recruitment', chartType: 'none' },
  onboarding: { title: '온보딩 상세', link: '/hr/onboarding', chartType: 'none' },
}

// ─── Helpers ───────────────────────────────────────────���────

function TenureDistributionChart({ data }: { data: { range: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
        <XAxis dataKey="range" fontSize={10} />
        <YAxis fontSize={10} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
        <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Component ──────────────────────────────────────────────

export function KpiDrilldownSheet({ open, onOpenChange, kpiType, filterParams }: KpiDrilldownSheetProps) {
  const [data, setData] = useState<KpiDrilldownData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchDrilldown = useCallback(async (type: KpiDrilldownType) => {
    setLoading(true)
    setData(null)
    try {
      const qp = new URLSearchParams({ type })
      if (filterParams?.companyId) qp.set('companyId', filterParams.companyId)
      if (filterParams?.startDate) qp.set('startDate', filterParams.startDate)
      if (filterParams?.endDate) qp.set('endDate', filterParams.endDate)
      const res = await apiClient.get<KpiDrilldownData>(`/api/v1/analytics/executive/drilldown?${qp}`)
      setData(res.data ?? null)
    } catch (err) {
      toast({
        title: '드릴다운 데이터 로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [filterParams])

  useEffect(() => {
    if (open && kpiType) {
      fetchDrilldown(kpiType)
    }
  }, [open, kpiType, fetchDrilldown])

  if (!kpiType) return null
  const config = KPI_CONFIG[kpiType]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{config.title}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 mt-6 animate-pulse">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-40 bg-muted rounded-lg" />
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground mt-6">
            데이터를 불러올 수 없습니다.
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* KPI 요약 */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{data.currentValue}</span>
                {data.unit && <span className="text-sm text-muted-foreground">{data.unit}</span>}
              </div>
              {data.change !== undefined && (
                <p className={cn('text-sm mt-1', data.change > 0 ? 'text-destructive' : 'text-emerald-600')}>
                  {data.change > 0 ? '+' : ''}{data.change}{data.unit === '%' ? 'p' : data.unit || ''} 전월 대비
                </p>
              )}
              {data.benchmark && (
                <p className="text-xs text-muted-foreground mt-1">
                  {data.benchmark.label}: {data.benchmark.value}{data.unit || ''}
                </p>
              )}
            </div>

            {/* 법인별 비교 테이블 */}
            {data.companyBreakdown && data.companyBreakdown.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">법인별 비교</h4>
                <div className="overflow-x-auto">
                  <table className={TABLE_STYLES.table}>
                    <thead className={TABLE_STYLES.header}>
                      <tr>
                        <th className={TABLE_STYLES.headerCell}>법인</th>
                        <th className={TABLE_STYLES.headerCellRight}>값</th>
                        <th className={TABLE_STYLES.headerCellRight}>비고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.companyBreakdown.map((c) => (
                        <tr key={c.companyId} className={TABLE_STYLES.row}>
                          <td className={TABLE_STYLES.cell}>{c.companyName}</td>
                          <td className={TABLE_STYLES.cellRight}>
                            {typeof c.value === 'number' && c.value > 1000
                              ? c.value.toLocaleString()
                              : c.value}
                            {data.unit && <span className="text-muted-foreground ml-0.5">{data.unit}</span>}
                          </td>
                          <td className={cn(TABLE_STYLES.cellRight, 'text-muted-foreground text-xs')}>
                            {c.subValue || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 월별 추세 차트 */}
            {data.monthlyTrend.length > 0 && config.chartType !== 'none' && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">월별 추이</h4>
                <ResponsiveContainer width="100%" height={180}>
                  {config.chartType === 'area' ? (
                    <AreaChart data={data.monthlyTrend}>
                      <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                      <XAxis dataKey="month" fontSize={10} tickFormatter={(v) => v.split('-')[1] + '월'} />
                      <YAxis fontSize={10} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                      <Area type="monotone" dataKey="value" fill={CHART_COLORS.primary} stroke={CHART_COLORS.primary} fillOpacity={0.3} />
                    </AreaChart>
                  ) : (
                    <LineChart data={data.monthlyTrend}>
                      <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                      <XAxis dataKey="month" fontSize={10} tickFormatter={(v) => v.split('-')[1] + '월'} />
                      <YAxis fontSize={10} unit="%" />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                      {data.benchmark && (
                        <ReferenceLine y={data.benchmark.value} stroke={CHART_COLORS.danger} strokeDasharray="5 5" label={{ value: data.benchmark.label, fontSize: 10 }} />
                      )}
                      <Line type="monotone" dataKey="value" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* 근속 분포 (tenure 전용) */}
            {kpiType === 'tenure' && data.details?.tenureDistribution && (
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">근속 분포</h4>
                <TenureDistributionChart data={data.details.tenureDistribution as { range: string; count: number }[]} />
              </div>
            )}

            {/* 상세 분석 링크 */}
            <a
              href={config.link}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              상세 분석 보기
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
