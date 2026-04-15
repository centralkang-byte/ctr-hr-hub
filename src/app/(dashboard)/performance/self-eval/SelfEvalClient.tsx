'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Send, Sparkles, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getAllowedStatuses } from '@/lib/performance/pipeline'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ────────────────────────────────────────────────

interface CycleOption {
  id: string
  name: string
  status: string
  half: string
}

interface GoalItem {
  id: string
  title: string
  weight: number
  achievementScore: number | null
  status: string
}

interface CompetencyItem {
  id: string
  name: string
  category: string
  description: string | null
}

interface GoalScore {
  goalId: string
  score: number
  comment: string
}

interface CompetencyScore {
  competencyId: string
  score: number
  comment: string
}

interface ExistingEval {
  id: string
  status: string
  performanceScore: number | null
  competencyScore: number | null
  performanceDetail: GoalScore[] | null
  competencyDetail: CompetencyScore[] | null
  comment: string | null
}

const SCORE_LABELS = ['', 'score.veryLacking', 'score.lacking', 'score.average', 'score.excellent', 'score.outstanding']

// ─── Component ────────────────────────────────────────────

export default function SelfEvalClient({
 user }: { user: SessionUser }) {
  const t = useTranslations('performance')
  const tc = useTranslations('common')

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [goals, setGoals] = useState<GoalItem[]>([])
  const [competencies, setCompetencies] = useState<CompetencyItem[]>([])
  const [existingEval, setExistingEval] = useState<ExistingEval | null>(null)

  const [goalScores, setGoalScores] = useState<Record<string, GoalScore>>({})
  const [compScores, setCompScores] = useState<Record<string, CompetencyScore>>({})
  const [overallComment, setOverallComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const { confirm, dialogProps } = useConfirmDialog()

  // ─── Fetch cycles ────────────────────────────────────

  useEffect(() => {
    async function fetchCycles() {
      try {
        const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
        const evalOpenCycles = res.data.filter((c) => getAllowedStatuses('evaluation', c.half ?? 'H2').includes(c.status))
        setCycles(evalOpenCycles)
        if (evalOpenCycles.length > 0) setSelectedCycleId(evalOpenCycles[0].id)
      } catch (err) {
        toast({ title: t('selfEval.loadFailed'), description: err instanceof Error ? err.message : t('retryMessage'), variant: 'destructive' })
      }
    }
    fetchCycles()
  }, [t]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch evaluation data ──────────────────────────

  const fetchEvalData = useCallback(async () => {
    if (!selectedCycleId) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await apiClient.get<{
        evaluation: ExistingEval | null
        goals: GoalItem[]
        competencies: CompetencyItem[]
      }>('/api/v1/performance/evaluations/self', { cycleId: selectedCycleId })

      setGoals(res.data.goals)
      setCompetencies(res.data.competencies)
      setExistingEval(res.data.evaluation)

      // Initialize scores from existing eval or empty
      const gs: Record<string, GoalScore> = {}
      for (const g of res.data.goals) {
        const existing = res.data.evaluation?.performanceDetail?.find(
          (d: GoalScore) => d.goalId === g.id,
        )
        gs[g.id] = { goalId: g.id, score: existing?.score ?? 3, comment: existing?.comment ?? '' }
      }
      setGoalScores(gs)

      const cs: Record<string, CompetencyScore> = {}
      for (const c of res.data.competencies) {
        const existing = res.data.evaluation?.competencyDetail?.find(
          (d: CompetencyScore) => d.competencyId === c.id,
        )
        cs[c.id] = { competencyId: c.id, score: existing?.score ?? 3, comment: existing?.comment ?? '' }
      }
      setCompScores(cs)

      setOverallComment(res.data.evaluation?.comment ?? '')
    } catch (err) {
      toast({ title: t('selfEval.saveFailed'), description: err instanceof Error ? err.message : t('retryMessage'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [selectedCycleId, t])

  useEffect(() => { fetchEvalData() }, [fetchEvalData])

  // ─── Save / Submit ──────────────────────────────────

  const handleSave = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (status === 'SUBMITTED') {
        confirm({ title: t('submit_ked9598eb_kec8898ec_kec8898_kec9786ec_keca09cec'), onConfirm: async () => {
      setSubmitting(true)
      try {
        await apiClient.post('/api/v1/performance/evaluations/self', {
          cycleId: selectedCycleId,
          goalScores: Object.values(goalScores),
          competencyScores: Object.values(compScores),
          overallComment,
          status,
        })
        await fetchEvalData()
        toast({ title: t('selfEval.submitted') })
      } catch {
        toast({ title: t('saveFailed'), variant: 'destructive' })
      } finally {
        setSubmitting(false)
      }
    }})
    } else {
      setSubmitting(true)
      try {
        await apiClient.post('/api/v1/performance/evaluations/self', {
          cycleId: selectedCycleId,
          goalScores: Object.values(goalScores),
          competencyScores: Object.values(compScores),
          overallComment,
          status,
        })
        await fetchEvalData()
        toast({ title: t('selfEval.draftSaved') })
      } catch {
        toast({ title: t('saveFailed'), variant: 'destructive' })
      } finally {
        setSubmitting(false)
      }
    }
  }

  // ─── AI Comment Suggestion ──────────────────────────

  const handleAiSuggest = async () => {
    setAiLoading(true)
    try {
      const res = await apiClient.post<{
        suggested_comment: string
        strengths: string[]
        improvement_areas: string[]
      }>('/api/v1/ai/eval-comment', {
        employeeName: user.name ?? t('managerEval.defaultEmployee'),
        goalSummary: goals.map((g) => g.title).join(', '),
        goalScores: goals.map((g) => ({
          title: g.title,
          score: goalScores[g.id]?.score ?? 3,
          weight: g.weight,
        })),
        competencyScores: competencies.map((c) => ({
          name: c.name,
          score: compScores[c.id]?.score ?? 3,
        })),
        evalType: 'SELF',
      })
      setOverallComment(res.data.suggested_comment)
    } catch {
      toast({ title: t('kr_ai_kecbd94eb_kec839dec_kec8ba4'), variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  const isSubmitted = existingEval?.status === 'SUBMITTED'

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {tc('loading')}...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('selfEval.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('kr_kec9e90ea_kec84b1ea_kebb08f_ke')}</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
        >
          {!cycles?.length && <EmptyState />}
              {cycles?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isSubmitted && (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-emerald-200 bg-emerald-500/15">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">{t('selfEval_keab080_keca09cec')}</span>
        </div>
      )}

      {/* Goal Scoring */}
      {goals.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{t('goals_evaluation')}</h2>
          </div>
          <div className="divide-y divide-border">
            {goals.map((goal) => (
              <div key={goal.id} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{goal.title}</p>
                    <p className="text-xs text-muted-foreground">{t('managerEval.weight', { weight: goal.weight })}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        disabled={isSubmitted}
                        onClick={() => setGoalScores((prev) => ({
                          ...prev,
                          [goal.id]: { ...prev[goal.id], score },
                        }))}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          goalScores[goal.id]?.score === score
                            ? 'bg-primary text-white'
                            : 'bg-muted text-muted-foreground hover:bg-border'
                        } ${isSubmitted ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{SCORE_LABELS[goalScores[goal.id]?.score ?? 3] ? t(SCORE_LABELS[goalScores[goal.id]?.score ?? 3]) : ''}</p>
                <input
                  type="text"
                  placeholder={t('enterComment')}
                  disabled={isSubmitted}
                  value={goalScores[goal.id]?.comment ?? ''}
                  onChange={(e) => setGoalScores((prev) => ({
                    ...prev,
                    [goal.id]: { ...prev[goal.id], comment: e.target.value },
                  }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground disabled:bg-background"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competency Scoring */}
      {competencies.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{t('kr_kec97adeb_evaluation')}</h2>
          </div>
          <div className="divide-y divide-border">
            {competencies.map((comp) => (
              <div key={comp.id} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{comp.name}</p>
                    <p className="text-xs text-muted-foreground">{comp.category}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        disabled={isSubmitted}
                        onClick={() => setCompScores((prev) => ({
                          ...prev,
                          [comp.id]: { ...prev[comp.id], score },
                        }))}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          compScores[comp.id]?.score === score
                            ? 'bg-primary text-white'
                            : 'bg-muted text-muted-foreground hover:bg-border'
                        } ${isSubmitted ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{SCORE_LABELS[compScores[comp.id]?.score ?? 3] ? t(SCORE_LABELS[compScores[comp.id]?.score ?? 3]) : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overall Comment */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('kr_keca285ed_kec9d98ea')}</h2>
          {!isSubmitted && (
            <button
              onClick={handleAiSuggest}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/15 text-primary/90 hover:bg-indigo-200 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? t('aiGenerating') : t('managerEval.aiSuggest')}
            </button>
          )}
        </div>
        <textarea
          rows={4}
          disabled={isSubmitted}
          value={overallComment}
          onChange={(e) => setOverallComment(e.target.value)}
          placeholder={t('selfEval.commentPlaceholder')}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground disabled:bg-background resize-none"
        />
      </div>

      {/* Actions */}
      {!isSubmitted && (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => handleSave('DRAFT')}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {t('kr_kec9e84ec_save')}
          </button>
          <button
            onClick={() => handleSave('SUBMITTED')}
            disabled={submitting}
            className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
          >
            <Send className="w-4 h-4" />
            {t('submit')}
          </button>
        </div>
      )}
    <ConfirmDialog {...dialogProps} />
    </div>
  )
}
