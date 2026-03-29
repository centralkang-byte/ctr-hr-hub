'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compa-Ratio 분포 탭
// 로컬 통화 기준 compa-ratio 히스토그램 + 아웃라이어 리스트
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
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
        title: '보상 분포 로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedCompanyId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#8181A5]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        보상 분포 분석 중...
      </div>
    )
  }

  if (!data || data.summary.coveredEmployees === 0) {
    return <EmptyState title="Compa-Ratio 데이터 없음" description="급여 밴드가 설정된 직원이 없습니다." />
  }

  const { distribution, byGrade, outliers, summary } = data

  return (
    <div className="space-y-6">
      {/* ── 필터 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#1C1D21]">보상 경쟁력 분포</h3>
          <p className="text-xs text-[#8181A5] mt-0.5">
            Compa-Ratio = 현재 연봉 / 밴드 중앙값 (로컬 통화 기준)
          </p>
        </div>
        <select
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          className="text-sm border border-[#E2E8F0] rounded-md px-3 py-1.5 bg-white"
        >
          <option value="">전체 법인</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* ── 요약 KPI ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#8181A5]">대상 인원</p>
          <p className="text-xl font-bold text-[#1C1D21]">{summary.coveredEmployees}<span className="text-sm font-normal text-[#8181A5]">/{summary.totalEmployees}명</span></p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#8181A5]">평균 Compa-Ratio</p>
          <p className="text-xl font-bold text-[#1C1D21]">{summary.avg.toFixed(2)}</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#8181A5]">중앙값</p>
          <p className="text-xl font-bold text-[#1C1D21]">{summary.median.toFixed(2)}</p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#8181A5]">저보상 (&lt;0.8)</p>
          <p className="text-xl font-bold text-red-600">
            <TrendingDown className="w-4 h-4 inline mr-1" />{summary.belowBand}명
          </p>
        </div>
        <div className={CARD_STYLES.padded}>
          <p className="text-xs text-[#8181A5]">고보상 (&gt;1.2)</p>
          <p className="text-xl font-bold text-amber-600">
            <TrendingUp className="w-4 h-4 inline mr-1" />{summary.aboveBand}명
          </p>
        </div>
      </div>

      {/* ── 히스토그램 ── */}
      <div className={CARD_STYLES.padded}>
        <h3 className="text-sm font-semibold text-[#1C1D21] mb-4">Compa-Ratio 분포</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={distribution} barCategoryGap="20%">
            <CartesianGrid {...CHART_THEME.grid} />
            <XAxis dataKey="range" {...CHART_THEME.axis} />
            <YAxis {...CHART_THEME.axis} label={{ value: '인원', angle: -90, position: 'insideLeft', ...CHART_THEME.axis.label }} />
            <Tooltip {...CHART_THEME.tooltip} formatter={(v) => [`${v}명`, '인원']} />
            <ReferenceLine x="0.8–0.9" stroke="#DC2626" strokeDasharray="3 3" label={{ value: '저보상', fill: '#DC2626', fontSize: 11 }} />
            <ReferenceLine x="1.1–1.2" stroke="#DC2626" strokeDasharray="3 3" label={{ value: '고보상', fill: '#DC2626', fontSize: 11 }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {distribution.map((entry: CompaRatioDistBucket) => (
                <Cell key={entry.range} fill={BUCKET_COLORS[entry.range] ?? CHART_THEME.colors[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-[#8181A5]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> 이탈 (&lt;0.8 / &gt;1.2)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" /> 주의 (0.7–0.8)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600" /> 적정 (0.9–1.1)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> 관리 영역</span>
        </div>
      </div>

      {/* ── 직급별 평균 ── */}
      <div className={CARD_STYLES.padded}>
        <h3 className="text-sm font-semibold text-[#1C1D21] mb-3">직급별 평균 Compa-Ratio</h3>
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>직급</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>인원</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>평균</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>최소</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>최대</th>
                <th className={TABLE_STYLES.headerCell}>분포 바</th>
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
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums')}>{g.employees}명</td>
                    <td className={cn(
                      TABLE_STYLES.cell, 'text-right tabular-nums font-mono font-medium',
                      g.avgCompaRatio < 0.8 ? 'text-red-600' : g.avgCompaRatio > 1.2 ? 'text-amber-600' : 'text-[#1C1D21]'
                    )}>
                      {g.avgCompaRatio.toFixed(3)}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-[#8181A5]')}>{g.minRatio.toFixed(2)}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-[#8181A5]')}>{g.maxRatio.toFixed(2)}</td>
                    <td className={cn(TABLE_STYLES.cell, 'min-w-[120px]')}>
                      <div className="relative h-4 bg-[#F1F5F9] rounded-full overflow-hidden">
                        {/* Range bar */}
                        <div
                          className="absolute h-full bg-[#4F46E5]/20 rounded-full"
                          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                        />
                        {/* Average marker */}
                        <div
                          className="absolute top-0 w-0.5 h-full bg-[#4F46E5]"
                          style={{ left: `${avgPos}%` }}
                        />
                        {/* 1.0 reference */}
                        <div
                          className="absolute top-0 w-px h-full bg-[#DC2626]/30"
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
            <h3 className="text-sm font-semibold text-[#1C1D21]">관심 필요 직원 ({outliers.length}명)</h3>
          </div>
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>이름</th>
                  <th className={TABLE_STYLES.headerCell}>직급</th>
                  <th className={TABLE_STYLES.headerCell}>부서</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>Compa-Ratio</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>현재 연봉</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>밴드 범위</th>
                  <th className={TABLE_STYLES.headerCell}>상태</th>
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
                    <td className={cn(TABLE_STYLES.cell, 'text-right tabular-nums font-mono text-[#8181A5] text-xs')}>
                      {o.bandMin.toLocaleString('ko-KR')} ~ {o.bandMax.toLocaleString('ko-KR')}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        o.compaRatio < 0.8 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      )}>
                        {o.compaRatio < 0.8 ? '저보상' : '고보상'}
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
