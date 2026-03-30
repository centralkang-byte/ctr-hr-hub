'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용 시뮬레이션 탭
// 신규 채용 계획 입력 → 인건비 영향 분석 (AD-1: DB 경량화, AD-2: Band Quartile)
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { Calculator, Loader2, Plus, Trash2, Save } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { apiClient } from '@/lib/api'
import { CARD_STYLES, TABLE_STYLES, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { Company, Department, SalaryAnchor, HiringResponse, HireGradeBreakdown, SaveScenarioPayload } from './types'

// ─── Types ──────────────────────────────────────────────────

interface GradeInfo {
  id: string
  code: string
  name: string
  employeeCount: number
}

interface BandData {
  min: number; mid: number; max: number
  q1: number; q3: number; currency: string
}

interface HireRow {
  key: number
  gradeCode: string
  headcount: number
  salaryAnchor: SalaryAnchor
  monthlySalary: number
}

interface Props {
  companies: Company[]
  departments: Department[]
  onSaveScenario?: (payload: SaveScenarioPayload) => void
}

// ─── Formatters ─────────────────────────────────────────────

const fmtN = (n: number) => n.toLocaleString('ko-KR')
const fmtKRW = (n: number) => `₩${Math.abs(n).toLocaleString('ko-KR')}`

// ─── Helpers ────────────────────────────────────────────────

function calcQuartile(band: BandData, anchor: SalaryAnchor): number {
  const map = {
    Q1: Math.round(band.q1 / 12),
    MID: Math.round(band.mid / 12),
    Q3: Math.round(band.q3 / 12),
    CUSTOM: 0,
  }
  return map[anchor]
}

function bandHint(band: BandData | undefined): string {
  if (!band) return 'Band 미등록'
  return `₩${fmtN(band.min)}~₩${fmtN(band.max)} (Q1: ₩${fmtN(band.q1)})`
}

// ─── KPI Card ───────────────────────────────────────────────

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={CARD_STYLES.padded}>
      <p className="text-xs text-[#8181A5] mb-1">{label}</p>
      <p className="text-xl font-bold text-[#1C1D21]">{value}</p>
      {sub && <p className="text-xs text-[#8181A5] mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

let rowKeyCounter = 0

export default function HiringTab({ companies, onSaveScenario }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(companies[0]?.id ?? '')
  const [grades, setGrades] = useState<GradeInfo[]>([])
  const [bandMap, setBandMap] = useState<Record<string, BandData>>({})
  const [hires, setHires] = useState<HireRow[]>([])
  const [includeRecruitment, setIncludeRecruitment] = useState(false)
  const [isLoadingGrades, setIsLoadingGrades] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<HiringResponse | null>(null)

  // 법인 변경 → 직급 + SalaryBand 로드
  const loadGrades = useCallback(async (companyId: string) => {
    try {
      setIsLoadingGrades(true)
      setResult(null)
      setHires([])

      // 직급 조회
      const gradeRes = await apiClient.get<GradeInfo[]>(`/api/v1/settings/job-grades?companyId=${companyId}`)
      const gradeList = (gradeRes.data ?? []).sort((a: GradeInfo, b: GradeInfo) =>
        a.code.localeCompare(b.code, undefined, { numeric: true })
      )
      setGrades(gradeList)

      // SalaryBand 조회
      const bandRes = await apiClient.get<Array<{
        jobGrade: { code: string }
        minSalary: string; midSalary: string; maxSalary: string
        currency: string
      }>>(`/api/v1/compensation/salary-bands?companyId=${companyId}`)

      const bands: Record<string, BandData> = {}
      for (const b of (bandRes.data ?? [])) {
        const min = Number(b.minSalary)
        const mid = Number(b.midSalary)
        const max = Number(b.maxSalary)
        bands[b.jobGrade.code] = {
          min, mid, max,
          q1: Math.round(min + (mid - min) * 0.5),
          q3: Math.round(mid + (max - mid) * 0.5),
          currency: b.currency || 'KRW',
        }
      }
      setBandMap(bands)
    } catch {
      toast({ title: '직급/밴드 로드 실패', variant: 'destructive' })
    } finally {
      setIsLoadingGrades(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCompanyId) loadGrades(selectedCompanyId)
  }, [selectedCompanyId, loadGrades])

  // 채용 행 추가
  const addHire = () => {
    const defaultGrade = grades[0]?.code ?? ''
    const band = bandMap[defaultGrade]
    const anchor: SalaryAnchor = 'Q1'
    setHires((prev) => [...prev, {
      key: ++rowKeyCounter,
      gradeCode: defaultGrade,
      headcount: 1,
      salaryAnchor: anchor,
      monthlySalary: band ? calcQuartile(band, anchor) : 0,
    }])
  }

  const removeHire = (key: number) => {
    setHires((prev) => prev.filter((h) => h.key !== key))
  }

  const updateHire = (key: number, field: keyof HireRow, value: string | number) => {
    setHires((prev) => prev.map((h) => {
      if (h.key !== key) return h
      const updated = { ...h, [field]: value }

      // Anchor 또는 직급 변경 시 월급 자동 재계산
      if (field === 'salaryAnchor' || field === 'gradeCode') {
        const band = bandMap[field === 'gradeCode' ? value as string : h.gradeCode]
        const anchor = field === 'salaryAnchor' ? value as SalaryAnchor : h.salaryAnchor
        if (anchor !== 'CUSTOM' && band) {
          updated.monthlySalary = calcQuartile(band, anchor)
        }
        if (field === 'salaryAnchor') updated.salaryAnchor = anchor
        if (field === 'gradeCode') {
          updated.gradeCode = value as string
          // 직급 변경 시 기존 anchor로 재계산
          if (updated.salaryAnchor !== 'CUSTOM' && band) {
            updated.monthlySalary = calcQuartile(band, updated.salaryAnchor)
          }
        }
      }

      return updated
    }))
  }

  // 시뮬레이션 실행
  const runSimulation = async () => {
    if (hires.length === 0) {
      toast({ title: '채용 계획을 추가해주세요.', variant: 'destructive' })
      return
    }

    try {
      setIsLoading(true)
      const res = await apiClient.post<HiringResponse>('/api/v1/payroll/simulation', {
        mode: 'HIRING',
        parameters: {
          companyId: selectedCompanyId,
          hires: hires.map((h) => ({
            gradeCode: h.gradeCode,
            headcount: h.headcount,
            salaryAnchor: h.salaryAnchor,
            ...(h.salaryAnchor === 'CUSTOM' ? { monthlySalary: h.monthlySalary } : {}),
          })),
          includeRecruitmentCosts: includeRecruitment,
        },
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

  const summary = result?.summary
  const byGrade = summary?.byGrade ?? []

  // 차트 데이터
  const chartData = byGrade.map((g: HireGradeBreakdown) => ({
    직급: g.grade,
    '1인당 총지급액': Math.round(g.grossPerPerson / 10000),
    '전체 추가비용': Math.round(g.totalMonthlyGross / 10000),
  }))

  const totalHireCount = hires.reduce((s, h) => s + h.headcount, 0)

  return (
    <div className="space-y-6">
      {/* ── 입력 영역 ── */}
      <div className={CARD_STYLES.padded}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#1C1D21]">채용 계획 입력</h3>
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
            직급/밴드 로딩 중...
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
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right w-20')}>인원</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'w-28')}>기준점</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right w-32')}>월급</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-xs text-[#8181A5]')}>Band 참고</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'w-10')} />
                  </tr>
                </thead>
                <tbody>
                  {hires.map((h) => (
                    <tr key={h.key} className={TABLE_STYLES.row}>
                      <td className={TABLE_STYLES.cell}>
                        <select
                          value={h.gradeCode}
                          onChange={(e) => updateHire(h.key, 'gradeCode', e.target.value)}
                          className="text-sm border border-[#E2E8F0] rounded px-2 py-1 bg-white w-full"
                        >
                          {grades.map((g) => (
                            <option key={g.id} value={g.code}>{g.code} — {g.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right')}>
                        <input
                          type="number" min={1} max={100}
                          value={h.headcount}
                          onChange={(e) => updateHire(h.key, 'headcount', Math.max(1, Number(e.target.value)))}
                          className="w-16 text-right border border-[#E2E8F0] rounded px-2 py-1 text-sm font-mono"
                        />
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        <select
                          value={h.salaryAnchor}
                          onChange={(e) => updateHire(h.key, 'salaryAnchor', e.target.value)}
                          className="text-sm border border-[#E2E8F0] rounded px-2 py-1 bg-white w-full"
                        >
                          <option value="Q1">Q1 (하위25%)</option>
                          <option value="MID">Mid (중간)</option>
                          <option value="Q3">Q3 (상위25%)</option>
                          <option value="CUSTOM">직접입력</option>
                        </select>
                      </td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right')}>
                        <input
                          type="number" min={0}
                          value={h.monthlySalary}
                          disabled={h.salaryAnchor !== 'CUSTOM'}
                          onChange={(e) => updateHire(h.key, 'monthlySalary', Number(e.target.value))}
                          className={cn(
                            'w-28 text-right border border-[#E2E8F0] rounded px-2 py-1 text-sm font-mono',
                            h.salaryAnchor !== 'CUSTOM' && 'bg-[#F5F5FA] text-[#8181A5]'
                          )}
                        />
                      </td>
                      <td className={cn(TABLE_STYLES.cell, 'text-xs text-[#8181A5]')}>
                        {bandHint(bandMap[h.gradeCode])}
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        <button onClick={() => removeHire(h.key)} className="text-[#8181A5] hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={addHire}
                  className="flex items-center gap-1 text-sm text-[#5E81F4] hover:text-[#4F46E5] font-medium"
                >
                  <Plus className="w-4 h-4" /> 채용 행 추가
                </button>

                <label className="flex items-center gap-2 text-sm text-[#64748B]">
                  <input
                    type="checkbox"
                    checked={includeRecruitment}
                    onChange={(e) => setIncludeRecruitment(e.target.checked)}
                    className="rounded border-[#E2E8F0]"
                  />
                  채용비용 포함
                </label>

                {totalHireCount > 0 && (
                  <span className="text-xs text-[#8181A5]">총 {totalHireCount}명</span>
                )}
              </div>

              <button
                onClick={runSimulation}
                disabled={isLoading || hires.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg text-sm font-medium hover:bg-[#4338CA] disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                시뮬레이션 실행
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── 결과 KPI ── */}
      {summary && (
        <>
          {onSaveScenario && (
            <div className="flex justify-end mb-3">
              <button onClick={() => onSaveScenario({
                mode: 'HIRING',
                companyId: selectedCompanyId,
                parameters: { companyId: selectedCompanyId, hires: hires.map(h => ({ gradeCode: h.gradeCode, headcount: h.headcount, salaryAnchor: h.salaryAnchor, monthlySalary: h.monthlySalary })) },
                results: result as unknown as Record<string, unknown>,
              })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5E81F4] border border-[#5E81F4]/30 rounded-lg hover:bg-[#5E81F4]/5">
                <Save className="w-3.5 h-3.5" /> 시나리오 저장
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="현재 총 인건비 (세전/월)"
              value={fmtKRW(summary.currentMonthlyGross)}
              sub={`${summary.currentHeadcount}명`}
            />
            <KPICard
              label="신규 채용 비용 (월)"
              value={fmtKRW(summary.newHireMonthlyGross)}
              sub={`${summary.newHireCount}명`}
            />
            <KPICard
              label="예상 총 인건비 (월)"
              value={fmtKRW(summary.projectedMonthlyGross)}
              sub={`${summary.currentHeadcount + summary.newHireCount}명`}
            />
            <KPICard
              label="연간 추가 비용"
              value={fmtKRW(summary.annualAdditionalCost)}
              sub="신규 채용분 × 12"
            />
          </div>

          {/* ── 직급별 비용 차트 ── */}
          {chartData.length > 0 && (
            <div className={CARD_STYLES.padded}>
              <h3 className="text-sm font-semibold text-[#1C1D21] mb-4">직급별 채용 비용 (만원)</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid {...CHART_THEME.grid} />
                  <XAxis dataKey="직급" {...CHART_THEME.axis} />
                  <YAxis {...CHART_THEME.axis} />
                  <Tooltip {...CHART_THEME.tooltip} />
                  <Legend {...CHART_THEME.legend} />
                  <Bar dataKey="1인당 총지급액" fill={CHART_THEME.colors[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="전체 추가비용" fill={CHART_THEME.colors[2]} radius={[4, 4, 0, 0]} />
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
                    <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>기준점</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>1인 Gross</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>1인 공제</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>1인 Net</th>
                    <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>전체 Gross (월)</th>
                  </tr>
                </thead>
                <tbody>
                  {byGrade.map((g: HireGradeBreakdown, i: number) => (
                    <tr key={i} className={TABLE_STYLES.row}>
                      <td className={cn(TABLE_STYLES.cell, 'font-mono font-medium')}>{g.grade}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums')}>{g.headcount}명</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-center text-xs text-[#8181A5]')}>{g.salaryAnchor}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(g.grossPerPerson)}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-red-500')}>{fmtKRW(g.deductionsPerPerson)}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(g.netPerPerson)}</td>
                      <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono font-semibold')}>{fmtKRW(g.totalMonthlyGross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 채용비용 테이블 ── */}
          {summary.recruitmentCosts && summary.recruitmentCosts.length > 0 && (
            <div className={CARD_STYLES.padded}>
              <h3 className="text-sm font-semibold text-[#1C1D21] mb-3">채용비용 추정</h3>
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>비용 유형</th>
                      <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>건당 평균</th>
                      <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>총 예상 ({summary.newHireCount}명)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recruitmentCosts.map((c, i) => (
                      <tr key={i} className={TABLE_STYLES.row}>
                        <td className={TABLE_STYLES.cell}>{c.costType}</td>
                        <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono')}>{fmtKRW(c.avgAmount)}</td>
                        <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono font-semibold')}>{fmtKRW(c.totalForHires)}</td>
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
