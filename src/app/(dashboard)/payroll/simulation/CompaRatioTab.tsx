'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compa-Ratio 분포 탭
// 로컬 통화 기준 compa-ratio 히스토그램 + 아웃라이어 리스트
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts'
import { apiClient } from '@/lib/api'
import { CARD_STYLES, TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { EmptyState } from '@/components/ui/EmptyState'
import type {
  Company, CompaRatioResponse, CompaRatioDistBucket,
  CompaRatioByGrade, CompaRatioOutlier,
} from './types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  companies: Company[]
}

// ─── Constants ──────────────────────────────────────────────

const BUCKET_COLORS: Record<string, string> = {
  '< 0.7': '#DC2626',     // red — 심각 저보상
  '0.7–0.8': '#F59E0B',   // amber — 저보상
  '0.8–0.9': '#3B82F6',   // blue — 약간 낮음
  '0.9–1.0': '#059669',   // green — 적정
  '1.0–1.1': '#059669',   // green — 적정
  '1.1–1.2': '#3B82F6',   // blue — 약간 높음
  '> 1.2': '#DC2626',      // red — 고보상 이탈
}

// ─── Component ──────────────────────────────────────────────

export default function CompaRatioTab({ companies }: Props) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')

  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CompaRatioResponse | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params = selectedCompanyId ? `?companyId=${selectedCompanyId}` : ''
      const res = await apiClient.get<CompaRatioResponse>(`/api/v1/analytics/payroll/compa-ratio${params}`)
      setData(res.data)
    } catch (err) {
      toast({
        title: t('simCompaLoadFail'),
        description: err instanceof Error ? err.message : t('simRetry'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId, t])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('simCompaLoading')}
      </div>
    )
  }

  if (!data || data.summary.coveredEmployees === 0) {
    return <EmptyState title={t('simCompaNoData')} description={t('simCompaNoDataDesc')} />
  }

  const { distribution, byGrade, outliers, summary } = data

  return (
    <div className="space-y-6">
      {/* ── 필터 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('simCompaTitle')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('simCompaDesc')}
          </p>
        </div>
        <select
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white"
        >
          <option value="">{t('simCompaAllCompanies')}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* ── 요약 KPI ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-muted-foreground">{t('simCompaKpiTarget')}</p>
          <p className="text-xl font-bold text-foreground">{summary.coveredEmployees}<span className="text-sm font-normal text-muted-foreground">/{t('simPersonUnit', { count: summary.totalEmployees })}</span></p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-muted-foreground">{t('simCompaKpiAvg')}</p>
          <p className="text-xl font-bold text-foreground">{summary.avg.toFixed(2)}</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-muted-foreground">{t('simCompaKpiMedian')}</p>
          <p className="text-xl font-bold text-foreground">{summary.median.toFixed(2)}</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-muted-foreground">{t('simCompaKpiLow')}</p>
          <p className="text-xl font-bold text-red-600">
            <TrendingDown className="w-4 h-4 inline mr-1" />{t('simPersonUnit', { count: summary.belowBand })}
          </p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-muted-foreground">{t('simCompaKpiHigh')}</p>
          <p className="text-xl font-bold text-amber-600">
            <TrendingUp className="w-4 h-4 inline mr-1" />{t('simPersonUnit', { count: summary.aboveBand })}
          </p>
        </div>
      </div>

      {/* ── 히스토그램 ── */}
      <div className={CARD_STYLES.padded}>
        <h3 className="text-sm font-semibold text-foreground mb-4">{t('simCompaChartTitle')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={distribution} barCategoryGap="20%">
            <CartesianGrid {...CHART_THEME.grid} />
            <XAxis dataKey="range" {...CHART_THEME.axis} />
            <YAxis {...CHART_THEME.axis} label={{ value: t('simCompaChartCount'), angle: -90, position: 'insideLeft', ...CHART_THEME.axis.label }} />
            <Tooltip {...CHART_THEME.tooltip} formatter={(v) => [`${v}`, t('simCompaChartCount')]} />
            <ReferenceLine x="0.8–0.9" stroke="#DC2626" strokeDasharray="3 3" label={{ value: t('simCompaLowLabel'), fill: '#DC2626', fontSize: 11 }} />
            <ReferenceLine x="1.1–1.2" stroke="#DC2626" strokeDasharray="3 3" label={{ value: t('simCompaHighLabel'), fill: '#DC2626', fontSize: 11 }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {distribution.map((entry: CompaRatioDistBucket) => (
                <Cell key={entry.range} fill={BUCKET_COLORS[entry.range] ?? CHART_THEME.colors[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> {t('simCompaRiskZone')}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> {t('simCompaCautionZone')}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600" /> {t('simCompaProperZone')}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> {t('simCompaManageZone')}</span>
        </div>
      </div>

      {/* ── 직급별 평균 ── */}
      <div className={CARD_STYLES.padded}>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('simCompaGradeAvgTitle')}</h3>
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{tCommon('grade')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simCompaChartCount')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simCompaColAvg')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simCompaColMin')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simCompaColMax')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('simCompaColDistBar')}</th>
              </tr>
            </thead>
            <tbody>
              {byGrade.map((g: CompaRatioByGrade) => {
                const barLeft = Math.max(0, (g.minRatio - 0.5) / 1.0 * 100)
                const barWidth = Math.min(100, (g.maxRatio - g.minRatio) / 1.0 * 100)
                const avgPos = Math.min(100, (g.avgCompaRatio - 0.5) / 1.0 * 100)
                return (
                  <tr key={g.grade} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, 'font-mono font-medium')}>{g.grade}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums')}>{t('simPersonUnit', { count: g.employees })}</td>
                    <td className={cn(
                      TABLE_STYLES.cell, 'text-right tabular-nums font-mono font-medium',
                      g.avgCompaRatio < 0.8 ? 'text-red-600' : g.avgCompaRatio > 1.2 ? 'text-amber-600' : 'text-foreground'
                    )}>
                      {g.avgCompaRatio.toFixed(3)}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-muted-foreground')}>{g.minRatio.toFixed(2)}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-muted-foreground')}>{g.maxRatio.toFixed(2)}</td>
                    <td className={cn(TABLE_STYLES.cell, 'min-w-[120px]')}>
                      <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                        {/* Range bar */}
                        <div
                          className="absolute h-full bg-indigo-600/20 rounded-full"
                          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                        />
                        {/* Average marker */}
                        <div
                          className="absolute top-0 w-0.5 h-full bg-indigo-600"
                          style={{ left: `${avgPos}%` }}
                        />
                        {/* 1.0 reference */}
                        <div
                          className="absolute top-0 w-px h-full bg-red-600/30"
                          style={{ left: '50%' }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 아웃라이어 ── */}
      {outliers.length > 0 && (
        <div className={CARD_STYLES.padded}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">{t('simCompaOutlierTitle', { count: outliers.length })}</h3>
          </div>
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{tCommon('name')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tCommon('grade')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tCommon('department')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>Compa-Ratio</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simCompaColCurrentSalary')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simCompaColBandRange')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tCommon('status')}</th>
                </tr>
              </thead>
              <tbody>
                {outliers.map((o: CompaRatioOutlier) => (
                  <tr key={o.id} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, 'font-medium')}>{o.name}</td>
                    <td className={cn(TABLE_STYLES.cell, 'font-mono')}>{o.grade}</td>
                    <td className={TABLE_STYLES.cell}>{o.department}</td>
                    <td className={cn(
                      TABLE_STYLES.cell, 'text-right tabular-nums font-mono font-bold',
                      o.compaRatio < 0.8 ? 'text-red-600' : 'text-amber-600'
                    )}>
                      {o.compaRatio.toFixed(3)}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>
                      {o.salary.toLocaleString('ko-KR')} {o.currency}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-muted-foreground text-xs')}>
                      {o.bandMin.toLocaleString('ko-KR')} ~ {o.bandMax.toLocaleString('ko-KR')}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        o.compaRatio < 0.8 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      )}>
                        {o.compaRatio < 0.8 ? t('simCompaLowLabel') : t('simCompaHighLabel')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
