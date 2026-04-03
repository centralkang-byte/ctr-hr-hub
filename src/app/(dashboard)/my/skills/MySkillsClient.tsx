'use client'

import { useTranslations } from 'next-intl'
import { toast } from '@/hooks/use-toast'
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 나의 역량 자기평가 Client (B8-3)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  Target, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle,
  Radar, Save, Send, BookOpen,
} from 'lucide-react'
import { BUTTON_VARIANTS, CHART_THEME } from '@/lib/styles'
import type { SessionUser } from '@/types'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar,
  ResponsiveContainer, Legend, Tooltip,
} from 'recharts'

// ── 타입 ──────────────────────────────────────────────────

type CompetencyLevel = { level: number; label: string; description?: string | null }
type CompetencyCategory = { id: string; name: string; code: string }
type Competency = {
  id: string
  name: string
  code: string
  category: CompetencyCategory
  levels: CompetencyLevel[]
}

type AssessmentItem = {
  selfLevel: number
  selfComment: string
}

type Props = {
  user: SessionUser
  competencies: Competency[]
  requirementMap: Record<string, number>
  grade: string
}

// ── 기간 옵션 ─────────────────────────────────────────────

const PERIODS = ['2025-H1', '2025-H2', '2026-H1', 'latest']

// ── 레벨 라벨 ─────────────────────────────────────────────

const LEVEL_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: '기초', color: '#EF4444' },
  2: { label: '기본', color: '#F59E0B' },
  3: { label: '우수', color: '#10B981' },
  4: { label: '탁월', color: '#3B82F6' },
  5: { label: '전문가', color: '#8B5CF6' },
}

// ── 갭 색상 ──────────────────────────────────────────────

function getGapColor(gap: number | null) {
  if (gap === null) return 'text-muted-foreground'
  if (gap >= 2) return 'text-red-500'
  if (gap === 1) return 'text-amber-500'
  if (gap === 0) return 'text-emerald-600'
  return 'text-blue-500' // 초과
}

function getGapBg(gap: number | null) {
  if (gap === null) return 'bg-background'
  if (gap >= 2) return 'bg-destructive/10'
  if (gap === 1) return 'bg-amber-500/15'
  if (gap === 0) return 'bg-emerald-500/15'
  return 'bg-primary/10'
}

// ── 레벨 선택 버튼 ────────────────────────────────────────

function LevelSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((l) => {
        const info = LEVEL_LABELS[l]
        const selected = value === l
        return (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary hover:bg-primary/10'
            }`}
          >
            <span className="text-base font-bold">{l}</span>
            <span>{info.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function MySkillsClient({user, competencies, requirementMap, grade }: Props) {
  const tCommon = useTranslations('common')
  const t = useTranslations('mySpace')

  const [period, setPeriod] = useState('2026-H1')
  const [assessments, setAssessments] = useState<Record<string, AssessmentItem>>({})
  const [savedAssessments, setSavedAssessments] = useState<Record<string, AssessmentItem>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showRadar, setShowRadar] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']))

  // 기존 평가 로드
  const loadAssessments = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<{
        id: string
        competencyId: string
        selfLevel: number | null
        selfComment: string | null
      }[]>(`/api/v1/skills/assessments?period=${period}`)

      const map: Record<string, AssessmentItem> = {}
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.selfLevel != null) {
            map[item.competencyId] = {
              selfLevel: item.selfLevel,
              selfComment: item.selfComment ?? '',
            }
          }
        }
      }
      setAssessments({ ...map })
      setSavedAssessments({ ...map })
    } catch {
      // 에러 무시
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    void loadAssessments()
  }, [loadAssessments])

  // 카테고리 그룹핑
  const grouped = competencies.reduce<Record<string, { category: CompetencyCategory; items: Competency[] }>>((acc, c) => {
    const key = c.category.id
    if (!acc[key]) acc[key] = { category: c.category, items: [] }
    acc[key].items.push(c)
    return acc
  }, {})

  // 자기평가 저장 (임시)
  const handleSave = async (submit = false) => {
    setSaving(true)
    try {
      const items = Object.entries(assessments).map(([competencyId, a]) => ({
        competencyId,
        selfLevel: a.selfLevel,
        selfComment: a.selfComment,
      }))
      if (items.length === 0) return

      await apiClient.post('/api/v1/skills/assessments', {
        assessmentPeriod: period,
        items,
      })
      setSavedAssessments({ ...assessments })
      if (submit) toast({ title: '자기평가가 제출되었습니다.' })
    } finally {
      setSaving(false)
    }
  }

  // 레이더 차트 데이터 (최대 8개 역량)
  const radarData = competencies.slice(0, 8).map((c) => {
    const a = assessments[c.id]
    return {
      name: c.name,
      실제: a?.selfLevel ?? 0,
      기대: requirementMap[c.id] ?? 0,
    }
  })

  const completedCount = Object.keys(assessments).length
  const totalCount = competencies.length
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const isDirty = JSON.stringify(assessments) !== JSON.stringify(savedAssessments)

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">나의 역량 자기평가</h1>
          <p className="text-sm text-muted-foreground mt-1">
            역량별 현재 수준을 자기평가하고, 개발 방향을 확인하세요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={() => setShowRadar(!showRadar)}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-background"
          >
            <Radar className="w-4 h-4" />
            레이더 차트
          </button>
        </div>
      </div>

      {/* 진행률 KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">평가 완료</p>
          <p className="text-3xl font-bold text-foreground">{completedCount}<span className="text-lg font-normal text-muted-foreground">/{totalCount}</span></p>
          <div className="mt-2 bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">미달 역량</p>
          <p className="text-3xl font-bold text-red-500">
            {competencies.filter((c) => {
              const a = assessments[c.id]
              const req = requirementMap[c.id]
              return a && req && a.selfLevel < req
            }).length}
          </p>
          <p className="text-xs text-red-500 mt-1">기대 수준 미달</p>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">강점 역량</p>
          <p className="text-3xl font-bold text-emerald-600">
            {competencies.filter((c) => {
              const a = assessments[c.id]
              const req = requirementMap[c.id]
              return a && req && a.selfLevel >= req
            }).length}
          </p>
          <p className="text-xs text-emerald-600 mt-1">기대 수준 이상</p>
        </div>
      </div>

      {/* 레이더 차트 */}
      {showRadar && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">역량 레이더 차트</h2>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
              <RechartsRadar
                name="기대 수준"
                dataKey="기대"
                stroke="#E8E8E8"
                fill="#E8E8E8"
                fillOpacity={0.3}
                strokeDasharray="4 4"
              />
              <RechartsRadar
                name="자기평가"
                dataKey="실제"
                stroke={CHART_THEME.colors[3]}
                fill={CHART_THEME.colors[3]}
                fillOpacity={0.3}
              />
              <Legend />
              <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 역량 평가 폼 */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(grouped).map(({ category, items }) => {
            const catKey = category.id
            const expanded = expandedCategories.has(catKey) || expandedCategories.has('all')
            return (
              <div key={catKey} className="bg-card rounded-xl border border-border">
                {/* 카테고리 헤더 */}
                <button
                  onClick={() => {
                    const next = new Set(expandedCategories)
                    if (next.has(catKey)) next.delete(catKey)
                    else next.add(catKey)
                    setExpandedCategories(next)
                  }}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {items.filter((c) => assessments[c.id]).length}/{items.length} 완료
                    </span>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {expanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {items.map((c) => {
                      const a = assessments[c.id]
                      const expectedLevel = requirementMap[c.id]
                      const gap = expectedLevel != null && a ? expectedLevel - a.selfLevel : null

                      return (
                        <div key={c.id} className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-foreground">{c.name}</span>
                                {a && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                )}
                              </div>
                              {expectedLevel != null && (
                                <span className="text-xs text-muted-foreground">
                                  기대 수준: {expectedLevel} ({LEVEL_LABELS[expectedLevel]?.label ?? '-'})
                                </span>
                              )}
                            </div>
                            {gap !== null && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getGapBg(gap)} ${getGapColor(gap)}`}>
                                {gap > 0 ? `갭 -${gap}` : gap === 0 ? '충족' : `+${Math.abs(gap)}`}
                              </span>
                            )}
                          </div>

                          {/* 레벨 선택 */}
                          <LevelSelector
                            value={a?.selfLevel ?? 0}
                            onChange={(v) =>
                              setAssessments((prev) => ({
                                ...prev,
                                [c.id]: { selfLevel: v, selfComment: prev[c.id]?.selfComment ?? '' },
                              }))
                            }
                          />

                          {/* 코멘트 */}
                          {a && (
                            <textarea
                              placeholder={tCommon('enterComment')}
                              value={a.selfComment}
                              onChange={(e) =>
                                setAssessments((prev) => ({
                                  ...prev,
                                  [c.id]: { ...prev[c.id], selfComment: e.target.value },
                                }))
                              }
                              rows={2}
                              className="mt-2 w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary/10"
                            />
                          )}

                          {/* 레벨 설명 */}
                          {a && c.levels.find((l) => l.level === a.selfLevel) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {c.levels.find((l) => l.level === a.selfLevel)?.description}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-3 sticky bottom-6">
        <button
          onClick={() => handleSave(false)}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-background disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          임시저장
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || completedCount === 0}
          className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
        >
          <Send className="w-4 h-4" />
          제출 ({completedCount}/{totalCount})
        </button>
      </div>
    </div>
  )
}
