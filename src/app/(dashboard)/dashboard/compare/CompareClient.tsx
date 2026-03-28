'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 법인 비교 분석 (Phase 2-B1)
// 8종 KPI × N법인, 레이더/막대 뷰, YoY, 백분위, Excel
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine,
} from 'recharts'
import { ArrowLeft, Download, BarChart3, Radar } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CHART_THEME } from '@/lib/styles/chart'
import { COMPARE_KPI_BENCHMARKS } from '@/lib/analytics/benchmarks'
import { ChartCard } from '@/components/analytics/ChartCard'
import { CompanyMultiSelect } from '@/components/analytics/CompanyMultiSelect'
import { CompareRadarChart } from '@/components/analytics/CompareRadarChart'
import { PercentileBar } from '@/components/analytics/PercentileBar'
import { YoYBadge } from '@/components/analytics/YoYBadge'
import type { CompareKpiKey, CompareCompanyResult } from '@/lib/analytics/types'

// ─── Types ──────────────────────────────────────────────────

interface CompanyOption {
  id: string
  code: string
  name: string
}

interface ApiResponse {
  results: CompareCompanyResult[]
  trend: { month: string; companyId: string; company: string; value: number | null }[]
  kpi: string
  year: number
  kpis: CompareKpiKey[]
  kpiMeta: Record<string, { label: string; unit: string; invertBetter?: boolean }>
  yoyResults?: CompareCompanyResult[]
}

type ViewMode = 'bar' | 'radar'

// ─── Constants ──────────────────────────────────────────────

const COLORS = CHART_THEME.colors
const YEAR_OPTIONS = [2024, 2025, 2026]

const KPI_OPTIONS: { key: CompareKpiKey; label: string; unit: string }[] = [
  { key: 'turnover_rate', label: '이직률', unit: '%' },
  { key: 'leave_usage', label: '연차 사용률', unit: '%' },
  { key: 'training_completion', label: '교육 이수율', unit: '%' },
  { key: 'payroll_cost', label: '인건비', unit: '백만 KRW' },
  { key: 'headcount', label: '인원', unit: '명' },
  { key: 'avg_tenure', label: '평균 근속', unit: '년' },
  { key: 'overtime_rate', label: '초과근무 비율', unit: '%' },
  { key: 'training_hours', label: '교육시간', unit: '시간/인' },
]

// KPI별 invertColor 여부 (낮을수록 좋은 지표)
const INVERT_KPIS: Set<CompareKpiKey> = new Set(['turnover_rate', 'overtime_rate'])

// ─── Component ──────────────────────────────────────────────

export function CompareClient() {
  const router = useRouter()

  // ─── State
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedKpi, setSelectedKpi] = useState<CompareKpiKey | 'all'>('all')
  const [year, setYear] = useState(new Date().getFullYear())
  const [yoy, setYoy] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('bar')
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // ─── Fetch companies (한번만)
  useEffect(() => {
    apiClient.get<CompanyOption[]>('/api/v1/companies')
      .then((res) => {
        setCompanies(res.data ?? [])
      })
      .catch(() => {
        // 실패 시 빈 배열
      })
  }, [])

  // ─── Fetch compare data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {
        kpi: selectedKpi,
        year: year.toString(),
        yoy: yoy.toString(),
      }
      if (selectedCompanies.length > 0) {
        params.companies = selectedCompanies.join(',')
      }
      const res = await apiClient.get<ApiResponse>('/api/v1/dashboard/compare', params)
      setData(res.data ?? null)
    } catch (err) {
      toast({
        title: '데이터 로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedKpi, year, yoy, selectedCompanies])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Excel 내보내기
  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        kpi: selectedKpi,
        year: year.toString(),
        yoy: yoy.toString(),
      })
      if (selectedCompanies.length > 0) {
        params.set('companies', selectedCompanies.join(','))
      }

      const response = await fetch(`/api/v1/dashboard/compare/export?${params}`)
      if (!response.ok) throw new Error('내보내기 실패')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `법인비교_${year}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: '내보내기 실패', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  // ─── Derived
  const results = data?.results ?? []
  const yoyResults = data?.yoyResults
  const kpiMeta = data?.kpiMeta ?? {}
  const activeKpis = data?.kpis ?? []

  // 단일 KPI 모드 (막대 차트용)
  const singleKpi = selectedKpi !== 'all' ? selectedKpi : 'turnover_rate'
  const singleMeta = kpiMeta[singleKpi]

  // 막대 차트 데이터 (단일 KPI)
  const barData = results
    .map(r => ({
      company: r.company,
      name: r.name,
      value: r.values[singleKpi] ?? 0,
      yoyValue: yoyResults?.find(y => y.companyId === r.companyId)?.values[singleKpi] ?? null,
    }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  // 벤치마크
  const benchmark = COMPARE_KPI_BENCHMARKS[singleKpi]

  // 트렌드 데이터 (법인별 멀티라인)
  const trendByMonth = new Map<string, Record<string, number | null>>()
  for (const t of data?.trend ?? []) {
    const row = trendByMonth.get(t.month) ?? {}
    row[t.company] = t.value
    trendByMonth.set(t.month, row)
  }
  const trendData = Array.from(trendByMonth.entries())
    .map(([month, values]) => ({ month, ...values }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const trendCompanies = [...new Set((data?.trend ?? []).map(t => t.company))]

  return (
    <div className="p-6 space-y-6">
      {/* ─── 헤더 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">법인 비교 분석</h1>
          <p className="text-sm text-muted-foreground mt-1">전체 법인의 핵심 KPI를 비교하고 순위를 확인합니다</p>
        </div>
      </div>

      {/* ─── 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <CompanyMultiSelect
          companies={companies}
          selected={selectedCompanies}
          onChange={setSelectedCompanies}
        />

        <select
          value={selectedKpi}
          onChange={e => setSelectedKpi(e.target.value as CompareKpiKey | 'all')}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-card"
        >
          <option value="all">전체 KPI</option>
          {KPI_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-card"
        >
          {YEAR_OPTIONS.map(y => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={yoy}
            onChange={e => setYoy(e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-muted-foreground">YoY 비교</span>
        </label>

        {/* 뷰 토글 */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('bar')}
            className={cn(
              'px-3 py-2 text-sm flex items-center gap-1.5 transition-colors',
              viewMode === 'bar' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" /> 막대
          </button>
          <button
            onClick={() => setViewMode('radar')}
            className={cn(
              'px-3 py-2 text-sm flex items-center gap-1.5 transition-colors',
              viewMode === 'radar' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <Radar className="h-3.5 w-3.5" /> 레이더
          </button>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg bg-card hover:bg-muted transition-colors disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? '내보내는 중...' : 'Excel'}
        </button>
      </div>

      {/* ─── 차트 영역 */}
      {loading ? (
        <div className="animate-pulse h-80 bg-muted rounded-xl" />
      ) : !data || results.length === 0 ? (
        <EmptyState title="데이터 없음" description="선택된 조건에 해당하는 데이터가 없습니다" />
      ) : (
        <>
          {/* 막대 차트 뷰 */}
          {viewMode === 'bar' && (
            <ChartCard
              title={`${singleMeta?.label ?? singleKpi} 법인별 비교 (${year}년, ${singleMeta?.unit ?? ''})`}
            >
              <ResponsiveContainer width="100%" height={Math.max(300, barData.length * 45)}>
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ left: 20, right: 20, top: 4, bottom: 4 }}
                >
                  <CartesianGrid {...CHART_THEME.grid} />
                  <XAxis type="number" tick={CHART_THEME.axis.tick} />
                  <YAxis
                    dataKey="company"
                    type="category"
                    tick={{ fontSize: 12, fill: '#334155' }}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={CHART_THEME.tooltip.contentStyle as React.CSSProperties}
                    formatter={(v: unknown) => [`${v} ${singleMeta?.unit ?? ''}`, singleMeta?.label ?? '']}
                  />
                  {yoy && yoyResults && (
                    <Bar dataKey="yoyValue" name={`${year - 1}년`} radius={[0, 4, 4, 0]} fillOpacity={0.3}>
                      {barData.map((_, i) => (
                        <Cell key={`yoy-${i}`} fill={COLORS[0]} opacity={0.3} />
                      ))}
                    </Bar>
                  )}
                  <Bar dataKey="value" name={`${year}년`} radius={[0, 4, 4, 0]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                  {benchmark && (
                    <ReferenceLine
                      x={benchmark.value}
                      stroke="#94A3B8"
                      strokeDasharray="4 4"
                      label={{ value: benchmark.label, position: 'top', fontSize: 10, fill: '#94A3B8' }}
                    />
                  )}
                  {yoy && <Legend wrapperStyle={CHART_THEME.legend.wrapperStyle} />}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* 레이더 차트 뷰 */}
          {viewMode === 'radar' && (
            <ChartCard title={`법인 KPI 레이더 비교 (${year}년, 백분위 기준)`}>
              <CompareRadarChart
                companies={results}
                kpis={activeKpis}
                kpiLabels={Object.fromEntries(KPI_OPTIONS.map(o => [o.key, o.label]))}
              />
            </ChartCard>
          )}

          {/* ─── 백분위 순위 테이블 */}
          <ChartCard title="법인별 KPI 순위" expandable>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">법인</th>
                    {activeKpis.map(kpi => (
                      <th key={kpi} className="text-right py-2 px-3 font-medium text-muted-foreground">
                        {kpiMeta[kpi]?.label ?? kpi}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, ri) => (
                    <tr key={r.companyId} className={cn('border-b border-border/50', ri % 2 === 0 && 'bg-muted/30')}>
                      <td className="py-2.5 px-3">
                        <span className="font-medium">{r.company}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">{r.name}</span>
                      </td>
                      {activeKpis.map(kpi => {
                        const val = r.values[kpi]
                        const pct = r.percentiles[kpi]
                        const yoyVal = yoyResults?.find(y => y.companyId === r.companyId)?.values[kpi]
                        const meta = kpiMeta[kpi]
                        return (
                          <td key={kpi} className="text-right py-2.5 px-3">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-mono text-sm">
                                {val != null ? val.toLocaleString() : '-'}
                                <span className="text-xs text-muted-foreground ml-0.5">{meta?.unit}</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <PercentileBar percentile={pct ?? null} />
                                {yoy && (
                                  <YoYBadge
                                    current={val ?? null}
                                    previous={yoyVal ?? null}
                                    invertColor={INVERT_KPIS.has(kpi)}
                                  />
                                )}
                              </div>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>

          {/* ─── 월별 트렌드 (멀티라인) */}
          {trendData.length > 0 && (
            <ChartCard title="월별 트렌드">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid {...CHART_THEME.grid} />
                  <XAxis dataKey="month" tick={CHART_THEME.axis.tick} />
                  <YAxis tick={CHART_THEME.axis.tick} />
                  <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle as React.CSSProperties} />
                  {trendCompanies.map((company, i) => (
                    <Line
                      key={company}
                      type="monotone"
                      dataKey={company}
                      name={company}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                  <Legend wrapperStyle={CHART_THEME.legend.wrapperStyle} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}
    </div>
  )
}
