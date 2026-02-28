'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Target,
  TrendingUp,
  Calendar,
  Users,
  ChevronRight,
  BarChart3,
  ClipboardList,
  Settings,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface CycleInfo {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
  goalDeadline: string | null
  evalDeadline: string | null
}

interface GoalItem {
  id: string
  title: string
  status: string
  weight: number
  progress: { progressPct: number; createdAt: string }[]
}

interface TeamMemberGoals {
  employee: {
    id: string
    name: string
    employeeNo: string
    email: string
    department: { id: string; name: string } | null
    jobGrade: { id: string; name: string } | null
  }
  goals: GoalItem[]
  totalWeight: number
  avgProgress: number
}

// ─── Status config ────────────────────────────────────────

const CYCLE_STATUS_LABELS: Record<string, string> = {
  PLANNING: '계획',
  GOAL_SETTING: '목표설정',
  IN_PROGRESS: '진행중',
  EVALUATION: '평가',
  CALIBRATION: '보정',
  COMPLETED: '완료',
}

const CYCLE_STATUS_STYLES: Record<string, string> = {
  PLANNING: 'bg-gray-100 text-gray-700',
  GOAL_SETTING: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-green-100 text-green-700',
  EVALUATION: 'bg-yellow-100 text-yellow-700',
  CALIBRATION: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-gray-200 text-gray-600',
}

const GOAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중',
  PENDING_APPROVAL: '승인대기',
  APPROVED: '승인',
  REJECTED: '반려',
}

// ─── Helpers ──────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getNextDeadline(cycle: CycleInfo | null): string {
  if (!cycle) return '-'
  const now = new Date()
  const deadlines = [
    { label: '목표 마감', date: cycle.goalDeadline },
    { label: '평가 마감', date: cycle.evalDeadline },
    { label: '사이클 종료', date: cycle.endDate },
  ]
  for (const dl of deadlines) {
    if (dl.date && new Date(dl.date) > now) {
      return `${dl.label}: ${formatDate(dl.date)}`
    }
  }
  return '마감 없음'
}

// ─── Component ────────────────────────────────────────────

export default function PerformanceClient({ user }: { user: SessionUser }) {
  const [cycles, setCycles] = useState<CycleInfo[]>([])
  const [activeCycle, setActiveCycle] = useState<CycleInfo | null>(null)
  const [goals, setGoals] = useState<GoalItem[]>([])
  const [teamData, setTeamData] = useState<TeamMemberGoals[]>([])
  const [loading, setLoading] = useState(true)

  const isManager = user.role === 'MANAGER'
  const isAdmin = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'

  // ─── Fetch cycles ─────────────────────────────────────

  useEffect(() => {
    async function fetchCycles() {
      try {
        const res = await apiClient.getList<CycleInfo>(
          '/api/v1/performance/cycles',
          { page: 1, limit: 5 },
        )
        setCycles(res.data)
        // Pick first active/in-progress cycle, else first one
        const active =
          res.data.find((c) => c.status === 'IN_PROGRESS') ??
          res.data.find((c) => c.status === 'GOAL_SETTING') ??
          res.data[0] ?? null
        setActiveCycle(active)
      } catch {
        console.error('사이클 로드 실패')
      }
    }
    fetchCycles()
  }, [])

  // ─── Fetch goals / team data ──────────────────────────

  const fetchData = useCallback(async () => {
    if (!activeCycle) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (isManager) {
        // Manager: fetch team goals
        const res = await apiClient.get<TeamMemberGoals[]>(
          `/api/v1/performance/team-goals?cycleId=${activeCycle.id}`,
        )
        setTeamData(res.data)
      }
      // All roles: fetch own goals
      const goalsRes = await apiClient.getList<GoalItem>(
        '/api/v1/performance/goals',
        { cycleId: activeCycle.id, page: 1, limit: 50 },
      )
      setGoals(goalsRes.data)
    } catch {
      console.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [activeCycle, isManager])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Derived stats ────────────────────────────────────

  const myGoalCount = goals.length
  const avgProgress =
    myGoalCount > 0
      ? Math.round(
          goals.reduce((sum, g) => {
            const latest = g.progress?.[0]
            return sum + (latest?.progressPct ?? 0)
          }, 0) / myGoalCount,
        )
      : 0

  const teamGoalCount = teamData.reduce((sum, m) => sum + m.goals.length, 0)
  const teamAvgProgress =
    teamData.length > 0
      ? Math.round(
          teamData.reduce((sum, m) => sum + m.avgProgress, 0) / teamData.length,
        )
      : 0

  // Admin stats
  const totalGoals = isAdmin
    ? goals.length
    : 0
  const submittedGoals = isAdmin
    ? goals.filter(
        (g) => g.status === 'APPROVED' || g.status === 'PENDING_APPROVAL',
      ).length
    : 0
  const submissionRate =
    totalGoals > 0 ? Math.round((submittedGoals / totalGoals) * 100) : 0

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-ctr-light">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">성과관리</h1>
            {activeCycle && (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm text-gray-500">{activeCycle.name}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    CYCLE_STATUS_STYLES[activeCycle.status] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {CYCLE_STATUS_LABELS[activeCycle.status] ?? activeCycle.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: 현재 사이클 상태 */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <Calendar className="h-5 w-5 text-ctr-secondary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">현재 사이클</p>
                <p className="text-lg font-semibold text-gray-900">
                  {activeCycle
                    ? (CYCLE_STATUS_LABELS[activeCycle.status] ?? activeCycle.status)
                    : '없음'}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: 목표 수 */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  {isManager ? '팀 목표 수' : '내 목표 수'}
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {isManager ? teamGoalCount : myGoalCount}개
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: 평균 달성률 */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">평균 달성률</p>
                <p className="text-lg font-semibold text-gray-900">
                  {isManager ? teamAvgProgress : avgProgress}%
                </p>
              </div>
            </div>
          </div>

          {/* Card 4: 다음 마감일 */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">다음 마감</p>
                <p className="text-sm font-semibold text-gray-900">
                  {getNextDeadline(activeCycle)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-ctr-secondary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* ─── EMPLOYEE: 내 목표 ─────────────────────── */}
            {!isManager && !isAdmin && (
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">내 목표</h2>
                  <Link
                    href="/performance/goals"
                    className="flex items-center gap-1 text-sm font-medium text-ctr-secondary hover:underline"
                  >
                    전체보기 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                {goals.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
                    설정된 목표가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {goals.map((goal) => {
                      const progress = goal.progress?.[0]?.progressPct ?? 0
                      return (
                        <div
                          key={goal.id}
                          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {goal.title}
                              </span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  goal.status === 'APPROVED'
                                    ? 'bg-green-100 text-green-700'
                                    : goal.status === 'PENDING_APPROVAL'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : goal.status === 'REJECTED'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {GOAL_STATUS_LABELS[goal.status] ?? goal.status}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">
                              비중 {goal.weight}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-2 flex-1 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-ctr-secondary transition-all"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {progress}%
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ─── MANAGER: 팀 현황 ──────────────────────── */}
            {isManager && (
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    <Users className="mr-2 inline-block h-5 w-5" />
                    팀 현황
                  </h2>
                  <Link
                    href="/performance/goals"
                    className="flex items-center gap-1 text-sm font-medium text-ctr-secondary hover:underline"
                  >
                    팀 목표 관리 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                {teamData.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
                    팀원이 없거나 목표가 없습니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {teamData.map((member) => (
                      <div
                        key={member.employee.id}
                        className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {member.employee.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {member.employee.department?.name ?? '-'} /{' '}
                              {member.employee.jobGrade?.name ?? '-'}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-ctr-secondary">
                            {member.goals.length}개 목표
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 rounded-full bg-gray-200">
                            <div
                              className="h-2 rounded-full bg-ctr-secondary transition-all"
                              style={{
                                width: `${Math.min(member.avgProgress, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {member.avgProgress}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manager also sees own goals */}
                {goals.length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-3 text-base font-semibold text-gray-900">
                      내 목표
                    </h3>
                    <div className="space-y-3">
                      {goals.map((goal) => {
                        const progress = goal.progress?.[0]?.progressPct ?? 0
                        return (
                          <div
                            key={goal.id}
                            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-medium text-gray-900">
                                {goal.title}
                              </span>
                              <span className="text-sm text-gray-500">
                                {progress}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-ctr-secondary transition-all"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ─── ADMIN: 전사 현황 ──────────────────────── */}
            {isAdmin && (
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    <BarChart3 className="mr-2 inline-block h-5 w-5" />
                    전사 현황
                  </h2>
                  <Link
                    href="/settings/performance-cycles"
                    className="flex items-center gap-1 text-sm font-medium text-ctr-secondary hover:underline"
                  >
                    <Settings className="h-4 w-4" />
                    사이클 관리 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Active cycles */}
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">
                    활성 사이클
                  </h3>
                  {cycles.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
                      등록된 사이클이 없습니다.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {cycles.map((cycle) => (
                        <div
                          key={cycle.id}
                          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium text-gray-900">
                              {cycle.name}
                            </span>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                CYCLE_STATUS_STYLES[cycle.status] ?? 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {CYCLE_STATUS_LABELS[cycle.status] ?? cycle.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {formatDate(cycle.startDate)} ~ {formatDate(cycle.endDate)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submission rate */}
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">
                    전체 목표 제출률
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="h-3 flex-1 rounded-full bg-gray-200">
                      <div
                        className="h-3 rounded-full bg-ctr-secondary transition-all"
                        style={{ width: `${submissionRate}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold text-ctr-secondary">
                      {submissionRate}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    제출/승인: {submittedGoals}건 / 전체: {totalGoals}건
                  </p>
                </div>

                {/* Admin also sees own goals */}
                {goals.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-900">
                        내 목표
                      </h3>
                      <Link
                        href="/performance/goals"
                        className="flex items-center gap-1 text-sm font-medium text-ctr-secondary hover:underline"
                      >
                        전체보기 <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="space-y-3">
                      {goals.map((goal) => {
                        const progress = goal.progress?.[0]?.progressPct ?? 0
                        return (
                          <div
                            key={goal.id}
                            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-medium text-gray-900">
                                {goal.title}
                              </span>
                              <span className="text-sm text-gray-500">
                                {progress}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-ctr-secondary transition-all"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
