'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Send, Sparkles, Users, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { getAllowedStatuses } from '@/lib/performance/pipeline'
import type { SessionUser } from '@/types'
import type { EvaluationSettings } from '@/types/settings'
import AiDraftModal from '@/components/performance/AiDraftModal'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { STATUS_VARIANT } from '@/lib/styles/status'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/use-toast'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string; half: string }

interface TeamMemberEval {
  employee: { id: string; name: string; employeeCode: string; department: { name: string } | null; jobGrade: { name: string } | null }
  selfEval: { id: string; status: string; performanceScore: number | null; competencyScore: number | null } | null
  managerEval: { id: string; status: string; performanceScore: number | null; competencyScore: number | null } | null
}

interface GoalItem { id: string; title: string; weight: number }
interface GoalScore { goalId: string; score: number; comment: string }
interface CompetencyScore { competencyId: string; score: number; comment: string }

interface BeiIndicatorGroup {
  competencyId: string
  competencyName: string
  indicators: { id: string; indicatorText: string; displayOrder: number }[]
}

type BeiChecks = Record<string, boolean>

interface EvalPayload {
  members: TeamMemberEval[]
  evalSettings: EvaluationSettings | null
  beiIndicators: BeiIndicatorGroup[]
}

const SCORE_LABELS = ['', '매우 부족', '부족', '보통', '우수', '탁월']

const STATUS_BADGE: Record<string, string> = {
  DRAFT: STATUS_VARIANT.neutral,
  SUBMITTED: STATUS_VARIANT.info,
  CONFIRMED: STATUS_VARIANT.success,
}

// ─── Component ────────────────────────────────────────────

export default function ManagerEvalClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('performance')
  const tc = useTranslations('common')
  const { confirm, dialogProps } = useConfirmDialog()

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMemberEval[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Eval form state
  const [goals, setGoals] = useState<GoalItem[]>([])
  const [goalScores, setGoalScores] = useState<Record<string, GoalScore>>({})
  const [compScores, setCompScores] = useState<Record<string, CompetencyScore>>({})
  const [overallComment, setOverallComment] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [evalSettings, setEvalSettings] = useState<EvaluationSettings | null>(null)
  const [beiIndicators, setBeiIndicators] = useState<BeiIndicatorGroup[]>([])
  const [performanceGrade, setPerformanceGrade] = useState('')
  const [competencyGrade, setCompetencyGrade] = useState('')
  const [beiChecks, setBeiChecks] = useState<BeiChecks>({})
  const [currentEvaluationId, setCurrentEvaluationId] = useState<string | null>(null)
  const [showAiDraft, setShowAiDraft] = useState(false)

  // ─── Fetch cycles ────────────────────────────────────

  useEffect(() => {
    async function fetchCycles() {
      try {
        const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
        const evalCycles = res.data.filter((c) => getAllowedStatuses('evaluation', c.half ?? 'H2').includes(c.status))
        setCycles(evalCycles)
        if (evalCycles.length > 0) setSelectedCycleId(evalCycles[0].id)
      } catch (err) { toast({ title: '평가 주기 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    }
    fetchCycles()
  }, [])

  // ─── Fetch team evaluations ─────────────────────────

  const fetchTeam = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<EvalPayload>('/api/v1/performance/evaluations/manager', { cycleId: selectedCycleId })
      setTeamMembers(res.data.members ?? [])
      setEvalSettings(res.data.evalSettings)
      setBeiIndicators(res.data.beiIndicators ?? [])
    } catch (err) { toast({ title: '평가 설정 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [selectedCycleId])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  // ─── Load employee eval form ────────────────────────

  const loadEmployeeForm = useCallback(async (employeeId: string) => {
    setFormLoading(true)
    setSelectedEmployee(employeeId)
    setCurrentEvaluationId(null)
    try {
      // Get employee's goals
      const goalsRes = await apiClient.getList<GoalItem>('/api/v1/performance/team-goals', { cycleId: selectedCycleId, employeeId })
      setGoals(goalsRes.data)

      // Init scores
      const gs: Record<string, GoalScore> = {}
      for (const g of goalsRes.data) {
        gs[g.id] = { goalId: g.id, score: 3, comment: '' }
      }
      setGoalScores(gs)
      setCompScores({})
      setOverallComment('')
      setPerformanceGrade('')
      setCompetencyGrade('')
      setBeiChecks({})

      // Track current manager evaluation ID if it exists
      const tm = teamMembers.find((m) => m.employee.id === employeeId)
      if (tm?.managerEval?.id) {
        setCurrentEvaluationId(tm.managerEval.id)
      }
    } catch (err) { toast({ title: '팀원 평가 데이터 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    finally { setFormLoading(false) }
  }, [selectedCycleId, teamMembers])

  // ─── Apply AI Draft ──────────────────────────────────

  const handleApplyDraft = (draft: {
    performanceComment: string
    competencyComment?: string | null
    strengths: string[]
    developmentAreas: string[]
    overallOpinion: string
    recommendedGrade?: string | null
    reviewNeededTags: string[]
  }) => {
    // Apply overallOpinion → overallComment
    if (draft.overallOpinion) {
      setOverallComment(draft.overallOpinion)
    } else if (draft.performanceComment) {
      // Fall back to performanceComment if no overall opinion
      setOverallComment(draft.performanceComment)
    }

    // Apply recommended grade → performanceGrade (if provided and a valid grade code)
    if (draft.recommendedGrade) {
      setPerformanceGrade(draft.recommendedGrade)
    }
  }

  // ─── Save / Submit ──────────────────────────────────

  const handleSave = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!selectedEmployee) return
    if (status === 'SUBMITTED') {
        confirm({ title: t('submit_ked9598eb_kec8898ec_kec8898_kec9786ec_keca09cec'), onConfirm: async () => {
          setSubmitting(true)
          try {
            const res = await apiClient.post<{ id: string }>('/api/v1/performance/evaluations/manager', {
              cycleId: selectedCycleId,
              employeeId: selectedEmployee,
              goalScores: Object.values(goalScores),
              competencyScores: Object.values(compScores),
              performanceGrade: performanceGrade || undefined,
              competencyGrade: competencyGrade || undefined,
              beiIndicatorScores: Object.entries(beiChecks).map(([indicatorId, checked]) => ({
                indicatorId,
                checked,
              })),
              overallComment,
              status,
            })
            // Capture evaluation ID so AI draft can be generated
            if (res.data?.id) {
              setCurrentEvaluationId(res.data.id)
            }
            await fetchTeam()
            toast({ title: t('submit_kec9984eb') })
          } catch {
            toast({ title: t('saveFailed'), variant: 'destructive' })
          } finally { setSubmitting(false) }
        }})
        return
    }
    setSubmitting(true)
    try {
      const res = await apiClient.post<{ id: string }>('/api/v1/performance/evaluations/manager', {
        cycleId: selectedCycleId,
        employeeId: selectedEmployee,
        goalScores: Object.values(goalScores),
        competencyScores: Object.values(compScores),
        performanceGrade: performanceGrade || undefined,
        competencyGrade: competencyGrade || undefined,
        beiIndicatorScores: Object.entries(beiChecks).map(([indicatorId, checked]) => ({
          indicatorId,
          checked,
        })),
        overallComment,
        status,
      })
      // Capture evaluation ID so AI draft can be generated
      if (res.data?.id) {
        setCurrentEvaluationId(res.data.id)
      }
      await fetchTeam()
      toast({ title: t('kr_kec9e84ec_savedsuccess') })
    } catch {
      toast({ title: t('saveFailed'), variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  // ─── AI Suggestion ──────────────────────────────────

  const handleAiSuggest = async () => {
    if (!selectedEmployee) return
    const emp = teamMembers.find((m) => m.employee.id === selectedEmployee)
    setAiLoading(true)
    try {
      const res = await apiClient.post<{ suggested_comment: string }>('/api/v1/ai/eval-comment', {
        employeeName: emp?.employee.name ?? '직원',
        goalSummary: goals.map((g) => g.title).join(', '),
        goalScores: goals.map((g) => ({
          title: g.title,
          score: goalScores[g.id]?.score ?? 3,
          weight: g.weight,
        })),
        competencyScores: [],
        evalType: 'MANAGER',
      })
      setOverallComment(res.data.suggested_comment)
    } catch {
      toast({ title: t('kr_ai_kecbd94eb_kec839dec_kec8ba4'), variant: 'destructive' })
    } finally { setAiLoading(false) }
  }

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-muted-foreground">{tc('loading')}...</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('managerEval')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('kr_ked8c80ec_kec84b1ea_ked8f89ea')}</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => {
            setSelectedCycleId(e.target.value)
            setSelectedEmployee(null)
            setPerformanceGrade('')
            setCompetencyGrade('')
            setBeiChecks({})
          }}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
        >
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team member list */}
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              {t('kr_ked8c80ec_kebaaa9eb')}
            </h2>
          </div>
          <div className="divide-y divide-border">
            {teamMembers.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">{t('kr_keca781ec_ked8c80ec_kec9786ec')}</div>
            )}
            {teamMembers.map((tm) => (
              <button
                key={tm.employee.id}
                onClick={() => loadEmployeeForm(tm.employee.id)}
                className={`w-full px-5 py-3 flex items-center justify-between text-left hover:bg-background transition-colors ${
                  selectedEmployee === tm.employee.id ? 'bg-primary/10' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{tm.employee.name}</p>
                  <p className="text-xs text-muted-foreground">{tm.employee.employeeCode}</p>
                </div>
                <div className="flex items-center gap-2">
                  {tm.selfEval && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[tm.selfEval.status] ?? ''}`}>
                      {tm.selfEval.status === 'SUBMITTED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      자기
                    </span>
                  )}
                  {tm.managerEval && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[tm.managerEval.status] ?? ''}`}>
                      {tm.managerEval.status === 'SUBMITTED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      매니저
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Eval form */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedEmployee ? (
            <div className="rounded-xl border border-border bg-card flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">{t('kr_ked8c80ec_kec84a0ed')}</p>
            </div>
          ) : formLoading ? (
            <div className="rounded-xl border border-border bg-card flex items-center justify-center h-64">
              <p className="text-sm text-muted-foreground">{tc('loading')}...</p>
            </div>
          ) : (
            <>
              {/* Goal Scoring */}
              {goals.length > 0 && (
                <div className="rounded-xl border border-border bg-card">
                  <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-base font-semibold text-foreground">{t('goals_evaluation')}</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {goals.map((goal) => (
                      <div key={goal.id} className="px-5 py-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{goal.title}</p>
                            <p className="text-xs text-muted-foreground">가중치: {goal.weight}%</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((score) => (
                              <button
                                key={score}
                                onClick={() => setGoalScores((prev) => ({
                                  ...prev,
                                  [goal.id]: { ...prev[goal.id], score },
                                }))}
                                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                  goalScores[goal.id]?.score === score
                                    ? 'bg-primary text-white'
                                    : 'bg-muted text-muted-foreground hover:bg-border'
                                }`}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{SCORE_LABELS[goalScores[goal.id]?.score ?? 3]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 업적 등급 선택 */}
              {evalSettings && evalSettings.mboGrades.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-base font-semibold text-foreground mb-3">{t('kr_kec9785ec_keb93b1ea')}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {evalSettings.mboGrades.map((g) => (
                      <button
                        key={g.code}
                        onClick={() => setPerformanceGrade(g.code)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          performanceGrade === g.code
                            ? 'bg-primary text-white border-primary'
                            : 'bg-card text-foreground border-border hover:bg-background'
                        }`}
                      >
                        {g.label} ({g.code})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* BEI 역량 평가 — methodology = MBO_BEI일 때만 */}
              {evalSettings?.methodology === 'MBO_BEI' && beiIndicators.length > 0 && (
                <div className="rounded-xl border border-border bg-card">
                  <div className="px-5 py-4 border-b border-border">
                    <h3 className="text-base font-semibold text-foreground">{t('kr_kec97adeb_evaluation_bei')}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('kr_keab480ec_ked9689eb_kecb2b4ed_')}
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {beiIndicators.map((group) => (
                      <div key={group.competencyId} className="px-5 py-4 space-y-3">
                        <p className="text-sm font-semibold text-foreground">{group.competencyName}</p>
                        <div className="space-y-2 pl-2">
                          {group.indicators.map((ind) => (
                            <label key={ind.id} className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!beiChecks[ind.id]}
                                onChange={(e) =>
                                  setBeiChecks((prev) => ({
                                    ...prev,
                                    [ind.id]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5 w-4 h-4 rounded border-border text-primary"
                              />
                              <span className="text-sm text-foreground">{ind.indicatorText}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 역량 종합 등급 */}
                  {evalSettings && evalSettings.beiGrades.length > 0 && (
                    <div className="px-5 py-4 border-t border-border">
                      <p className="text-sm font-medium text-foreground mb-2">{t('kr_kec97adeb_keca285ed_keb93b1ea')}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {evalSettings.beiGrades.map((g) => (
                          <button
                            key={g.code}
                            onClick={() => setCompetencyGrade(g.code)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                              competencyGrade === g.code
                                ? 'bg-primary/90 text-white border-primary/90'
                                : 'bg-card text-foreground border-border hover:bg-background'
                            }`}
                          >
                            {g.label} ({g.code})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 종합 등급 표시 — overallGradeEnabled=true일 때 */}
              {evalSettings?.overallGradeEnabled && performanceGrade && (
                <div className="rounded-xl border border-primary/20 bg-tertiary-container/10 p-4">
                  <p className="text-sm font-semibold text-primary/90">{t('kr_keca285ed_keb93b1ea_kec9e90eb_')}</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    업적 {evalSettings.mboWeight}% ({performanceGrade})
                    {evalSettings.methodology === 'MBO_BEI' && competencyGrade
                      ? ` + 역량 ${evalSettings.beiWeight}% (${competencyGrade})`
                      : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('kr_kecb59cec_keb93b1ea_calibratio')}
                  </p>
                </div>
              )}

              {/* Overall Comment */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground">{t('kr_keca285ed_kec9d98ea')}</h3>
                  <button
                    onClick={handleAiSuggest}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/15 text-primary/90 hover:bg-indigo-200 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiLoading ? t('aiGenerating') : 'AI 코멘트 제안'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  placeholder="팀원에 대한 종합 평가 의견을 작성하세요..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setShowAiDraft(true)}
                  disabled={!currentEvaluationId}
                  title={!currentEvaluationId ? '먼저 임시 저장 후 AI 초안을 생성할 수 있습니다' : undefined}
                  className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 bg-indigo-500/15 text-primary/90 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-200 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {t('kr_ai_draft_kec839dec')}
                </button>
                <div className="flex items-center gap-3">
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
              </div>
              <ConfirmDialog {...dialogProps} />
      </>
          )}
        </div>
      </div>

      {/* AI Draft Modal */}
      {showAiDraft && currentEvaluationId && (
        <AiDraftModal
          evaluationId={currentEvaluationId}
          onClose={() => setShowAiDraft(false)}
          onApply={handleApplyDraft}
        />
      )}
    </div>
  )
}
