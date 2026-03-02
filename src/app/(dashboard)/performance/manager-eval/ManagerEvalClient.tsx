'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Save, Send, Sparkles, Users, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }

interface TeamMemberEval {
  employee: { id: string; name: string; employeeCode: string; department: { name: string } | null; jobGrade: { name: string } | null }
  selfEval: { id: string; status: string; performanceScore: number | null; competencyScore: number | null } | null
  managerEval: { id: string; status: string; performanceScore: number | null; competencyScore: number | null } | null
}

interface GoalItem { id: string; title: string; weight: number }
interface CompetencyItem { id: string; name: string; category: string }
interface GoalScore { goalId: string; score: number; comment: string }
interface CompetencyScore { competencyId: string; score: number; comment: string }

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
  const [competencies, setCompetencies] = useState<CompetencyItem[]>([])
  const [goalScores, setGoalScores] = useState<Record<string, GoalScore>>({})
  const [compScores, setCompScores] = useState<Record<string, CompetencyScore>>({})
  const [overallComment, setOverallComment] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

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
      const res = await apiClient.getList<TeamMemberEval>('/api/v1/performance/evaluations/manager', { cycleId: selectedCycleId })
      setTeamMembers(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [selectedCycleId])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  // ─── Load employee eval form ────────────────────────

  const loadEmployeeForm = useCallback(async (employeeId: string) => {
    setFormLoading(true)
    setSelectedEmployee(employeeId)
    try {
      // Get employee's goals
      const goalsRes = await apiClient.getList<GoalItem>('/api/v1/performance/team-goals', { cycleId: selectedCycleId, employeeId })
      setGoals(goalsRes.data)

      // Get competencies
      const compRes = await apiClient.get<{ competencies: CompetencyItem[] }>('/api/v1/performance/evaluations/self', { cycleId: selectedCycleId })
      if (compRes.data?.competencies) {
        setCompetencies(compRes.data.competencies)
      }

      // Init scores
      const gs: Record<string, GoalScore> = {}
      for (const g of goalsRes.data) {
        gs[g.id] = { goalId: g.id, score: 3, comment: '' }
      }
      setGoalScores(gs)

      const cs: Record<string, CompetencyScore> = {}
      const compList = compRes.data?.competencies ?? []
      for (const c of compList) {
        cs[c.id] = { competencyId: c.id, score: 3, comment: '' }
      }
      setCompScores(cs)
      setOverallComment('')
    } catch { /* ignore */ }
    finally { setFormLoading(false) }
  }, [selectedCycleId])

  // ─── Save / Submit ──────────────────────────────────

  const handleSave = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!selectedEmployee) return
    if (status === 'SUBMITTED' && !confirm('제출하면 수정할 수 없습니다. 제출하시겠습니까?')) return
    setSubmitting(true)
    try {
      await apiClient.post('/api/v1/performance/evaluations/manager', {
        cycleId: selectedCycleId,
        employeeId: selectedEmployee,
        goalScores: Object.values(goalScores),
        competencyScores: Object.values(compScores),
        overallComment,
        status,
      })
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
        competencyScores: competencies.map((c) => ({
          name: c.name,
          score: compScores[c.id]?.score ?? 3,
        })),
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
          onChange={(e) => { setSelectedCycleId(e.target.value); setSelectedEmployee(null) }}
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

              {/* Competency Scoring */}
              {competencies.length > 0 && (
                <div className="rounded-xl border border-[#E8E8E8] bg-white">
                  <div className="px-5 py-4 border-b border-[#E8E8E8]">
                    <h3 className="text-base font-semibold text-[#1A1A1A]">역량 평가</h3>
                  </div>
                  <div className="divide-y divide-[#F5F5F5]">
                    {competencies.map((comp) => (
                      <div key={comp.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#1A1A1A]">{comp.name}</p>
                          <p className="text-xs text-[#999]">{comp.category}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((score) => (
                            <button
                              key={score}
                              onClick={() => setCompScores((prev) => ({
                                ...prev,
                                [comp.id]: { ...prev[comp.id], score },
                              }))}
                              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                compScores[comp.id]?.score === score
                                  ? 'bg-[#00C853] text-white'
                                  : 'bg-[#F5F5F5] text-[#666] hover:bg-[#E8E8E8]'
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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
                  className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  제출
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
