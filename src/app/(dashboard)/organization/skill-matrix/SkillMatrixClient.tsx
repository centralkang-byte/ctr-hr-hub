'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
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
  X, AlertTriangle, TrendingUp, TrendingDown,
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
    case 'critical':  return 'bg-destructive/10 text-destructive'
    case 'below':     return 'bg-amber-500/15 text-amber-700'
    case 'meets':     return 'bg-emerald-500/15 text-emerald-700'
    case 'exceeds':   return 'bg-primary/10 text-primary'
    case 'expert':    return 'bg-violet-100 text-violet-800'
    default:          return 'bg-muted text-muted-foreground'
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
  if (avgGap === null) return 'bg-muted text-muted-foreground'
  if (avgGap >= 2)  return 'bg-destructive/10 text-destructive'
  if (avgGap >= 1)  return 'bg-amber-500/15 text-amber-700'
  if (avgGap <= -1) return 'bg-violet-100 text-violet-800'
  return 'bg-emerald-500/15 text-emerald-700'
}

function GapLegend() {
  const t = useTranslations('skills')
  const items = [
    { color: 'bg-destructive/10 border border-destructive/20', labelKey: 'gap.critical', text: 'text-destructive' },
    { color: 'bg-amber-500/15 border border-amber-300', labelKey: 'gap.below', text: 'text-amber-700' },
    { color: 'bg-emerald-500/15 border border-emerald-200', labelKey: 'gap.meets', text: 'text-emerald-700' },
    { color: 'bg-primary/10 border border-primary/20', labelKey: 'gap.exceeds', text: 'text-primary' },
    { color: 'bg-violet-100 border border-violet-200', labelKey: 'gap.expert', text: 'text-violet-800' },
    { color: 'bg-muted border border-border', labelKey: 'gap.unassessed', text: 'text-muted-foreground' },
  ]
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map((i) => (
        <div key={i.labelKey} className="flex items-center gap-1">
          <span className={`w-5 h-5 rounded text-xs flex items-center justify-center font-medium ${i.color} ${i.text}`}>A</span>
          <span className="text-xs text-muted-foreground">{t(i.labelKey)}</span>
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
  const t = useTranslations('skills')
  const [data, setData] = useState<RadarData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get<RadarData>(`/api/v1/skills/radar?employeeId=${employeeId}&period=${period}`)
      .then((res) => setData(res.data))
      .catch((err: unknown) => { toast({ title: t('toast.loadFailed'), description: err instanceof Error ? err.message : t('toast.retryMessage'), variant: 'destructive' }) })
      .finally(() => setLoading(false))
  }, [employeeId, period])

  return (
    <div className={MODAL_STYLES.container}>
      <div className="bg-card rounded-xl shadow-lg w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t('radar.title', { name: data?.employee.name ?? t('radar.employee') })}
            </h2>
            {data?.employee && (
              <p className="text-sm text-muted-foreground">{data.employee.grade} · {period}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !data?.radarData.length ? (
            <EmptyState />
          ) : (
            <>
              {/* KPI 요약 */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: t('radar.criticalGaps'), value: data.summary.criticalGaps, color: 'text-destructive' },
                  { label: t('radar.strengths'), value: data.summary.strengths, color: 'text-emerald-700' },
                  { label: t('radar.achievementRate'), value: `${data.summary.overallProgress}%`, color: 'text-primary' },
                ].map((k) => (
                  <div key={k.label} className="bg-background rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
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
                    name={t('radar.expectedLevel')}
                    dataKey="expected"
                    stroke="#E8E8E8"
                    fill="#E8E8E8"
                    fillOpacity={0.2}
                    strokeDasharray="4 2"
                  />
                  <Radar
                    name={t('radar.currentLevel')}
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

export default function SkillMatrixClient({user: _user,
  departments,
}: {
  user: SessionUser
  departments: { id: string; name: string }[]
}) {
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
    } catch (err) {
      toast({ title: t('toast.loadFailed'), description: err instanceof Error ? err.message : t('toast.retryMessage'), variant: 'destructive' })
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
          <h1 className="text-2xl font-bold text-foreground">{t('skillMatrixTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('skillMatrixDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm"
          >
            <option value="all">{t('filter.allDepartments')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm"
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
            { label: t('kpi.totalEmployees'), value: gapReport.totalEmployees, icon: Users, color: 'text-foreground' },
            { label: t('kpi.completionRate'), value: `${gapReport.completionRate}%`, icon: BarChart2, color: 'text-primary' },
            { label: t('kpi.topGaps'), value: gapReport.topGaps.length, icon: TrendingDown, color: 'text-destructive' },
            { label: t('kpi.strengths'), value: gapReport.topStrengths.length, icon: TrendingUp, color: 'text-emerald-700' },
          ].map((k) => (
            <div key={k.label} className="bg-card rounded-xl shadow-sm border border-border p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <k.icon className="w-4 h-4 text-border" />
              </div>
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 탭 */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="border-b border-border flex">
          {([
            { key: 'matrix', labelKey: 'tabs.matrix' },
            { key: 'dept', labelKey: 'tabs.dept' },
            { key: 'report', labelKey: 'tabs.report' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* ── 직원별 매트릭스 탭 ── */}
              {activeTab === 'matrix' && matrixData && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <GapLegend />
                    <span className="text-xs text-muted-foreground">
                      {t('matrix.cellClickHint')}
                    </span>
                  </div>

                  {matrixData.matrix.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-10 h-10 text-border mx-auto mb-3" />
                      <EmptyState />
                    </div>
                  ) : (
                    <div className={`${TABLE_STYLES.wrapper} overflow-x-auto overflow-y-visible`}>
                      <table className={`${TABLE_STYLES.table} text-xs border-collapse min-w-[600px]`}>
                        <thead className={TABLE_STYLES.header}>
                          {/* 카테고리 헤더 */}
                          <tr>
                            <th className={`${TABLE_STYLES.headerCell} border-r border-border w-36`} rowSpan={2}>
                              {t('matrix.employee')}
                            </th>
                            {Object.values(catGroups).map((cat) => (
                              <th
                                key={cat.name}
                                colSpan={cat.ids.length}
                                className={`${TABLE_STYLES.headerCell} border-l border-border text-center font-semibold bg-background`}
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
                                className={`${TABLE_STYLES.headerCell} border-t border-l border-border text-center`}
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
                              <td className="px-3 py-2 border border-border whitespace-nowrap">
                                <button
                                  onClick={() => setRadarTarget(emp.employeeId)}
                                  className="text-left hover:text-primary transition-colors"
                                >
                                  <p className="font-medium text-foreground">{emp.employeeName}</p>
                                  <p className="text-muted-foreground">{emp.grade} · {emp.department}</p>
                                </button>
                              </td>
                              {emp.scores.map((s) => (
                                <td
                                  key={s.competencyId}
                                  className="border border-border p-0"
                                >
                                  <button
                                    onClick={() => setRadarTarget(emp.employeeId)}
                                    title={
                                      s.status === 'unassessed'
                                        ? t('gap.unassessed')
                                        : `${t('radar.currentLevel')}: ${s.finalLevel ?? '-'} / ${t('radar.expectedLevel')}: ${s.expectedLevel ?? '-'} (${t('report.avgGap')}: ${s.gap ?? '-'})`
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
                    <div className="text-center py-12 text-muted-foreground">{t('empty')}</div>
                  ) : (
                    <div className={`${TABLE_STYLES.wrapper} overflow-x-auto overflow-y-visible`}>
                      <table className={`${TABLE_STYLES.table} text-xs border-collapse min-w-[600px]`}>
                        <thead className={TABLE_STYLES.header}>
                          <tr>
                            <th className={`${TABLE_STYLES.headerCell} border-r border-border w-36`}>
                              {t('matrix.department')}
                            </th>
                            {gapReport.allCompetencyGaps.map((c) => (
                              <th
                                key={c.competencyId}
                                className={`${TABLE_STYLES.headerCell} border-l border-border text-center whitespace-nowrap bg-background`}
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
                              <td className="px-3 py-2 border border-border whitespace-nowrap">
                                <p className="font-medium text-foreground">{row.department.name}</p>
                                <p className="text-muted-foreground">{t('matrix.memberCount', { count: row.memberCount })}</p>
                              </td>
                              {gapReport.allCompetencyGaps.map((c) => {
                                const s = row.scores.find((x) => x.competencyId === c.competencyId)
                                const avg = s?.avgGap ?? null
                                return (
                                  <td
                                    key={c.competencyId}
                                    className={`border border-border text-center h-9 font-medium ${getDeptCellStyle(avg)}`}
                                    title={avg !== null ? `${t('report.avgGap')}: ${avg}` : t('empty')}
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
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      {t('report.topGapsTitle')}
                    </h3>
                    <div className="space-y-2">
                      {gapReport.topGaps.length === 0 ? (
                        <EmptyState />
                      ) : gapReport.topGaps.map((g, i) => (
                        <div key={g.competencyId} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                          <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{g.competencyName}</p>
                            <p className="text-xs text-muted-foreground">{g.category.name} · {t('report.assessmentRate', { rate: g.assessmentRate })}</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive font-medium">
                              {t('report.gapValue', { value: g.avgGap?.toFixed(1) ?? '-' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 강점 역량 */}
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      {t('report.topStrengthsTitle')}
                    </h3>
                    <div className="space-y-2">
                      {gapReport.topStrengths.length === 0 ? (
                        <EmptyState />
                      ) : gapReport.topStrengths.map((g, i) => (
                        <div key={g.competencyId} className="flex items-center gap-3 p-3 bg-background rounded-lg">
                          <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{g.competencyName}</p>
                            <p className="text-xs text-muted-foreground">{g.category.name} · {t('report.assessmentRate', { rate: g.assessmentRate })}</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-700 font-medium">
                              {t('report.exceedValue', { value: g.avgGap?.toFixed(1) ?? '-' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 교육 추천 */}
                  <div className="lg:col-span-2">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary/90" />
                      {t('report.trainingRecommendation')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {gapReport.topGaps.slice(0, 3).map((g) => (
                        <div
                          key={g.competencyId}
                          className="p-4 rounded-xl border border-indigo-100 bg-violet-500/10"
                        >
                          <p className="text-sm font-semibold text-primary/90 mb-1">{g.competencyName}</p>
                          <p className="text-xs text-violet-500 mb-2">{t('report.avgGap')}: {g.avgGap?.toFixed(1)} / {t('report.targetCount')}: {g.assessed}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('report.trainingNote', { category: g.category.name })}
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
