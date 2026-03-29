'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 환율 시뮬레이션 탭
// 환율 변동에 따른 해외 법인 인건비 KRW 영향 분석
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { Calculator, Loader2, RotateCcw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { apiClient } from '@/lib/api'
import { CARD_STYLES, TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { EXCHANGE_RATES_TO_KRW } from '@/lib/analytics/currency'
import type { Company, FxResponse, FxCompanyImpact, FxSensitivityRow } from './types'

// ─── Types ──────────────────────────────────────────────────

interface RateRow {
  currency: string
  currentRate: number
  adjustedRate: number
}

interface Props {
  companies: Company[]
}

// ─── Formatters ─────────────────────────────────────────────

const fmtN = (n: number) => n.toLocaleString('ko-KR')
const fmtKRW = (n: number) => `₩${Math.abs(n).toLocaleString('ko-KR')}`
const signedKRW = (n: number) => n === 0 ? '₩0' : `${n > 0 ? '+' : '-'}${fmtKRW(n)}`
const fmtMan = (n: number) => `₩${fmtN(Math.round(n / 10000))}만`
const pctChange = (cur: number, adj: number) => {
  if (cur === 0) return '0.0%'
  const pct = ((adj - cur) / cur) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

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
    variant === 'cost' ? 'bg-red-50 text-red-600' : 'bg-primary/5 text-primary'
  return (
    <div className={CARD_STYLES.padded}>
      <p className="text-xs text-[#8181A5] mb-1">{label}</p>
      <p className="text-xl font-bold text-[#1C1D21]">{value}</p>
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

export default function FxTab({ companies }: Props) {
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
      toast({ title: '변경된 환율이 없습니다. 환율을 조정해주세요.', variant: 'destructive' })
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
        title: '시뮬레이션 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
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
      법인: c.companyCode,
      현재: Math.round(c.currentKRW / 10000),
      시뮬레이션: Math.round(c.simulatedKRW / 10000),
    }))

  // 해외 법인 수
  const overseasCount = companies.filter((c) => c.currency && c.currency !== 'KRW').length

  return (
    <div className="space-y-6">
      {/* ── 환율 입력 ── */}
      <div className={CARD_STYLES.padded}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1C1D21]">환율 조정</h3>
            <p className="text-xs text-[#8181A5] mt-0.5">기준: 최근 3개월 평균 (DB 미등록 시 시스템 기본값)</p>
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
                    ? 'border-green-200 text-green-700 hover:bg-green-50'
                    : 'border-red-200 text-red-700 hover:bg-red-50',
                )}
              >
                {pct > 0 ? '+' : ''}{pct}%
              </button>
            ))}
            <button
              onClick={resetRates}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-[#8181A5] hover:text-[#1C1D21] border border-[#E2E8F0] rounded"
            >
              <RotateCcw className="w-3 h-3" /> 초기화
            </button>
          </div>
        </div>

        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>통화</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>기준 환율 (→KRW)</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>조정 환율</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>변동률</th>
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
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-[#8181A5]')}>
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
                          'w-28 text-right border border-[#E2E8F0] rounded px-2 py-1 text-sm font-mono',
                          changed && 'border-[#5E81F4] bg-[#F5F5FA]'
                        )}
                      />
                    </td>
                    <td className={cn(
                      TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-sm',
                      r.adjustedRate > r.currentRate ? 'text-red-600' :
                        r.adjustedRate < r.currentRate ? 'text-green-600' : 'text-[#8181A5]'
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
          <span className="text-xs text-[#8181A5]">{overseasCount}개 해외 법인 대상</span>
          <button
            onClick={runSimulation}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg text-sm font-medium hover:bg-[#4338CA] disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            시뮬레이션 실행
          </button>
        </div>
      </div>

      {/* ── 결과 KPI ── */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="해외 현재 KRW (월)"
              value={fmtMan(summary.overseasCurrentKRW)}
            />
            <KPICard
              label="해외 시뮬레이션 KRW (월)"
              value={fmtMan(summary.overseasSimulatedKRW)}
              diff={signedKRW(summary.differenceKRW)}
              variant={summary.differenceKRW > 0 ? 'cost' : 'neutral'}
            />
            <KPICard
              label="환율 증감액 (월)"
              value={signedKRW(summary.differenceKRW)}
              diff={`연 ${signedKRW(summary.differenceKRW * 12)}`}
              variant={summary.differenceKRW > 0 ? 'cost' : 'neutral'}
            />
            <KPICard
              label="글로벌 총 인건비 (월)"
              value={fmtMan(summary.totalSimulatedKRW)}
              diff={`국내 ${fmtMan(summary.domesticMonthlyKRW)}`}
            />
          </div>

          {/* ── 법인별 비교 차트 ── */}
          {chartData.length > 0 && (
            <div className={CARD_STYLES.padded}>
              <h3 className="text-sm font-semibold text-[#1C1D21] mb-4">해외 법인별 KRW 인건비 비교 (만원)</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid {...CHART_THEME.grid} />
                  <XAxis dataKey="법인" {...CHART_THEME.axis} />
                  <YAxis {...CHART_THEME.axis} />
                  <Tooltip {...CHART_THEME.tooltip} />
                  <Legend {...CHART_THEME.legend} />
                  <Bar dataKey="현재" fill={CHART_THEME.colors[5]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="시뮬레이션" fill={CHART_THEME.colors[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── 법인 영향 테이블 ── */}
          <div className={CARD_STYLES.padded}>
            <h3 className="text-sm font-semibold text-[#1C1D21] mb-3">법인별 영향 분석</h3>
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>법인</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>통화</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>인원</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>로컬 월 총액</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>현재 KRW</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>시뮬 KRW</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>증감</th>
                  </tr>
                </thead>
                <tbody>
                  {byCompany.map((c: FxCompanyImpact) => (
                    <tr key={c.companyCode} className={TABLE_STYLES.row}>
                      <td className={cn(TABLE_STYLES.cell, 'font-medium')}>{c.companyName}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-center text-xs')}>{c.currency}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums')}>{c.employeeCount}명</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-[#8181A5]')}>
                        {fmtN(c.localMonthlyGross)}
                      </td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(c.currentKRW)}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(c.simulatedKRW)}</td>
                      <td className={cn(
                        TABLE_STYLES.cell, 'text-right tabular-nums font-mono',
                        c.differenceKRW > 0 ? 'text-red-600' : c.differenceKRW < 0 ? 'text-green-600' : 'text-[#8181A5]'
                      )}>
                        {signedKRW(c.differenceKRW)}
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
              <h3 className="text-sm font-semibold text-[#1C1D21] mb-3">환율 민감도 분석</h3>
              <p className="text-xs text-[#8181A5] mb-3">기준 환율 대비 ±5%, ±10% 변동 시 해외 인건비 KRW 총액 변화</p>
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>통화</th>
                      <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>기준율</th>
                      {['-10%', '-5%', '기준', '+5%', '+10%'].map((label) => (
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
                        <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-[#8181A5]')}>
                          {row.baseRate.toLocaleString()}
                        </td>
                        {row.scenarios.map((s, i) => (
                          <td key={i} className={cn(
                            TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-xs',
                            s.differenceKRW > 0 ? 'text-red-600' :
                              s.differenceKRW < 0 ? 'text-green-600' : 'text-[#8181A5]'
                          )}>
                            <div>{fmtMan(s.totalKRW)}</div>
                            {s.differenceKRW !== 0 && (
                              <div className="text-[10px]">{signedKRW(s.differenceKRW)}</div>
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
