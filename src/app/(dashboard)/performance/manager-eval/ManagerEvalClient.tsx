'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Send, Sparkles, Users, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import type { EvaluationSettings } from '@/types/settings'
import AiDraftModal from '@/components/performance/AiDraftModal'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }

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
  DRAFT: 'bg-[#F5F5F5] text-[#666]',
  SUBMITTED: 'bg-[#D1FAE5] text-[#047857]',
  CONFIRMED: 'bg-[#E8F5E9] text-[#00A844]',
}

// ─── Component ────────────────────────────────────────────

export default function ManagerEvalClient({ user }: { user: SessionUser }) {
  const t = useTranslations('performance')
  const tc = useTranslations('common')

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
        const evalCycles = res.data.filter((c) => c.status === 'EVAL_OPEN' || c.status === 'CLOSED')
        setCycles(evalCycles)
        if (evalCycles.length > 0) setSelectedCycleId(evalCycles[0].id)
      } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
    if (status === 'SUBMITTED' && !confirm('제출하면 수정할 수 없습니다. 제출하시겠습니까?')) return
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
      alert(status === 'DRAFT' ? '임시 저장되었습니다.' : '제출 완료되었습니다.')
    } catch {
      alert('저장에 실패했습니다.')
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
      alert('AI 코멘트 생성에 실패했습니다.')
    } finally { setAiLoading(false) }
  }

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-[#666]">{tc('loading')}...</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('managerEval')}</h1>
          <p className="text-sm text-[#666] mt-1">팀원의 성과를 평가합니다</p>
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
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
        >
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team member list */}
        <div className="rounded-xl border border-[#E8E8E8] bg-white">
          <div className="px-5 py-4 border-b border-[#E8E8E8]">
            <h2 className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#666]" />
              팀원 목록
            </h2>
          </div>
          <div className="divide-y divide-[#F5F5F5]">
            {teamMembers.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#999]">직속 팀원이 없습니다</div>
            )}
            {teamMembers.map((tm) => (
              <button
                key={tm.employee.id}
                onClick={() => loadEmployeeForm(tm.employee.id)}
                className={`w-full px-5 py-3 flex items-center justify-between text-left hover:bg-[#FAFAFA] transition-colors ${
                  selectedEmployee === tm.employee.id ? 'bg-[#E8F5E9]' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">{tm.employee.name}</p>
                  <p className="text-xs text-[#999]">{tm.employee.employeeCode}</p>
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
                  <ChevronRight className="w-4 h-4 text-[#999]" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Eval form */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedEmployee ? (
            <div className="rounded-xl border border-[#E8E8E8] bg-white flex items-center justify-center h-64">
              <p className="text-sm text-[#999]">팀원을 선택하세요</p>
            </div>
          ) : formLoading ? (
            <div className="rounded-xl border border-[#E8E8E8] bg-white flex items-center justify-center h-64">
              <p className="text-sm text-[#666]">{tc('loading')}...</p>
            </div>
          ) : (
            <>
              {/* Goal Scoring */}
              {goals.length > 0 && (
                <div className="rounded-xl border border-[#E8E8E8] bg-white">
                  <div className="px-5 py-4 border-b border-[#E8E8E8]">
                    <h3 className="text-base font-semibold text-[#1A1A1A]">목표 평가</h3>
                  </div>
                  <div className="divide-y divide-[#F5F5F5]">
                    {goals.map((goal) => (
                      <div key={goal.id} className="px-5 py-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[#1A1A1A]">{goal.title}</p>
                            <p className="text-xs text-[#999]">가중치: {goal.weight}%</p>
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
                                    ? 'bg-[#00C853] text-white'
                                    : 'bg-[#F5F5F5] text-[#666] hover:bg-[#E8E8E8]'
                                }`}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-[#999]">{SCORE_LABELS[goalScores[goal.id]?.score ?? 3]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 업적 등급 선택 */}
              {evalSettings && evalSettings.mboGrades.length > 0 && (
                <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
                  <h3 className="text-base font-semibold text-[#1A1A1A] mb-3">업적 등급</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {evalSettings.mboGrades.map((g) => (
                      <button
                        key={g.code}
                        onClick={() => setPerformanceGrade(g.code)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          performanceGrade === g.code
                            ? 'bg-[#00C853] text-white border-[#00C853]'
                            : 'bg-white text-[#333] border-[#D4D4D4] hover:bg-[#FAFAFA]'
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
                <div className="rounded-xl border border-[#E8E8E8] bg-white">
                  <div className="px-5 py-4 border-b border-[#E8E8E8]">
                    <h3 className="text-base font-semibold text-[#1A1A1A]">역량 평가 (BEI)</h3>
                    <p className="text-xs text-[#666] mt-0.5">
                      관찰된 행동에 체크하고 역량 등급을 선택하세요
                    </p>
                  </div>
                  <div className="divide-y divide-[#F5F5F5]">
                    {beiIndicators.map((group) => (
                      <div key={group.competencyId} className="px-5 py-4 space-y-3">
                        <p className="text-sm font-semibold text-[#1A1A1A]">{group.competencyName}</p>
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
                                className="mt-0.5 w-4 h-4 rounded border-[#D4D4D4] text-[#00C853]"
                              />
                              <span className="text-sm text-[#333]">{ind.indicatorText}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 역량 종합 등급 */}
                  {evalSettings && evalSettings.beiGrades.length > 0 && (
                    <div className="px-5 py-4 border-t border-[#E8E8E8]">
                      <p className="text-sm font-medium text-[#333] mb-2">역량 종합 등급</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {evalSettings.beiGrades.map((g) => (
                          <button
                            key={g.code}
                            onClick={() => setCompetencyGrade(g.code)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                              competencyGrade === g.code
                                ? 'bg-[#4338CA] text-white border-[#4338CA]'
                                : 'bg-white text-[#333] border-[#D4D4D4] hover:bg-[#FAFAFA]'
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
                <div className="rounded-xl border border-[#E8F5E9] bg-[#F0FDF4] p-4">
                  <p className="text-sm font-semibold text-[#00A844]">종합 등급 (자동 산출)</p>
                  <p className="text-xs text-[#047857] mt-1">
                    업적 {evalSettings.mboWeight}% ({performanceGrade})
                    {evalSettings.methodology === 'MBO_BEI' && competencyGrade
                      ? ` + 역량 ${evalSettings.beiWeight}% (${competencyGrade})`
                      : ''}
                  </p>
                  <p className="text-xs text-[#555] mt-1">
                    최종 등급은 캘리브레이션 세션에서 확정됩니다.
                  </p>
                </div>
              )}

              {/* Overall Comment */}
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-[#1A1A1A]">종합 의견</h3>
                  <button
                    onClick={handleAiSuggest}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#E0E7FF] text-[#4338CA] hover:bg-[#C7D2FE] transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiLoading ? 'AI 생성 중...' : 'AI 코멘트 제안'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  placeholder="팀원에 대한 종합 평가 의견을 작성하세요..."
                  className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999] resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setShowAiDraft(true)}
                  disabled={!currentEvaluationId}
                  title={!currentEvaluationId ? '먼저 임시 저장 후 AI 초안을 생성할 수 있습니다' : undefined}
                  className="flex items-center gap-1.5 px-3 py-2 border border-[#C7D2FE] bg-[#E0E7FF] text-[#4338CA] rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#C7D2FE] transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  AI 초안 생성
                </button>
                <div className="flex items-center gap-3">
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
                    className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    제출
                  </button>
                </div>
              </div>
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
