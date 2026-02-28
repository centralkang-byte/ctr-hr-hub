'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Goals Management (Client)
// Manager view: review, approve, request revision on team goals
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Users,
  CheckCircle2,
  MessageSquareWarning,
  Target,
  Loader2,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Status config ────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중',
  PENDING_APPROVAL: '승인대기',
  APPROVED: '승인',
  REJECTED: '반려',
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

// ─── Types ────────────────────────────────────────────────

interface CycleOption {
  id: string
  name: string
  status: string
}

interface GoalProgress {
  progressPct: number
  createdAt: string
}

interface TeamGoal {
  id: string
  title: string
  description: string | null
  weight: number
  status: string
  achievementScore: number | null
  progress: GoalProgress[]
  createdAt: string
}

interface EmployeeInfo {
  id: string
  name: string
  employeeNo: string
  email: string
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string } | null
}

interface TeamMemberGoals {
  employee: EmployeeInfo
  goals: TeamGoal[]
  totalWeight: number
  avgProgress: number
}

// ─── Helper: overall status for a member ──────────────────

function getMemberOverallStatus(goals: TeamGoal[]): string {
  if (goals.length === 0) return '목표 없음'
  const statuses = goals.map((g) => g.status)
  if (statuses.every((s) => s === 'APPROVED')) return '전체 승인'
  if (statuses.some((s) => s === 'PENDING_APPROVAL')) return '승인대기 있음'
  if (statuses.some((s) => s === 'REJECTED')) return '반려 있음'
  return '작성중'
}

function getMemberStatusStyle(label: string): string {
  if (label === '전체 승인') return 'text-green-700'
  if (label === '승인대기 있음') return 'text-yellow-700'
  if (label === '반려 있음') return 'text-red-700'
  return 'text-gray-500'
}

// ─── Component ────────────────────────────────────────────

export default function TeamGoalsClient({ user }: { user: SessionUser }) {
  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [members, setMembers] = useState<TeamMemberGoals[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Revision comment state per goal
  const [revisionGoalId, setRevisionGoalId] = useState<string | null>(null)
  const [revisionComment, setRevisionComment] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ─── Fetch cycles ─────────────────────────────────────

  useEffect(() => {
    async function fetchCycles() {
      try {
        const res = await apiClient.getList<CycleOption>(
          '/api/v1/performance/cycles',
          { page: 1, limit: 100 },
        )
        setCycles(res.data)
        if (res.data.length > 0) {
          setSelectedCycleId(res.data[0].id)
        }
      } catch {
        console.error('사이클 목록 로드 실패')
      }
    }
    fetchCycles()
  }, [])

  // ─── Fetch team goals ─────────────────────────────────

  const fetchTeamGoals = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<TeamMemberGoals[]>(
        `/api/v1/performance/team-goals?cycleId=${selectedCycleId}`,
      )
      setMembers(res.data)
    } catch {
      console.error('팀 목표 로드 실패')
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [selectedCycleId])

  useEffect(() => {
    fetchTeamGoals()
  }, [fetchTeamGoals])

  // ─── Toggle expand ────────────────────────────────────

  function toggleExpanded(employeeId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(employeeId)) {
        next.delete(employeeId)
      } else {
        next.add(employeeId)
      }
      return next
    })
  }

  // ─── Approve goal ─────────────────────────────────────

  async function handleApprove(goalId: string) {
    if (!confirm('이 목표를 승인하시겠습니까?')) return
    setActionLoading(goalId)
    try {
      await apiClient.put(`/api/v1/performance/goals/${goalId}/approve`)
      await fetchTeamGoals()
    } catch {
      alert('승인에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Request revision ─────────────────────────────────

  async function handleRequestRevision(goalId: string) {
    if (!revisionComment.trim()) {
      alert('수정 요청 사유를 입력해주세요.')
      return
    }
    setActionLoading(goalId)
    try {
      await apiClient.put(`/api/v1/performance/goals/${goalId}/request-revision`, {
        comment: revisionComment.trim(),
      })
      setRevisionGoalId(null)
      setRevisionComment('')
      await fetchTeamGoals()
    } catch {
      alert('수정 요청에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-ctr-primary" />
          <h1 className="text-2xl font-bold text-gray-900">팀 목표 관리</h1>
        </div>

        {/* Cycle selector */}
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-ctr-secondary" />
          <span className="ml-3 text-gray-500">로딩 중...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && members.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-20 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">직속 팀원이 없거나 등록된 목표가 없습니다.</p>
        </div>
      )}

      {/* Team member accordion */}
      {!loading &&
        members.map((member) => {
          const isExpanded = expandedIds.has(member.employee.id)
          const overallStatus = getMemberOverallStatus(member.goals)
          const pendingCount = member.goals.filter(
            (g) => g.status === 'PENDING_APPROVAL',
          ).length

          return (
            <div
              key={member.employee.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {/* Summary row */}
              <button
                type="button"
                onClick={() => toggleExpanded(member.employee.id)}
                className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50"
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
                )}

                {/* Employee info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {member.employee.name}
                    </span>
                    <span className="text-sm text-gray-400">
                      {member.employee.employeeNo}
                    </span>
                    {member.employee.department && (
                      <span className="text-sm text-gray-400">
                        · {member.employee.department.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex shrink-0 items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-gray-400">목표 수</div>
                    <div className="font-medium text-gray-700">
                      {member.goals.length}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">가중치 합계</div>
                    <div
                      className={`font-medium ${
                        member.totalWeight === 100
                          ? 'text-green-600'
                          : 'text-orange-500'
                      }`}
                    >
                      {member.totalWeight}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">평균 달성률</div>
                    <div className="font-medium text-gray-700">
                      {member.avgProgress}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400">상태</div>
                    <div
                      className={`font-medium ${getMemberStatusStyle(overallStatus)}`}
                    >
                      {overallStatus}
                    </div>
                  </div>
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                      승인대기 {pendingCount}건
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded: Goal cards */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                  {member.goals.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-400">
                      등록된 목표가 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {member.goals.map((goal) => {
                        const latestProgress = goal.progress[0]?.progressPct ?? 0
                        const isPending = goal.status === 'PENDING_APPROVAL'
                        const isRevisionOpen = revisionGoalId === goal.id
                        const isThisLoading = actionLoading === goal.id

                        return (
                          <div
                            key={goal.id}
                            className="rounded-lg border border-gray-200 bg-white p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              {/* Goal info */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Target className="h-4 w-4 shrink-0 text-ctr-secondary" />
                                  <h4 className="font-medium text-gray-900">
                                    {goal.title}
                                  </h4>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                      STATUS_STYLES[goal.status] ?? 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {STATUS_LABELS[goal.status] ?? goal.status}
                                  </span>
                                </div>
                                {goal.description && (
                                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                                    {goal.description}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                                  <span>가중치: {goal.weight}%</span>
                                  <span>달성률: {latestProgress}%</span>
                                  {goal.achievementScore != null && (
                                    <span>평가 점수: {goal.achievementScore}</span>
                                  )}
                                </div>

                                {/* Progress bar */}
                                <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className="h-full rounded-full bg-ctr-secondary transition-all"
                                    style={{
                                      width: `${Math.min(latestProgress, 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Action buttons — only for PENDING_APPROVAL */}
                              {isPending && (
                                <div className="flex shrink-0 items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleApprove(goal.id)}
                                    disabled={isThisLoading}
                                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {isThisLoading ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    )}
                                    승인
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isRevisionOpen) {
                                        setRevisionGoalId(null)
                                        setRevisionComment('')
                                      } else {
                                        setRevisionGoalId(goal.id)
                                        setRevisionComment('')
                                      }
                                    }}
                                    disabled={isThisLoading}
                                    className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                                  >
                                    <MessageSquareWarning className="h-3.5 w-3.5" />
                                    수정요청
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Inline revision comment */}
                            {isRevisionOpen && (
                              <div className="mt-3 border-t border-gray-100 pt-3">
                                <textarea
                                  value={revisionComment}
                                  onChange={(e) => setRevisionComment(e.target.value)}
                                  placeholder="수정 요청 사유를 입력해주세요..."
                                  rows={3}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRevisionGoalId(null)
                                      setRevisionComment('')
                                    }}
                                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRequestRevision(goal.id)}
                                    disabled={isThisLoading || !revisionComment.trim()}
                                    className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                                  >
                                    {isThisLoading && (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    수정요청 보내기
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}
