'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 차등 인상 시뮬레이션 탭
// 직급별 차등 인상률 입력 → 비용 변화 + Band Violation 경고
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { AlertTriangle, Calculator, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { apiClient } from '@/lib/api'
import { CARD_STYLES, TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { Company, DifferentialResponse, GradeBreakdown } from './types'

// ─── Types ──────────────────────────────────────────────────

interface GradeInfo {
  id: string
  code: string
  name: string
  employeeCount: number
}

interface Props {
  companies: Company[]
}

// ─── Formatters ─────────────────────────────────────────────

const fmtKRW = (n: number) => `₩${Math.abs(n).toLocaleString('ko-KR')}`
const signedKRW = (n: number) => n === 0 ? '₩0' : `${n > 0 ? '+' : '-'}${fmtKRW(n)}`
const pctStr = (r: number) => `${r >= 0 ? '+' : ''}${(r * 100).toFixed(1)}%`

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

export default function DifferentialTab({ companies }: Props) {
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
      toast({ title: '직급 로드 실패', variant: 'destructive' })
    } finally {
      setIsLoadingGrades(false)
    }
  }, [])

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
        title: '시뮬레이션 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
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

  // 차트 데이터
  const chartData = byGrade.map((g: GradeBreakdown) => ({
    grade: g.grade,
    현재: Math.round(g.currentGross / 10000),
    시뮬레이션: Math.round(g.simulatedGross / 10000),
    인상률: `${(g.rate * 100).toFixed(1)}%`,
  }))

  return (
    <div className="space-y-6">
      {/* ── 입력 영역 ── */}
      <div className={CARD_STYLES.padded}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#1C1D21]">직급별 차등 인상률</h3>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="text-sm border border-[#E2E8F0] rounded-md px-3 py-1.5 bg-white"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {isLoadingGrades ? (
          <div className="flex items-center justify-center py-8 text-[#8181A5]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            직급 로딩 중...
          </div>
        ) : grades.length === 0 ? (
          <p className="text-sm text-[#8181A5] py-4">해당 법인에 등록된 직급이 없습니다.</p>
        ) : (
          <>
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>직급</th>
                    <th className={TABLE_STYLES.headerCell}>직급명</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>인상률 (%)</th>
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
                          className="w-20 text-right border border-[#E2E8F0] rounded px-2 py-1 text-sm font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-2 text-sm text-[#64748B]">
                <input
                  type="checkbox"
                  checked={capAtBandMax}
                  onChange={(e) => setCapAtBandMax(e.target.checked)}
                  className="rounded border-[#E2E8F0]"
                />
                밴드 상한 초과 시 자동 캡핑
              </label>
              <button
                onClick={runSimulation}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg text-sm font-medium hover:bg-[#4338CA] disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                시뮬레이션 실행
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Band Violation 경고 ── */}
      {violations && violations.count > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {violations.count}명의 직원이 급여 밴드 상한을 초과합니다
              {capAtBandMax && ' (자동 캡핑 적용됨)'}
            </p>
            <div className="mt-2 space-y-1">
              {violations.employees.slice(0, 5).map((v, i) => (
                <p key={i} className="text-xs text-red-700">
                  {v.name} ({v.grade}) — 시뮬레이션 {fmtKRW(v.simulatedSalary)} &gt; 밴드 상한 {fmtKRW(v.maxSalary)}
                  {v.capped && ' → 캡핑됨'}
                </p>
              ))}
              {violations.employees.length > 5 && (
                <p className="text-xs text-red-500">... 외 {violations.employees.length - 5}명</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 결과 KPI ── */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="대상인원"
              value={`${summary.employeeCount}명`}
            />
            <KPICard
              label="현재 총 지급액"
              value={fmtKRW(summary.totals.currentGross)}
            />
            <KPICard
              label="시뮬레이션 총 지급액"
              value={fmtKRW(summary.totals.simulatedGross)}
              diff={pctStr(summary.totals.grossChangeRate)}
              variant="cost"
            />
            <KPICard
              label="증감액"
              value={signedKRW(summary.totals.grossDifference)}
              diff={pctStr(summary.totals.grossChangeRate)}
              variant="cost"
            />
          </div>

          {/* ── 직급별 비교 차트 ── */}
          {chartData.length > 0 && (
            <div className={CARD_STYLES.padded}>
              <h3 className="text-sm font-semibold text-[#1C1D21] mb-4">직급별 총 지급액 비교 (만원)</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid {...CHART_THEME.grid} />
                  <XAxis dataKey="grade" {...CHART_THEME.axis} />
                  <YAxis {...CHART_THEME.axis} />
                  <Tooltip {...CHART_THEME.tooltip} />
                  <Legend {...CHART_THEME.legend} />
                  <Bar dataKey="현재" fill={CHART_THEME.colors[5]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="시뮬레이션" fill={CHART_THEME.colors[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── 직급별 상세 테이블 ── */}
          <div className={CARD_STYLES.padded}>
            <h3 className="text-sm font-semibold text-[#1C1D21] mb-3">직급별 상세</h3>
            <div className={TABLE_STYLES.wrapper}>
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>직급</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>인원</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>인상률</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>현재 총액</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>시뮬레이션</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>증감</th>
                  </tr>
                </thead>
                <tbody>
                  {byGrade.map((g: GradeBreakdown) => (
                    <tr key={g.grade} className={TABLE_STYLES.row}>
                      <td className={cn(TABLE_STYLES.cell, 'font-mono font-medium')}>{g.grade}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums')}>{g.employeeCount}명</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{(g.rate * 100).toFixed(1)}%</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(g.currentGross)}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(g.simulatedGross)}</td>
                      <td className={cn(
                        TABLE_STYLES.cell, 'text-right tabular-nums font-mono',
                        g.difference > 0 ? 'text-primary' : g.difference < 0 ? 'text-red-600' : 'text-[#8181A5]'
                      )}>
                        {signedKRW(g.difference)}
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
