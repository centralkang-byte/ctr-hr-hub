'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 스킬 매트릭스 Client (B8-3)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Legend, Tooltip as ReTooltip,
} from 'recharts'
import {
  X, ChevronDown, AlertTriangle, TrendingUp, TrendingDown,
  Users, BookOpen, BarChart2,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { TABLE_STYLES, CHART_THEME, MODAL_STYLES } from '@/lib/styles'

// ── 타입 ──────────────────────────────────────────────────

type MatrixScore = {
  competencyId: string
  status: 'unassessed' | 'expert' | 'critical' | 'below' | 'meets' | 'exceeds'
  finalLevel: number | null
  expectedLevel: number | null
  gap: number | null
}

type MatrixEmployee = {
  employeeId: string
  employeeName: string
  grade: string
  department: string
  scores: MatrixScore[]
}

type CompetencyMeta = {
  id: string
  name: string
  category: { id: string; name: string }
}

type TopGap = {
  competencyId: string
  competencyName: string
  category: { id: string; name: string; code: string }
  avgGap: number | null
  assessed: number
  total: number
  assessmentRate: number
}

type DeptMatrixRow = {
  department: { id: string; name: string }
  memberCount: number
  scores: { competencyId: string; avgGap: number | null }[]
}

type MatrixData = {
  matrix: MatrixEmployee[]
  competencies: CompetencyMeta[]
  summary: {
    topGaps: { competencyId: string; competencyName: string; avgGap: number }[]
    avgAssessmentRate: number
  }
}

type GapReportData = {
  period: string
  totalEmployees: number
  completionRate: number
  topGaps: TopGap[]
  topStrengths: TopGap[]
  allCompetencyGaps: TopGap[]
  departmentMatrix: DeptMatrixRow[]
}

type RadarData = {
  radarData: { subject: string; actual: number; expected: number; fullMark: number }[]
  summary: { criticalGaps: number; strengths: number; overallProgress: number }
  employee: { name: string; grade: string }
}

// ── 헬퍼 ──────────────────────────────────────────────────

function getCellStyle(status: MatrixScore['status']) {
  switch (status) {
    case 'critical':  return 'bg-[#FEE2E2] text-[#B91C1C]'
    case 'below':     return 'bg-[#FEF3C7] text-[#B45309]'
    case 'meets':     return 'bg-[#D1FAE5] text-[#047857]'
    case 'exceeds':   return 'bg-[#DBEAFE] text-[#1D4ED8]'
    case 'expert':    return 'bg-[#EDE9FE] text-[#5B21B6]'
    default:          return 'bg-[#F5F5F5] text-[#999]'
  }
}

function getCellLabel(status: MatrixScore['status'], gap: number | null) {
  if (status === 'unassessed') return '–'
  if (gap === null) return '–'
  if (gap >= 2)  return `-${gap}`
  if (gap === 1) return '-1'
  if (gap === 0) return '✓'
  return `+${Math.abs(gap)}`
}

function getDeptCellStyle(avgGap: number | null) {
  if (avgGap === null) return 'bg-[#F5F5F5] text-[#999]'
  if (avgGap >= 2)  return 'bg-[#FEE2E2] text-[#B91C1C]'
  if (avgGap >= 1)  return 'bg-[#FEF3C7] text-[#B45309]'
  if (avgGap <= -1) return 'bg-[#EDE9FE] text-[#5B21B6]'
  return 'bg-[#D1FAE5] text-[#047857]'
}

function GapLegend() {
  const items = [
    { color: 'bg-[#FEE2E2] border border-[#FECACA]', label: '미달 (≥2)', text: 'text-[#B91C1C]' },
    { color: 'bg-[#FEF3C7] border border-[#FCD34D]', label: '부족 (1)', text: 'text-[#B45309]' },
    { color: 'bg-[#D1FAE5] border border-[#A7F3D0]', label: '충족 (0)', text: 'text-[#047857]' },
    { color: 'bg-[#DBEAFE] border border-[#BFDBFE]', label: '초과', text: 'text-[#1D4ED8]' },
    { color: 'bg-[#EDE9FE] border border-[#DDD6FE]', label: '전문가 (5)', text: 'text-[#5B21B6]' },
    { color: 'bg-[#F5F5F5] border border-[#E8E8E8]', label: '미평가', text: 'text-[#999]' },
  ]
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1">
          <span className={`w-5 h-5 rounded text-xs flex items-center justify-center font-medium ${i.color} ${i.text}`}>A</span>
          <span className="text-xs text-[#666]">{i.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── 레이더 차트 모달 ──────────────────────────────────────

function RadarModal({
  employeeId,
  period,
  onClose,
}: {
  employeeId: string
  period: string
  onClose: () => void
}) {
  const [data, setData] = useState<RadarData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get<RadarData>(`/api/v1/skills/radar?employeeId=${employeeId}&period=${period}`)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [employeeId, period])

  return (
    <div className={MODAL_STYLES.container}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b border-[#E8E8E8]">
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A1A]">
              {data?.employee.name ?? '직원'} 역량 레이더
            </h2>
            {data?.employee && (
              <p className="text-sm text-[#666]">{data.employee.grade} · {period}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#666]" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-6 h-6 border-2 border-[#5E81F4] border-t-transparent rounded-full" />
            </div>
          ) : !data?.radarData.length ? (
            <EmptyState />
          ) : (
            <>
              {/* KPI 요약 */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: '미달 역량', value: data.summary.criticalGaps, color: 'text-[#B91C1C]' },
                  { label: '강점 역량', value: data.summary.strengths, color: 'text-[#047857]' },
                  { label: '달성률', value: `${data.summary.overallProgress}%`, color: 'text-[#5E81F4]' },
                ].map((k) => (
                  <div key={k.label} className="bg-[#FAFAFA] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#666]">{k.label}</p>
                    <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* 레이더 차트 */}
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={data.radarData}>
                  <PolarGrid stroke="#E8E8E8" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#555' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10, fill: '#999' }} />
                  <Radar
                    name="기대 수준"
                    dataKey="expected"
                    stroke="#E8E8E8"
                    fill="#E8E8E8"
                    fillOpacity={0.2}
                    strokeDasharray="4 2"
                  />
                  <Radar
                    name="현재 수준"
                    dataKey="actual"
                    stroke={CHART_THEME.colors[3]}
                    fill={CHART_THEME.colors[3]}
                    fillOpacity={0.3}
                  />
                  <Legend
                    iconType="line"
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <ReTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E8E8E8' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function SkillMatrixClient({user,
  departments,
}: {
  user: SessionUser
  departments: { id: string; name: string }[]
}) {
  const tCommon = useTranslations('common')
  const t = useTranslations('skills')
  const [period, setPeriod] = useState('2026-H1')
  const [deptId, setDeptId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'matrix' | 'dept' | 'report'>('matrix')

  const [matrixData, setMatrixData] = useState<MatrixData | null>(null)
  const [gapReport, setGapReport] = useState<GapReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const [radarTarget, setRadarTarget] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (deptId !== 'all') params.set('departmentId', deptId)

      const [matrix, report] = await Promise.all([
        apiClient.get<MatrixData>(`/api/v1/skills/matrix?${params.toString()}`),
        apiClient.get<GapReportData>(`/api/v1/skills/gap-report?period=${period}`),
      ])
      setMatrixData(matrix.data)
      setGapReport(report.data)
    } catch {
      // 에러 무시
    } finally {
      setLoading(false)
    }
  }, [period, deptId])

  useEffect(() => { void loadData() }, [loadData])

  const competencies = matrixData?.competencies ?? []

  // 카테고리별 역량 그룹핑 (컬럼 헤더용)
  const catGroups = competencies.reduce<Record<string, { name: string; ids: string[] }>>((acc, c) => {
    const key = c.category.id
    if (!acc[key]) acc[key] = { name: c.category.name, ids: [] }
    acc[key].ids.push(c.id)
    return acc
  }, {})

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('skillMatrixTitle')}</h1>
          <p className="text-sm text-[#666] mt-1">팀/조직 역량 수준을 히트맵으로 확인하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
          >
            <option value="all">전체 부서</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
          >
            {['2025-H1', '2025-H2', '2026-H1', 'latest'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI 카드 */}
      {gapReport && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '전체 직원', value: gapReport.totalEmployees, icon: Users, color: 'text-[#1A1A1A]' },
            { label: '평가 완료율', value: `${gapReport.completionRate}%`, icon: BarChart2, color: 'text-[#5E81F4]' },
            { label: '주요 갭 역량', value: gapReport.topGaps.length, icon: TrendingDown, color: 'text-[#B91C1C]' },
            { label: '강점 역량', value: gapReport.topStrengths.length, icon: TrendingUp, color: 'text-[#047857]' },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#666]">{k.label}</p>
                <k.icon className="w-4 h-4 text-[#D4D4D4]" />
              </div>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 탭 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
        <div className="border-b border-[#E8E8E8] flex">
          {([
            { key: 'matrix', label: '직원별 매트릭스' },
            { key: 'dept', label: '부서별 집계' },
            { key: 'report', label: '갭 리포트' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-[#5E81F4] text-[#5E81F4]'
                  : 'border-transparent text-[#666] hover:text-[#333]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-6 h-6 border-2 border-[#5E81F4] border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* ── 직원별 매트릭스 탭 ── */}
              {activeTab === 'matrix' && matrixData && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <GapLegend />
                    <span className="text-xs text-[#666]">
                      셀 클릭 → 레이더 차트
                    </span>
                  </div>

                  {matrixData.matrix.length === 0 ? (
                    <div className="text-center py-12 text-[#666]">
                      <Users className="w-10 h-10 text-[#E8E8E8] mx-auto mb-3" />
                      <EmptyState />
                    </div>
                  ) : (
                    <div className={`${TABLE_STYLES.wrapper} overflow-x-auto overflow-y-visible`}>
                      <table className={`${TABLE_STYLES.table} text-xs border-collapse min-w-[600px]`}>
                        <thead className={TABLE_STYLES.header}>
                          {/* 카테고리 헤더 */}
                          <tr>
                            <th className={`${TABLE_STYLES.headerCell} border-r border-[#F0F0F3] w-36`} rowSpan={2}>
                              직원
                            </th>
                            {Object.values(catGroups).map((cat) => (
                              <th
                                key={cat.name}
                                colSpan={cat.ids.length}
                                className={`${TABLE_STYLES.headerCell} border-l border-[#F0F0F3] text-center font-semibold bg-[#FAFAFA]`}
                              >
                                {cat.name}
                              </th>
                            ))}
                          </tr>
                          {/* 역량명 헤더 */}
                          <tr>
                            {competencies.map((c) => (
                              <th
                                key={c.id}
                                className={`${TABLE_STYLES.headerCell} border-t border-l border-[#F0F0F3] text-center`}
                                title={c.name}
                              >
                                {c.name.length > 6 ? `${c.name.slice(0, 6)}…` : c.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {matrixData.matrix.map((emp) => (
                            <tr key={emp.employeeId} className={TABLE_STYLES.row}>
                              <td className="px-3 py-2 border border-[#E8E8E8] whitespace-nowrap">
                                <button
                                  onClick={() => setRadarTarget(emp.employeeId)}
                                  className="text-left hover:text-[#5E81F4] transition-colors"
                                >
                                  <p className="font-medium text-[#1A1A1A]">{emp.employeeName}</p>
                                  <p className="text-[#999]">{emp.grade} · {emp.department}</p>
                                </button>
                              </td>
                              {emp.scores.map((s) => (
                                <td
                                  key={s.competencyId}
                                  className="border border-[#E8E8E8] p-0"
                                >
                                  <button
                                    onClick={() => setRadarTarget(emp.employeeId)}
                                    title={
                                      s.status === 'unassessed'
                                        ? '미평가'
                                        : `현재: ${s.finalLevel ?? '-'} / 기대: ${s.expectedLevel ?? '-'} (갭: ${s.gap ?? '-'})`
                                    }
                                    className={`w-full h-9 flex items-center justify-center font-medium transition-opacity hover:opacity-80 ${getCellStyle(s.status)}`}
                                  >
                                    {getCellLabel(s.status, s.gap)}
                                  </button>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── 부서별 집계 탭 ── */}
              {activeTab === 'dept' && gapReport && (
                <div>
                  <div className="mb-3">
                    <GapLegend />
                  </div>
                  {gapReport.departmentMatrix.length === 0 ? (
                    <div className="text-center py-12 text-[#666]">데이터가 없습니다.</div>
                  ) : (
                    <div className={`${TABLE_STYLES.wrapper} overflow-x-auto overflow-y-visible`}>
                      <table className={`${TABLE_STYLES.table} text-xs border-collapse min-w-[600px]`}>
                        <thead className={TABLE_STYLES.header}>
                          <tr>
                            <th className={`${TABLE_STYLES.headerCell} border-r border-[#F0F0F3] w-36`}>
                              부서
                            </th>
                            {gapReport.allCompetencyGaps.map((c) => (
                              <th
                                key={c.competencyId}
                                className={`${TABLE_STYLES.headerCell} border-l border-[#F0F0F3] text-center whitespace-nowrap bg-[#FAFAFA]`}
                                title={c.competencyName}
                              >
                                {c.competencyName.length > 6 ? `${c.competencyName.slice(0, 6)}…` : c.competencyName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {gapReport.departmentMatrix.map((row) => (
                            <tr key={row.department.id} className={TABLE_STYLES.row}>
                              <td className="px-3 py-2 border border-[#E8E8E8] whitespace-nowrap">
                                <p className="font-medium text-[#1A1A1A]">{row.department.name}</p>
                                <p className="text-[#999]">{row.memberCount}명</p>
                              </td>
                              {gapReport.allCompetencyGaps.map((c) => {
                                const s = row.scores.find((x) => x.competencyId === c.competencyId)
                                const avg = s?.avgGap ?? null
                                return (
                                  <td
                                    key={c.competencyId}
                                    className={`border border-[#E8E8E8] text-center h-9 font-medium ${getDeptCellStyle(avg)}`}
                                    title={avg !== null ? `평균 갭: ${avg}` : '데이터 없음'}
                                  >
                                    {avg !== null ? (avg >= 0 ? `+${avg}` : `${avg}`) : '–'}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── 갭 리포트 탭 ── */}
              {activeTab === 'report' && gapReport && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top 갭 역량 */}
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                      개선 필요 역량 Top 5
                    </h3>
                    <div className="space-y-2">
                      {gapReport.topGaps.length === 0 ? (
                        <EmptyState />
                      ) : gapReport.topGaps.map((g, i) => (
                        <div key={g.competencyId} className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-lg">
                          <span className="text-sm font-bold text-[#999] w-5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1A1A] truncate">{g.competencyName}</p>
                            <p className="text-xs text-[#666]">{g.category.name} · 평가율 {g.assessmentRate}%</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[#FEE2E2] text-[#B91C1C] font-medium">
                              갭 +{g.avgGap?.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 강점 역량 */}
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#059669]" />
                      강점 역량 Top 5
                    </h3>
                    <div className="space-y-2">
                      {gapReport.topStrengths.length === 0 ? (
                        <EmptyState />
                      ) : gapReport.topStrengths.map((g, i) => (
                        <div key={g.competencyId} className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-lg">
                          <span className="text-sm font-bold text-[#999] w-5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1A1A] truncate">{g.competencyName}</p>
                            <p className="text-xs text-[#666]">{g.category.name} · 평가율 {g.assessmentRate}%</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-[#D1FAE5] text-[#047857] font-medium">
                              초과 {g.avgGap?.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 교육 추천 */}
                  <div className="lg:col-span-2">
                    <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#4B6DE0]" />
                      교육 추천 (갭 기반)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {gapReport.topGaps.slice(0, 3).map((g) => (
                        <div
                          key={g.competencyId}
                          className="p-4 rounded-xl border border-[#E0E7FF] bg-[#F5F3FF]"
                        >
                          <p className="text-sm font-semibold text-[#4B6DE0] mb-1">{g.competencyName}</p>
                          <p className="text-xs text-[#8B5CF6] mb-2">평균 갭: {g.avgGap?.toFixed(1)} / 대상: {g.assessed}명</p>
                          <p className="text-xs text-[#555]">
                            {g.category.name} 역량 강화를 위한 교육 과정을 검토하세요.
                          </p>
                        </div>
                      ))}
                      {gapReport.topGaps.length === 0 && (
                        <EmptyState />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 레이더 모달 */}
      {radarTarget && (
        <RadarModal
          employeeId={radarTarget}
          period={period}
          onClose={() => setRadarTarget(null)}
        />
      )}
    </div>
  )
}
