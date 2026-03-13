'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Send, Sparkles, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ────────────────────────────────────────────────

interface CycleOption {
  id: string
  name: string
  status: string
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

const SCORE_LABELS = ['', '매우 부족', '부족', '보통', '우수', '탁월']

// ─── Component ────────────────────────────────────────────

export default function SelfEvalClient({
 user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
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

  // ─── Fetch cycles ────────────────────────────────────

  useEffect(() => {
    async function fetchCycles() {
      try {
        const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
        const evalOpenCycles = res.data.filter((c) => c.status === 'EVAL_OPEN' || c.status === 'CLOSED')
        setCycles(evalOpenCycles)
        if (evalOpenCycles.length > 0) setSelectedCycleId(evalOpenCycles[0].id)
      } catch {
        /* ignore */
      }
    }
    fetchCycles()
  }, [])

  // ─── Fetch evaluation data ──────────────────────────

  const fetchEvalData = useCallback(async () => {
  const { confirm, dialogProps } = useConfirmDialog()
    if (!selectedCycleId) return
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
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [selectedCycleId])

  useEffect(() => { fetchEvalData() }, [fetchEvalData])

  // ─── Save / Submit ──────────────────────────────────

  const handleSave = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!(status === 'SUBMITTED')) return
        confirm({ title: '제출하면 수정할 수 없습니다. 제출하시겠습니까?', onConfirm: async () => {
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
        toast({ title: status === 'DRAFT' ? '임시 저장되었습니다.' : '제출 완료되었습니다.' })
      } catch {
        toast({ title: '저장에 실패했습니다.', variant: 'destructive' })
      } finally {
        setSubmitting(false)
      }
    }})
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
        employeeName: user.name ?? '직원',
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
      toast({ title: 'AI 코멘트 생성에 실패했습니다.', variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  const isSubmitted = existingEval?.status === 'SUBMITTED'

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64 text-[#666]">
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
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('selfEval')}</h1>
          <p className="text-sm text-[#666] mt-1">자기 성과 및 역량을 평가합니다</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#4F46E5]/10"
        >
          {!cycles?.length && <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />}
              {cycles?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isSubmitted && (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-[#A7F3D0] bg-[#D1FAE5]">
          <CheckCircle2 className="w-5 h-5 text-[#059669]" />
          <span className="text-sm font-medium text-[#047857]">자기평가가 제출되었습니다.</span>
        </div>
      )}

      {/* Goal Scoring */}
      {goals.length > 0 && (
        <div className="rounded-xl border border-[#E8E8E8] bg-white">
          <div className="px-5 py-4 border-b border-[#E8E8E8]">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">목표 평가</h2>
          </div>
          <div className="divide-y divide-[#F5F5F5]">
            {goals.map((goal) => (
              <div key={goal.id} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">{goal.title}</p>
                    <p className="text-xs text-[#999]">가중치: {goal.weight}%</p>
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
                            ? 'bg-[#4F46E5] text-white'
                            : 'bg-[#F5F5F5] text-[#666] hover:bg-[#E8E8E8]'
                        } ${isSubmitted ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-[#999]">{SCORE_LABELS[goalScores[goal.id]?.score ?? 3]}</p>
                <input
                  type="text"
                  placeholder={t('enterComment')}
                  disabled={isSubmitted}
                  value={goalScores[goal.id]?.comment ?? ''}
                  onChange={(e) => setGoalScores((prev) => ({
                    ...prev,
                    [goal.id]: { ...prev[goal.id], comment: e.target.value },
                  }))}
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#4F46E5]/10 placeholder:text-[#999] disabled:bg-[#FAFAFA]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competency Scoring */}
      {competencies.length > 0 && (
        <div className="rounded-xl border border-[#E8E8E8] bg-white">
          <div className="px-5 py-4 border-b border-[#E8E8E8]">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">역량 평가</h2>
          </div>
          <div className="divide-y divide-[#F5F5F5]">
            {competencies.map((comp) => (
              <div key={comp.id} className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">{comp.name}</p>
                    <p className="text-xs text-[#999]">{comp.category}</p>
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
                            ? 'bg-[#4F46E5] text-white'
                            : 'bg-[#F5F5F5] text-[#666] hover:bg-[#E8E8E8]'
                        } ${isSubmitted ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-[#999]">{SCORE_LABELS[compScores[comp.id]?.score ?? 3]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overall Comment */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">종합 의견</h2>
          {!isSubmitted && (
            <button
              onClick={handleAiSuggest}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#E0E7FF] text-[#4338CA] hover:bg-[#C7D2FE] transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? 'AI 생성 중...' : 'AI 코멘트 제안'}
            </button>
          )}
        </div>
        <textarea
          rows={4}
          disabled={isSubmitted}
          value={overallComment}
          onChange={(e) => setOverallComment(e.target.value)}
          placeholder="이번 평가 주기에 대한 종합 의견을 작성하세요..."
          className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#4F46E5]/10 placeholder:text-[#999] disabled:bg-[#FAFAFA] resize-none"
        />
      </div>

      {/* Actions */}
      {!isSubmitted && (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => handleSave('DRAFT')}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm font-medium text-[#333] hover:bg-[#FAFAFA] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            임시 저장
          </button>
          <button
            onClick={() => handleSave('SUBMITTED')}
            disabled={submitting}
            className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
          >
            <Send className="w-4 h-4" />
            제출
          </button>
        </div>
      )}
    <ConfirmDialog {...dialogProps} />
    </div>
  )
}
