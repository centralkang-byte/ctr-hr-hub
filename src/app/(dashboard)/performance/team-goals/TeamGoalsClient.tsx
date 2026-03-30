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
  DRAFT: 'bg-muted text-[#666]',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-primary/10 text-tertiary',
  REJECTED: 'bg-destructive/5 text-destructive',
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
 user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const tc = useTranslations('common')

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [members, setMembers] = useState<TeamMemberGoals[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const { confirm, dialogProps } = useConfirmDialog()

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
    if (label === t('allApproved')) return 'text-tertiary'
    if (label === t('hasPendingApproval')) return 'text-amber-700'
    if (label === t('hasRejected')) return 'text-destructive'
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
      } catch (err) {
        toast({ title: '팀 목표 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
      }
    }
    fetchCycles()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch team goals ─────────────────────────────────

  const fetchTeamGoals = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<TeamMemberGoals[]>(
        `/api/v1/performance/team-goals?cycleId=${selectedCycleId}`,
      )
      setMembers(res.data)
    } catch (err) {
      toast({ title: '팀 목표 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
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
    confirm({ title: t('confirmApprove'), onConfirm: async () => {
      setActionLoading(goalId)
      try {
        await apiClient.put(`/api/v1/performance/goals/${goalId}/approve`)
        await fetchTeamGoals()
      } catch {
        toast({ title: t('approveFailed'), variant: 'destructive' })
      } finally {
        setActionLoading(null)
      }
    }})
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
          <Users className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t('teamGoalManagement')}</h1>
        </div>

        {/* Cycle selector */}
        {cycles.length > 0 ? (
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="rounded-lg border border-border px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-[#999]">{t('noCycles')}</span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-[#999]">{t('loadingText')}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && members.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-background py-20 text-center">
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
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              {/* Summary row */}
              <button
                type="button"
                onClick={() => toggleExpanded(member.employee.id)}
                className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-background"
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#999]" />
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#999]" />
                )}

                {/* Employee info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
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
                          ? 'text-tertiary'
                          : 'text-orange-500'
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
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      {t('pendingApprovalCount', { count: pendingCount })}
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded: Goal cards */}
              {isExpanded && (
                <div className="border-t border-border bg-background px-6 py-4">
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
                            className="rounded-xl border border-border bg-card p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              {/* Goal info */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Target className="h-4 w-4 shrink-0 text-primary" />
                                  <h4 className="font-medium text-foreground">
                                    {goal.title}
                                  </h4>
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                      STATUS_STYLES[goal.status] ?? 'bg-muted text-[#666]'
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
                                <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
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
                                    className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                                  >
                                    <MessageSquareWarning className="h-3.5 w-3.5" />
                                    {t('requestRevisionButton')}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Inline revision comment */}
                            {isRevisionOpen && (
                              <div className="mt-3 border-t border-border pt-3">
                                <textarea
                                  value={revisionComment}
                                  onChange={(e) => setRevisionComment(e.target.value)}
                                  placeholder={t('revisionPlaceholder')}
                                  rows={3}
                                  className="w-full rounded-lg border border-border px-3 py-2 text-sm placeholder-[#999] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRevisionGoalId(null)
                                      setRevisionComment('')
                                    }}
                                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-[#666] hover:bg-background"
                                  >
                                    {tc('cancel')}
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
