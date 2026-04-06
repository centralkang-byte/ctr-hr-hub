'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 차등 인상 시뮬레이션 탭
// 직급별 차등 인상률 입력 → 비용 변화 + Band Violation 경고
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { AlertTriangle, Calculator, Loader2, Save } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { apiClient } from '@/lib/api'
import { CARD_STYLES, TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { Company, DifferentialResponse, GradeBreakdown, SaveScenarioPayload } from './types'

// ─── Types ──────────────────────────────────────────────────

interface GradeInfo {
  id: string
  code: string
  name: string
  employeeCount: number
}

interface Props {
  companies: Company[]
  onSaveScenario?: (payload: SaveScenarioPayload) => void
}

import { fmtKRW, signedKRW, pctStr } from './formatters'

// ─── KPI Card ───────────────────────────────────────────────

function KPICard({ label, value, diff, variant }: {
  label: string; value: string; diff?: string
  variant?: 'neutral' | 'cost'
}) {
  const badgeColor = !diff ? '' :
    variant === 'cost' ? 'bg-destructive/5 text-destructive' : 'bg-primary/5 text-primary'
  return (
    <div className={CARD_STYLES.padded}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {diff && <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${badgeColor}`}>{diff}</span>}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export default function DifferentialTab({ companies, onSaveScenario }: Props) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0]?.id ?? '')
  const [grades, setGrades] = useState<GradeInfo[]>([])
  const [rates, setRates] = useState<Record<string, number>>({})
  const [capAtBandMax, setCapAtBandMax] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingGrades, setIsLoadingGrades] = useState(false)
  const [result, setResult] = useState<DifferentialResponse | null>(null)

  // 법인 변경 시 직급 목록 로드
  const loadGrades = useCallback(async (companyId: string) => {
    try {
      setIsLoadingGrades(true)
      setResult(null)
      const res = await apiClient.get<GradeInfo[]>(`/api/v1/settings/job-grades?companyId=${companyId}`)
      const gradeList = (res.data ?? []).sort((a: GradeInfo, b: GradeInfo) =>
        a.code.localeCompare(b.code, undefined, { numeric: true })
      )
      setGrades(gradeList)
      // 기본 인상률 3%
      const defaultRates: Record<string, number> = {}
      for (const g of gradeList) defaultRates[g.code] = 3
      setRates(defaultRates)
    } catch {
      toast({ title: t('simDiffLoadFail'), variant: 'destructive' })
    } finally {
      setIsLoadingGrades(false)
    }
  }, [t])

  useEffect(() => {
    if (selectedCompanyId) loadGrades(selectedCompanyId)
  }, [selectedCompanyId, loadGrades])

  // 시뮬레이션 실행
  const runSimulation = async () => {
    const rateMap: Record<string, number> = {}
    for (const [code, pct] of Object.entries(rates)) {
      rateMap[code] = pct / 100  // UI는 % 단위, API는 소수
    }

    try {
      setIsLoading(true)
      const res = await apiClient.post<DifferentialResponse>('/api/v1/payroll/simulation', {
        mode: 'DIFFERENTIAL',
        parameters: { companyId: selectedCompanyId, rates: rateMap, capAtBandMax },
      })
      setResult(res.data)
    } catch (err) {
      toast({
        title: t('simFail'),
        description: err instanceof Error ? err.message : t('simRetry'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 인상률 변경
  const updateRate = (code: string, value: number) => {
    setRates((prev) => ({ ...prev, [code]: value }))
  }

  const summary = result?.summary
  const byGrade = summary?.byGrade ?? []
  const violations = summary?.bandViolations

  // 차트 데이터 — 영어 키 + name prop으로 번역
  const chartData = byGrade.map((g: GradeBreakdown) => ({
    grade: g.grade,
    current: Math.round(g.currentGross / 10000),
    simulated: Math.round(g.simulatedGross / 10000),
  }))

  return (
    <div className="space-y-6">
      {/* ── 입력 영역 ── */}
      <div className={CARD_STYLES.padded}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{t('simDiffTitle')}</h3>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-card"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {isLoadingGrades ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            {t('simLoadingGrades')}
          </div>
        ) : grades.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('simNoGrades')}</p>
        ) : (
          <>
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{tCommon('grade')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('simGradeName')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simRatePct')}</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g) => (
                    <tr key={g.id} className={TABLE_STYLES.row}>
                      <td className={cn(TABLE_STYLES.cell, 'font-mono')}>{g.code}</td>
                      <td className={TABLE_STYLES.cell}>{g.name}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right')}>
                        <input
                          type="number"
                          min={-50}
                          max={50}
                          step={0.5}
                          value={rates[g.code] ?? 3}
                          onChange={(e) => updateRate(g.code, Number(e.target.value))}
                          className="w-20 text-right border border-border rounded px-2 py-1 text-sm font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={capAtBandMax}
                  onChange={(e) => setCapAtBandMax(e.target.checked)}
                  className="rounded border-border"
                />
                {t('simDiffCapAtBandMax')}
              </label>
              <button
                onClick={runSimulation}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {t('simRunButton')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Band Violation 경고 ── */}
      {violations && violations.count > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-destructive/5 border border-destructive/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {capAtBandMax
                ? t('simDiffBandViolationCapped', { count: violations.count })
                : t('simDiffBandViolation', { count: violations.count })}
            </p>
            <div className="mt-2 space-y-1">
              {violations.employees.slice(0, 5).map((v, i) => (
                <p key={i} className="text-xs text-destructive">
                  {t('simDiffViolationDetail', { name: v.name, grade: v.grade, simulated: fmtKRW(v.simulatedSalary, locale), max: fmtKRW(v.maxSalary, locale) })}
                  {v.capped && ` ${t('simDiffViolationCapped')}`}
                </p>
              ))}
              {violations.employees.length > 5 && (
                <p className="text-xs text-red-500">... {t('simDiffMoreViolations', { count: violations.employees.length - 5 })}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 결과 KPI ── */}
      {summary && (
        <>
          {onSaveScenario && (
            <div className="flex justify-end mb-3">
              <button onClick={() => onSaveScenario({
                mode: 'DIFFERENTIAL',
                companyId: selectedCompanyId,
                parameters: { companyId: selectedCompanyId, rates, capAtBandMax },
                results: result as unknown as Record<string, unknown>,
              })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5">
                <Save className="w-3.5 h-3.5" /> {t('simSaveScenario')}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label={t('simDiffKpiTarget')}
              value={t('simPersonUnit', { count: summary.employeeCount })}
            />
            <KPICard
              label={t('simDiffKpiCurrentGross')}
              value={fmtKRW(summary.totals.currentGross, locale)}
            />
            <KPICard
              label={t('simDiffKpiSimGross')}
              value={fmtKRW(summary.totals.simulatedGross, locale)}
              diff={pctStr(summary.totals.grossChangeRate)}
              variant="cost"
            />
            <KPICard
              label={t('simDiffKpiDiff')}
              value={signedKRW(summary.totals.grossDifference, locale)}
              diff={pctStr(summary.totals.grossChangeRate)}
              variant="cost"
            />
          </div>

          {/* ── 직급별 비교 차트 ── */}
          {chartData.length > 0 && (
            <div className={CARD_STYLES.padded}>
              <h3 className="text-sm font-semibold text-foreground mb-4">{t('simDiffChartTitle')}</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid {...CHART_THEME.grid} />
                  <XAxis dataKey="grade" {...CHART_THEME.axis} />
                  <YAxis {...CHART_THEME.axis} />
                  <Tooltip {...CHART_THEME.tooltip} />
                  <Legend {...CHART_THEME.legend} />
                  <Bar dataKey="current" name={t('simCurrentLabel')} fill={CHART_THEME.colors[5]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="simulated" name={t('simulated')} fill={CHART_THEME.colors[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── 직급별 상세 테이블 ── */}
          <div className={CARD_STYLES.padded}>
            <h3 className="text-sm font-semibold text-foreground mb-3">{t('simDetailTitle')}</h3>
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{tCommon('grade')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simDiffColHeadcount')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simDiffColRate')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simDiffColCurrentTotal')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simDiffColSimTotal')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simDiffColDiff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {byGrade.map((g: GradeBreakdown) => (
                    <tr key={g.grade} className={TABLE_STYLES.row}>
                      <td className={cn(TABLE_STYLES.cell, 'font-mono font-medium')}>{g.grade}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums')}>{t('simPersonUnit', { count: g.employeeCount })}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{(g.rate * 100).toFixed(1)}%</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(g.currentGross, locale)}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(g.simulatedGross, locale)}</td>
                      <td className={cn(
                        TABLE_STYLES.cell, 'text-right tabular-nums font-mono',
                        g.difference > 0 ? 'text-primary' : g.difference < 0 ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {signedKRW(g.difference, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
