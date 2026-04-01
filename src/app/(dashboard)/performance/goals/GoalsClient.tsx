'use client'

import { TableSkeleton } from '@/components/ui/LoadingSkeleton'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, TrendingUp, FileEdit, History } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser, MboGoal } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProposeRevisionDialog } from '@/components/performance/goals/ProposeRevisionDialog'
import { RevisionHistorySheet } from '@/components/performance/goals/RevisionHistorySheet'


// ─── Status config ────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING_APPROVAL: 'bg-amber-500/10 text-amber-700',
  APPROVED: 'bg-primary/10 text-tertiary',
  REJECTED: 'bg-destructive/5 text-destructive',
}

// ─── Types ────────────────────────────────────────────────

interface CycleOption {
  id: string
  name: string
  status: string
}

interface ProgressForm {
  goalId: string
  progressPct: number
  note: string
}

// ─── Component ────────────────────────────────────────────

export default function GoalsClient({
 user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const tc = useTranslations('common')
  const router = useRouter()

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [goals, setGoals] = useState<MboGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [progressForm, setProgressForm] = useState<ProgressForm | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { confirm, dialogProps } = useConfirmDialog()
  const [revisionDialogGoals, setRevisionDialogGoals] = useState<MboGoal[]>([])
  const [revisionHistoryGoal, setRevisionHistoryGoal] = useState<{ id: string; title: string } | null>(null)

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
        toast({ title: '목표 데이터 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
        setLoading(false)
      }
    }
    fetchCycles()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch goals ──────────────────────────────────────

  const fetchGoals = useCallback(async () => {
    if (!selectedCycleId) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await apiClient.getList<MboGoal>(
        '/api/v1/performance/goals',
        { cycleId: selectedCycleId, page: 1, limit: 50 },
      )
      setGoals(res.data)
    } catch (err) {
      toast({ title: '목표 데이터 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [selectedCycleId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  // ─── Derived state ────────────────────────────────────

  const totalWeight = goals.reduce((sum, g) => sum + Number(g.weight), 0)
  const hasDraftGoals = goals.some((g) => g.status === 'DRAFT')
  const canSubmit = totalWeight === 100 && hasDraftGoals

  // ─── Handlers ─────────────────────────────────────────

  async function handleDelete(goalId: string) {
    confirm({ title: t('confirmDeleteGoal'), onConfirm: async () => {
      try {
        await apiClient.delete(`/api/v1/performance/goals/${goalId}`)
        await fetchGoals()
      } catch {
        toast({ title: t('deleteFailed'), variant: 'destructive' })
      }
    }})
  }

  async function handleSubmitAll() {
    if (!canSubmit) return
    const firstDraft = goals.find((g) => g.status === 'DRAFT')
    if (!firstDraft) return
    confirm({ title: t('confirmSubmitAll'), onConfirm: async () => {
      setSubmitting(true)
      try {
        await apiClient.put(`/api/v1/performance/goals/${firstDraft.id}/submit`)
        await fetchGoals()
      } catch {
        toast({ title: t('submitFailed'), variant: 'destructive' })
      } finally {
        setSubmitting(false)
      }
    }})
  }

  async function handleProgressSubmit() {
    if (!progressForm) return
    setSubmitting(true)
    try {
      await apiClient.post(
        `/api/v1/performance/goals/${progressForm.goalId}/progress`,
        {
          progressPct: progressForm.progressPct,
          note: progressForm.note || undefined,
        },
      )
      setProgressForm(null)
      await fetchGoals()
    } catch {
      toast({ title: t('progressRecordFailed'), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <>
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{t('mboGoalManagement')}</h1>
          <button
            onClick={() => router.push('/performance/goals/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('addGoal')}
          </button>
        </div>

        {/* Cycle selector */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            {t('evaluationCycle')}
          </label>
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Goal cards */}
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">{t('loadingText')}</div>
        ) : goals.length === 0 ? (
          <div className="rounded-lg bg-card p-12 text-center">
            <p className="text-muted-foreground">{t('noGoalsRegistered')}</p>
            <button
              onClick={() => router.push('/performance/goals/new')}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Plus className="h-4 w-4" />
              {t('addFirstGoal')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {!(goals?.length) && (
          <EmptyState
            title={t('emptyTitle')}
            description={t('emptyDesc')}
          />
        )}
        {goals.map((goal) => {
              const pct = Number(goal.achievementScore ?? 0)
              return (
                <div
                  key={goal.id}
                  className="rounded-lg bg-card p-5"
                >
                  {/* Card header */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {goal.title}
                        </h3>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[goal.status] ?? 'bg-muted text-muted-foreground'}`}
                        >
                          {t(`goalStatusLabels.${goal.status}` as Parameters<typeof t>[0])}
                        </span>
                      </div>
                      {goal.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {goal.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-lg font-bold text-primary">
                      {Number(goal.weight)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t('achievement')}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-border">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {(goal.status === 'DRAFT' || goal.status === 'REJECTED') && (
                      <button
                        onClick={() =>
                          router.push(`/performance/goals/${goal.id}/edit`)
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-background transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        {t('editButton')}
                      </button>
                    )}
                    {goal.status === 'DRAFT' && (
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/20 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('deleteButton')}
                      </button>
                    )}
                    {goal.status === 'APPROVED' && (
                      <>
                        <button
                          onClick={() =>
                            setProgressForm({
                              goalId: goal.id,
                              progressPct: pct,
                              note: '',
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          <TrendingUp className="h-3 w-3" />
                          {t('recordProgress')}
                        </button>
                        {!goal.isLocked && (
                          <button
                            onClick={() => setRevisionDialogGoals([goal])}
                            className="inline-flex items-center gap-1 rounded-lg border border-border/15 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <FileEdit className="h-3 w-3" />
                            {t('goalRevision.proposeRevision')}
                          </button>
                        )}
                      </>
                    )}
                    {/* Revision history badge */}
                    {(goal as MboGoal & { _count?: { revisions: number } })._count?.revisions ? (
                      <button
                        onClick={() => setRevisionHistoryGoal({ id: goal.id, title: goal.title })}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <History className="h-3 w-3" />
                        {t('goalRevision.revisionHistoryCount', { count: (goal as MboGoal & { _count?: { revisions: number } })._count?.revisions ?? 0 })}
                      </button>
                    ) : null}
                  </div>

                  {/* Inline progress form */}
                  {progressForm?.goalId === goal.id && (
                    <div className="mt-4 rounded-md border border-border bg-background p-4">
                      <h4 className="mb-3 text-sm font-semibold text-muted-foreground">
                        {t('recordProgressTitle')}
                      </h4>
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          {t('achievementRate')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={progressForm.progressPct}
                          onChange={(e) =>
                            setProgressForm({
                              ...progressForm,
                              progressPct: Number(e.target.value),
                            })
                          }
                          className="w-32 rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          {t('memoLabel')}
                        </label>
                        <textarea
                          rows={2}
                          value={progressForm.note}
                          onChange={(e) =>
                            setProgressForm({
                              ...progressForm,
                              note: e.target.value,
                            })
                          }
                          placeholder={t('memoPlaceholder')}
                          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleProgressSubmit}
                          disabled={submitting}
                          className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {submitting ? t('saving') : tc('save')}
                        </button>
                        <button
                          onClick={() => setProgressForm(null)}
                          className="rounded-md border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                        >
                          {tc('cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Summary bar */}
        {goals.length > 0 && (
          <div className="mt-6 flex items-center justify-between rounded-lg bg-card p-4">
            <div className="text-sm">
              <span className="text-muted-foreground">{t('weightSum')}</span>
              <span
                className={`font-bold ${totalWeight === 100 ? 'text-tertiary' : 'text-destructive'}`}
              >
                {totalWeight}%
              </span>
              {totalWeight !== 100 && (
                <span className="ml-2 text-xs text-red-500">
                  {t('weightMustBe100')}
                </span>
              )}
            </div>
            <button
              onClick={handleSubmitAll}
              disabled={!canSubmit || submitting}
              className="rounded-lg bg-destructive/50 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {submitting ? t('submittingAll') : t('submitAll')}
            </button>
          </div>
        )}
      </div>
    <ConfirmDialog {...dialogProps} />

    {/* Goal Revision Dialog */}
    <ProposeRevisionDialog
      open={revisionDialogGoals.length > 0}
      onOpenChange={(open) => { if (!open) setRevisionDialogGoals([]) }}
      goals={revisionDialogGoals.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        weight: Number(g.weight),
        targetMetric: g.targetMetric,
        targetValue: g.targetValue,
      }))}
      onSuccess={fetchGoals}
    />

    {/* Revision History Sheet */}
    {revisionHistoryGoal && (
      <RevisionHistorySheet
        open={!!revisionHistoryGoal}
        onOpenChange={(open) => { if (!open) setRevisionHistoryGoal(null) }}
        goalId={revisionHistoryGoal.id}
        goalTitle={revisionHistoryGoal.title}
      />
    )}
    </div>
  </>
  )
}
