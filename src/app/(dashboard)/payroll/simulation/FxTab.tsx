'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 환율 시뮬레이션 탭
// 환율 변동에 따른 해외 법인 인건비 KRW 영향 분석
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Calculator, Loader2, RotateCcw, Save } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { apiClient } from '@/lib/api'
import { CARD_STYLES, TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { EXCHANGE_RATES_TO_KRW } from '@/lib/analytics/currency'
import type { Company, FxResponse, FxCompanyImpact, FxSensitivityRow, SaveScenarioPayload } from './types'

// ─── Types ──────────────────────────────────────────────────

interface RateRow {
  currency: string
  currentRate: number
  adjustedRate: number
}

interface Props {
  companies: Company[]
  onSaveScenario?: (payload: SaveScenarioPayload) => void
}

import { fmtN, fmtKRW, signedKRW, pctChange } from './formatters'

// ─── Currency symbols ───────────────────────────────────────

const CURRENCY_LABELS: Record<string, string> = {
  USD: '🇺🇸 USD', CNY: '🇨🇳 CNY', EUR: '🇪🇺 EUR',
  VND: '🇻🇳 VND', RUB: '🇷🇺 RUB', MXN: '🇲🇽 MXN',
}

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

function initRates(): RateRow[] {
  return Object.entries(EXCHANGE_RATES_TO_KRW)
    .filter(([cur]) => cur !== 'KRW')
    .map(([currency, rate]) => ({
      currency,
      currentRate: rate,
      adjustedRate: rate,
    }))
}

export default function FxTab({ companies, onSaveScenario }: Props) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  const [rates, setRates] = useState<RateRow[]>(initRates)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<FxResponse | null>(null)

  // 환율 변경
  const updateRate = useCallback((currency: string, adjustedRate: number) => {
    setRates((prev) => prev.map((r) =>
      r.currency === currency ? { ...r, adjustedRate } : r
    ))
  }, [])

  // 퀵 조정: 전체 통화에 ±N%
  const applyBulkChange = useCallback((pctDelta: number) => {
    setRates((prev) => prev.map((r) => ({
      ...r,
      adjustedRate: Math.round(r.currentRate * (1 + pctDelta / 100) * 100) / 100,
    })))
  }, [])

  // 리셋
  const resetRates = useCallback(() => {
    setRates(initRates())
    setResult(null)
  }, [])

  // 시뮬레이션 실행
  const runSimulation = async () => {
    const changedRates = rates.filter((r) => r.adjustedRate !== r.currentRate)
    if (changedRates.length === 0) {
      toast({ title: t('simFxNoChange'), variant: 'destructive' })
      return
    }

    try {
      setIsLoading(true)
      const res = await apiClient.post<FxResponse>('/api/v1/payroll/simulation', {
        mode: 'FX',
        parameters: {
          rateOverrides: rates.map((r) => ({
            currency: r.currency,
            adjustedRate: r.adjustedRate,
          })),
        },
      })
      setResult(res.data)

      // API 응답의 baselineRates(3개월 평균)로 기준율 업데이트
      const baseline = res.data.summary.baselineRates
      setRates((prev) => prev.map((r) => ({
        ...r,
        currentRate: baseline[r.currency] ?? r.currentRate,
      })))
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

  const summary = result?.summary
  const byCompany = summary?.byCompany ?? []
  const sensitivity = summary?.sensitivity ?? []

  // 법인별 차트 (해외만)
  const chartData = byCompany
    .filter((c: FxCompanyImpact) => c.currency !== 'KRW')
    .map((c: FxCompanyImpact) => ({
      entity: c.companyCode,
      current: Math.round(c.currentKRW / 10000),
      simulated: Math.round(c.simulatedKRW / 10000),
    }))

  // 해외 법인 수
  const overseasCount = companies.filter((c) => c.currency && c.currency !== 'KRW').length

  return (
    <div className="space-y-6">
      {/* ── 환율 입력 ── */}
      <div className={CARD_STYLES.padded}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('simFxTitle')}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{t('simFxDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 퀵 조정 버튼 */}
            {[-10, -5, 5, 10].map((pct) => (
              <button
                key={pct}
                onClick={() => applyBulkChange(pct)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded border',
                  pct < 0
                    ? 'border-tertiary/20 text-tertiary hover:bg-tertiary-container/10'
                    : 'border-destructive/20 text-destructive hover:bg-destructive/5',
                )}
              >
                {pct > 0 ? '+' : ''}{pct}%
              </button>
            ))}
            <button
              onClick={resetRates}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded"
            >
              <RotateCcw className="w-3 h-3" /> {tCommon('reset')}
            </button>
          </div>
        </div>

        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>{t('simFxCurrency')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simFxBaseRate')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simFxAdjustedRate')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simFxChangeRate')}</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                const changed = r.adjustedRate !== r.currentRate
                return (
                  <tr key={r.currency} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, 'font-medium')}>
                      {CURRENCY_LABELS[r.currency] ?? r.currency}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-muted-foreground')}>
                      {r.currentRate.toLocaleString()}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-right')}>
                      <input
                        type="number"
                        min={0}
                        step={r.currency === 'VND' ? 0.001 : 1}
                        value={r.adjustedRate}
                        onChange={(e) => updateRate(r.currency, Number(e.target.value))}
                        className={cn(
                          'w-28 text-right border border-border rounded px-2 py-1 text-sm font-mono',
                          changed && 'border-primary bg-muted'
                        )}
                      />
                    </td>
                    <td className={cn(
                      TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-sm',
                      r.adjustedRate > r.currentRate ? 'text-destructive' :
                        r.adjustedRate < r.currentRate ? 'text-tertiary' : 'text-muted-foreground'
                    )}>
                      {pctChange(r.currentRate, r.adjustedRate)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground">{t('simFxOverseasTarget', { count: overseasCount })}</span>
          <button
            onClick={runSimulation}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            {t('simRunButton')}
          </button>
        </div>
      </div>

      {/* ── 결과 KPI ── */}
      {summary && (
        <>
          {onSaveScenario && (
            <div className="flex justify-end mb-3">
              <button onClick={() => onSaveScenario({
                mode: 'FX',
                companyId: null,
                parameters: { rateOverrides: rates.filter(r => r.adjustedRate !== r.currentRate).map(r => ({ currency: r.currency, adjustedRate: r.adjustedRate })) },
                results: result as unknown as Record<string, unknown>,
              })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5">
                <Save className="w-3.5 h-3.5" /> {t('simSaveScenario')}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label={t('simFxKpiOverseasCurrent')}
              value={`₩${fmtN(Math.round(summary.overseasCurrentKRW / 10000), locale)}만`}
            />
            <KPICard
              label={t('simFxKpiOverseasSim')}
              value={`₩${fmtN(Math.round(summary.overseasSimulatedKRW / 10000), locale)}만`}
              diff={signedKRW(summary.differenceKRW, locale)}
              variant={summary.differenceKRW > 0 ? 'cost' : 'neutral'}
            />
            <KPICard
              label={t('simFxKpiDiffMonthly')}
              value={signedKRW(summary.differenceKRW, locale)}
              diff={t('simFxKpiAnnualDiff', { amount: signedKRW(summary.differenceKRW * 12, locale) })}
              variant={summary.differenceKRW > 0 ? 'cost' : 'neutral'}
            />
            <KPICard
              label={t('simFxKpiGlobalTotal')}
              value={`₩${fmtN(Math.round(summary.totalSimulatedKRW / 10000), locale)}만`}
              diff={t('simFxKpiDomestic', { amount: `₩${fmtN(Math.round(summary.domesticMonthlyKRW / 10000), locale)}만` })}
            />
          </div>

          {/* ── 법인별 비교 차트 ── */}
          {chartData.length > 0 && (
            <div className={CARD_STYLES.padded}>
              <h3 className="text-sm font-semibold text-foreground mb-4">{t('simFxChartTitle')}</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid {...CHART_THEME.grid} />
                  <XAxis dataKey="entity" {...CHART_THEME.axis} />
                  <YAxis {...CHART_THEME.axis} />
                  <Tooltip {...CHART_THEME.tooltip} />
                  <Legend {...CHART_THEME.legend} />
                  <Bar dataKey="current" name={t('simCurrentLabel')} fill={CHART_THEME.colors[5]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="simulated" name={t('simulated')} fill={CHART_THEME.colors[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── 법인 영향 테이블 ── */}
          <div className={CARD_STYLES.padded}>
            <h3 className="text-sm font-semibold text-foreground mb-3">{t('simFxImpactTitle')}</h3>
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{t('simFxColCompany')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>{t('simFxCurrency')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simFxColHeadcount')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simFxColLocalMonthly')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simFxColCurrentKRW')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simFxColSimKRW')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simFxColDiff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {byCompany.map((c: FxCompanyImpact) => (
                    <tr key={c.companyCode} className={TABLE_STYLES.row}>
                      <td className={cn(TABLE_STYLES.cell, 'font-medium')}>{c.companyName}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-center text-xs')}>{c.currency}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums')}>{t('simPersonUnit', { count: c.employeeCount })}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-muted-foreground')}>
                        {fmtN(c.localMonthlyGross, locale)}
                      </td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(c.currentKRW, locale)}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(c.simulatedKRW, locale)}</td>
                      <td className={cn(
                        TABLE_STYLES.cell, 'text-right tabular-nums font-mono',
                        c.differenceKRW > 0 ? 'text-destructive' : c.differenceKRW < 0 ? 'text-tertiary' : 'text-muted-foreground'
                      )}>
                        {signedKRW(c.differenceKRW, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Sensitivity 매트릭스 ── */}
          {sensitivity.length > 0 && (
            <div className={CARD_STYLES.padded}>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('simFxSensitivityTitle')}</h3>
              <p className="text-xs text-muted-foreground mb-3">{t('simFxSensitivityDesc')}</p>
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>{t('simFxCurrency')}</th>
                      <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>{t('simFxSensitivityBaseRate')}</th>
                      {['-10%', '-5%', t('simFxSensitivityBase'), '+5%', '+10%'].map((label) => (
                        <th key={label} className={cn(TABLE_STYLES.headerCell, 'text-right')}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivity.map((row: FxSensitivityRow) => (
                      <tr key={row.currency} className={TABLE_STYLES.row}>
                        <td className={cn(TABLE_STYLES.cell, 'font-medium')}>
                          {CURRENCY_LABELS[row.currency] ?? row.currency}
                        </td>
                        <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-muted-foreground')}>
                          {row.baseRate.toLocaleString()}
                        </td>
                        {row.scenarios.map((s, i) => (
                          <td key={i} className={cn(
                            TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-xs',
                            s.differenceKRW > 0 ? 'text-destructive' :
                              s.differenceKRW < 0 ? 'text-tertiary' : 'text-muted-foreground'
                          )}>
                            <div>{`₩${fmtN(Math.round(s.totalKRW / 10000), locale)}만`}</div>
                            {s.differenceKRW !== 0 && (
                              <div className="text-[10px]">{signedKRW(s.differenceKRW, locale)}</div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
