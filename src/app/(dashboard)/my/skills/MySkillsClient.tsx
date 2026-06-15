'use client'

import { useTranslations } from 'next-intl'
import { toast } from '@/hooks/use-toast'
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 나의 역량 자기평가 Client (B8-3)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api'
import {
  ChevronDown, ChevronUp, CheckCircle2,   Radar, Save, Send, BookOpen,
} from 'lucide-react'
import { BUTTON_VARIANTS, CHART_THEME } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'
import type { EmbeddedChildProps } from '@/lib/performance/growth-hub'
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

type Props = EmbeddedChildProps & {
  user: SessionUser
  competencies: Competency[]
  requirementMap: Record<string, number>
  grade: string
}

// ── 기간 옵션 ─────────────────────────────────────────────

const PERIODS = ['2025-H1', '2025-H2', '2026-H1', 'latest']

// ── 갭 색상 ──────────────────────────────────────────────

function getGapColor(gap: number | null) {
  if (gap === null) return 'text-muted-foreground'
  if (gap >= 2) return 'text-destructive'
  if (gap === 1) return 'text-ctr-warning'
  if (gap === 0) return 'text-[#006b39]'
  return 'text-primary' // 초과
}

function getGapBg(gap: number | null) {
  if (gap === null) return 'bg-background'
  if (gap >= 2) return 'bg-destructive/10'
  if (gap === 1) return 'bg-warning-bright/15'
  if (gap === 0) return 'bg-tertiary/10'
  return 'bg-primary/10'
}

// ── 레벨 선택 버튼 ────────────────────────────────────────

function LevelSelector({
  value,
  onChange,
  levelLabels,
}: {
  value: number
  onChange: (v: number) => void
  levelLabels: Record<number, string>
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((l) => {
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
            <span>{levelLabels[l]}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function MySkillsClient({ user: _user, competencies, requirementMap, grade: _grade, embedded = false, onPrimaryActionChange }: Props) {
  const t = useTranslations('mySkills')
  const tCommon = useTranslations('common')

  const LEVEL_LABELS: Record<number, string> = {
    1: t('level.beginner'),
    2: t('level.basic'),
    3: t('level.proficient'),
    4: t('level.advanced'),
    5: t('level.expert'),
  }

  const [period, setPeriod] = useState('2026-H1')
  const [assessments, setAssessments] = useState<Record<string, AssessmentItem>>({})
  const [savedAssessments, setSavedAssessments] = useState<Record<string, AssessmentItem>>({})
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  // 프로토 정합: 역량 레이더 기본 노출 (토글 버튼은 유지 — 사용자가 접을 수 있음)
  const [showRadar, setShowRadar] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']))
  // 기간 전환 시 늦게 도착한 이전 응답이 새 상태를 덮어쓰지 않도록 (Codex P2-9)
  const reqIdRef = useRef(0)

  // 기존 평가 로드
  const loadAssessments = useCallback(async () => {
    const reqId = ++reqIdRef.current
    setLoading(true)
    setLoadFailed(false)
    try {
      const data = await apiClient.get<{
        id: string
        competencyId: string
        selfLevel: number | null
        selfComment: string | null
      }[]>(`/api/v1/skills/assessments?period=${period}`)
      if (reqId !== reqIdRef.current) return // stale 응답 폐기

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
    } catch (err) {
      if (reqId !== reqIdRef.current) return
      setLoadFailed(true)
      toast({
        title: t('loadFailed'),
        description: err instanceof Error ? err.message : tCommon('retry'),
        variant: 'destructive',
      })
    } finally {
      if (reqId === reqIdRef.current) setLoading(false)
    }
  }, [period, t, tCommon])

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

  // 자기평가 저장 — 제출/임시/허브저장 모두 동일 upsert (백엔드에 제출-잠금 상태 없음).
  // successKey 로 성공 토스트만 구분 (제출되었습니다 vs 저장되었습니다).
  const handleSave = useCallback(async (successKey?: 'toastSubmitted' | 'toastSaved') => {
    const items = Object.entries(assessments).map(([competencyId, a]) => ({
      competencyId,
      selfLevel: a.selfLevel,
      selfComment: a.selfComment,
    }))
    if (items.length === 0) return
    setSaving(true)
    try {
      await apiClient.post('/api/v1/skills/assessments', {
        assessmentPeriod: period,
        items,
      })
      setSavedAssessments({ ...assessments })
      if (successKey) toast({ title: t(successKey) })
    } catch (err) {
      toast({
        title: t('saveFailed'),
        description: err instanceof Error ? err.message : tCommon('retry'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }, [assessments, period, t, tCommon])

  // 레이더 차트 데이터 (최대 8개 역량)
  const radarData = competencies.slice(0, 8).map((c) => {
    const a = assessments[c.id]
    return {
      name: c.name,
      actual: a?.selfLevel ?? 0,
      expected: requirementMap[c.id] ?? 0,
    }
  })

  const completedCount = Object.keys(assessments).length
  const totalCount = competencies.length
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const isDirty = JSON.stringify(assessments) !== JSON.stringify(savedAssessments)

  // ─── 허브 헤더 1차 액션: 자기평가 저장 (제출-잠금 없음 → "저장"). load 실패/미완료 시 비활성(빈 폼 위 저장 차단)
  useEffect(() => {
    if (!onPrimaryActionChange) return
    onPrimaryActionChange({
      labelKey: 'action.saveSelfEval',
      icon: Save,
      enabled: !loading && !loadFailed && completedCount > 0,
      visible: true,
      pending: saving,
      run: () => { void handleSave('toastSaved') },
    })
    return () => onPrimaryActionChange(null)
  }, [onPrimaryActionChange, loading, loadFailed, completedCount, saving, handleSave])

  return (
    <div className={cn(embedded ? 'space-y-6' : 'p-6 space-y-6')}>
      {/* 헤더 (embedded 시 허브가 제공) */}
      <div className={cn('flex items-center', embedded ? 'justify-end' : 'justify-between')}>
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('description')}
            </p>
          </div>
        )}
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
            {t('radarChart')}
          </button>
        </div>
      </div>

      {/* 진행률 KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('kpi.completed')}</p>
          <p className="text-3xl font-bold text-foreground">{completedCount}<span className="text-lg font-normal text-muted-foreground">/{totalCount}</span></p>
          <div className="mt-2 bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('kpi.belowExpected')}</p>
          <p className="text-3xl font-bold text-destructive">
            {competencies.filter((c) => {
              const a = assessments[c.id]
              const req = requirementMap[c.id]
              return a && req && a.selfLevel < req
            }).length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t('kpi.belowExpectedDesc')}</p>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('kpi.strength')}</p>
          <p className="text-3xl font-bold text-[#006b39]">
            {competencies.filter((c) => {
              const a = assessments[c.id]
              const req = requirementMap[c.id]
              return a && req && a.selfLevel >= req
            }).length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t('kpi.meetsExpected')}</p>
        </div>
      </div>

      {/* 레이더 차트 */}
      {showRadar && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">{t('radarChartTitle')}</h2>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
              <RechartsRadar
                name={t('expected')}
                dataKey="expected"
                stroke="#E8E8E8"
                fill="#E8E8E8"
                fillOpacity={0.3}
                strokeDasharray="4 4"
              />
              <RechartsRadar
                name={t('actual')}
                dataKey="actual"
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
                      {t('categoryProgress', { done: items.filter((c) => assessments[c.id]).length, total: items.length })}
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
                                  <CheckCircle2 className="w-4 h-4 text-[#006b39]" />
                                )}
                              </div>
                              {expectedLevel != null && (
                                <span className="text-xs text-muted-foreground">
                                  {t('expectedLevel')}: {expectedLevel} ({LEVEL_LABELS[expectedLevel] ?? '-'})
                                </span>
                              )}
                            </div>
                            {gap !== null && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getGapBg(gap)} ${getGapColor(gap)}`}>
                                {gap > 0 ? t('gapBehind', { gap }) : gap === 0 ? t('gapMet') : t('gapAhead', { gap: Math.abs(gap) })}
                              </span>
                            )}
                          </div>

                          {/* 레벨 선택 */}
                          <LevelSelector
                            value={a?.selfLevel ?? 0}
                            levelLabels={LEVEL_LABELS}
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

      {/* 액션 버튼 (embedded 시 허브 헤더가 저장 제공 → 자체 액션바 숨김) */}
      {!embedded && (
        <div className="flex justify-end gap-3 sticky bottom-6">
          <button
            onClick={() => handleSave('toastSaved')}
            disabled={saving || !isDirty}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-background disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {t('saveDraft')}
          </button>
          <button
            onClick={() => handleSave('toastSubmitted')}
            disabled={saving || completedCount === 0}
            className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
          >
            <Send className="w-4 h-4" />
            {t('submit')} ({completedCount}/{totalCount})
          </button>
        </div>
      )}
    </div>
  )
}
