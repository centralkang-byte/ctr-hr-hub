'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Goals Management (Client)
// Manager view: review, approve, request revision on team goals
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
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

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-[#F5F5F5] text-[#666]',
  PENDING_APPROVAL: 'bg-[#FFF8E1] text-[#F57F17]',
  APPROVED: 'bg-[#E8F5E9] text-[#2E7D32]',
  REJECTED: 'bg-[#FFEBEE] text-[#C62828]',
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

// ─── Component ────────────────────────────────────────────

export default function TeamGoalsClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
 user }: { user: SessionUser }) {
  const t = useTranslations('performance')
  const tc = useTranslations('common')

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [members, setMembers] = useState<TeamMemberGoals[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Revision comment state per goal
  const [revisionGoalId, setRevisionGoalId] = useState<string | null>(null)
  const [revisionComment, setRevisionComment] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ─── Helper: overall status for a member ──────────────

  function getMemberOverallStatus(goals: TeamGoal[]): string {
    if (goals.length === 0) return t('noGoalsStatus')
    const statuses = goals.map((g) => g.status)
    if (statuses.every((s) => s === 'APPROVED')) return t('allApproved')
    if (statuses.some((s) => s === 'PENDING_APPROVAL')) return t('hasPendingApproval')
    if (statuses.some((s) => s === 'REJECTED')) return t('hasRejected')
    return t('drafting')
  }

  function getMemberStatusStyle(label: string): string {
    if (label === t('allApproved')) return 'text-[#2E7D32]'
    if (label === t('hasPendingApproval')) return 'text-[#F57F17]'
    if (label === t('hasRejected')) return 'text-[#C62828]'
    return 'text-[#999]'
  }

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
        console.error(t('cycleListLoadFailed'))
      }
    }
    fetchCycles()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch team goals ─────────────────────────────────

  const fetchTeamGoals = useCallback(async () => {
  const { confirm, dialogProps } = useConfirmDialog()
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<TeamMemberGoals[]>(
        `/api/v1/performance/team-goals?cycleId=${selectedCycleId}`,
      )
      setMembers(res.data)
    } catch {
      console.error(t('teamLoadFailed'))
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [selectedCycleId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    confirm({ title: t('confirmApprove'), onConfirm: async () =>
    setActionLoading(goalId)
    try {
      await apiClient.put(`/api/v1/performance/goals/${goalId}/approve`)
      await fetchTeamGoals()
    } catch {
      toast({ title: t('approveFailed'), variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Request revision ─────────────────────────────────

  async function handleRequestRevision(goalId: string) {
    if (!revisionComment.trim()) {
      toast({ title: t('enterRevisionReason') })
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
      toast({ title: t('revisionRequestFailed'), variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-[#00C853]" />
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('teamGoalManagement')}</h1>
        </div>

        {/* Cycle selector */}
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="rounded-lg border border-[#E8E8E8] px-4 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
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
          <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
          <span className="ml-3 text-[#999]">{t('loadingText')}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && members.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#E8E8E8] bg-[#FAFAFA] py-20 text-center">
          <Users className="mx-auto h-12 w-12 text-[#CCC]" />
          <p className="mt-4 text-[#999]">{t('noTeamMembersOrGoals')}</p>
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
              className="overflow-hidden rounded-xl border border-[#E8E8E8] bg-white"
            >
              {/* Summary row */}
              <button
                type="button"
                onClick={() => toggleExpanded(member.employee.id)}
                className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#999]" />
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#999]" />
                )}

                {/* Employee info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1A1A1A]">
                      {member.employee.name}
                    </span>
                    <span className="text-sm text-[#999]">
                      {member.employee.employeeNo}
                    </span>
                    {member.employee.department && (
                      <span className="text-sm text-[#999]">
                        · {member.employee.department.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex shrink-0 items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-[#999]">{t('goalCountLabel')}</div>
                    <div className="font-medium text-[#666]">
                      {member.goals.length}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-[#999]">{t('weightSumLabel')}</div>
                    <div
                      className={`font-medium ${
                        member.totalWeight === 100
                          ? 'text-green-600'
                          : 'text-[#F97316]'
                      }`}
                    >
                      {member.totalWeight}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-[#999]">{t('avgAchievementLabel')}</div>
                    <div className="font-medium text-[#666]">
                      {member.avgProgress}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-[#999]">{t('statusLabel')}</div>
                    <div
                      className={`font-medium ${getMemberStatusStyle(overallStatus)}`}
                    >
                      {overallStatus}
                    </div>
                  </div>
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-[#FFF8E1] px-2.5 py-0.5 text-xs font-medium text-[#F57F17]">
                      {t('pendingApprovalCount', { count: pendingCount })}
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded: Goal cards */}
              {isExpanded && (
                <div className="border-t border-[#F5F5F5] bg-[#FAFAFA] px-6 py-4">
                  {member.goals.length === 0 ? (
                    <p className="py-4 text-center text-sm text-[#999]">
                      {t('noGoalsRegistered')}
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
                            className="rounded-xl border border-[#E8E8E8] bg-white p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              {/* Goal info */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Target className="h-4 w-4 shrink-0 text-[#00C853]" />
                                  <h4 className="font-medium text-[#1A1A1A]">
                                    {goal.title}
                                  </h4>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                      STATUS_STYLES[goal.status] ?? 'bg-[#F5F5F5] text-[#666]'
                                    }`}
                                  >
                                    {t(`goalStatusLabels.${goal.status}` as Parameters<typeof t>[0])}
                                  </span>
                                </div>
                                {goal.description && (
                                  <p className="mt-1 text-sm text-[#999] line-clamp-2">
                                    {goal.description}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-4 text-xs text-[#999]">
                                  <span>{t('weightColLabel')}: {goal.weight}%</span>
                                  <span>{t('achievementColLabel')}: {latestProgress}%</span>
                                  {goal.achievementScore != null && (
                                    <span>{t('evalScore')}: {goal.achievementScore}</span>
                                  )}
                                </div>

                                {/* Progress bar */}
                                <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#F5F5F5]">
                                  <div
                                    className="h-full rounded-full bg-[#00C853] transition-all"
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
                                    {t('approveButton')}
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
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#F97316] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#EA580C] disabled:opacity-50"
                                  >
                                    <MessageSquareWarning className="h-3.5 w-3.5" />
                                    {t('requestRevisionButton')}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Inline revision comment */}
                            {isRevisionOpen && (
                              <div className="mt-3 border-t border-[#F5F5F5] pt-3">
                                <textarea
                                  value={revisionComment}
                                  onChange={(e) => setRevisionComment(e.target.value)}
                                  placeholder={t('revisionPlaceholder')}
                                  rows={3}
                                  className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm placeholder-[#999] focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRevisionGoalId(null)
                                      setRevisionComment('')
                                    }}
                                    className="rounded-lg border border-[#E8E8E8] px-3 py-1.5 text-xs text-[#666] hover:bg-[#FAFAFA]"
                                  >
                                    {tc('cancel')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRequestRevision(goal.id)}
                                    disabled={isThisLoading || !revisionComment.trim()}
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#F97316] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#EA580C] disabled:opacity-50"
                                  >
                                    {isThisLoading && (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    {t('sendRevisionRequest')}
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
    <ConfirmDialog {...dialogProps} />
    </div>
  </>
  )
}
