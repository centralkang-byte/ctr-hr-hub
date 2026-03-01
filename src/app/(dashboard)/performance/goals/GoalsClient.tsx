'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Trash2, TrendingUp } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser, MboGoal } from '@/types'

// ─── Status config ────────────────────────────────────────

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

interface ProgressForm {
  goalId: string
  progressPct: number
  note: string
}

// ─── Component ────────────────────────────────────────────

export default function GoalsClient({ user }: { user: SessionUser }) {
  const router = useRouter()
  const t = useTranslations('performance')
  const tc = useTranslations('common')

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [goals, setGoals] = useState<MboGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [progressForm, setProgressForm] = useState<ProgressForm | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  // ─── Fetch goals ──────────────────────────────────────

  const fetchGoals = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const res = await apiClient.getList<MboGoal>(
        '/api/v1/performance/goals',
        { cycleId: selectedCycleId, page: 1, limit: 50 },
      )
      setGoals(res.data)
    } catch {
      console.error(t('goalListLoadFailed'))
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
    if (!confirm(t('confirmDeleteGoal'))) return
    try {
      await apiClient.delete(`/api/v1/performance/goals/${goalId}`)
      await fetchGoals()
    } catch {
      alert(t('deleteFailed'))
    }
  }

  async function handleSubmitAll() {
    if (!canSubmit) return
    const firstDraft = goals.find((g) => g.status === 'DRAFT')
    if (!firstDraft) return
    if (!confirm(t('confirmSubmitAll'))) return

    setSubmitting(true)
    try {
      await apiClient.put(`/api/v1/performance/goals/${firstDraft.id}/submit`)
      await fetchGoals()
    } catch {
      alert(t('submitFailed'))
    } finally {
      setSubmitting(false)
    }
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
      alert(t('progressRecordFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-ctr-light p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ctr-dark">{t('mboGoalManagement')}</h1>
          <button
            onClick={() => router.push('/performance/goals/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-ctr-primary px-4 py-2 text-sm font-medium text-white hover:bg-ctr-secondary transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t('addGoal')}
          </button>
        </div>

        {/* Cycle selector */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('evaluationCycle')}
          </label>
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
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
          <div className="py-20 text-center text-gray-500">{t('loadingText')}</div>
        ) : goals.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-sm">
            <p className="text-gray-500">{t('noGoalsRegistered')}</p>
            <button
              onClick={() => router.push('/performance/goals/new')}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ctr-secondary hover:underline"
            >
              <Plus className="h-4 w-4" />
              {t('addFirstGoal')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const pct = Number(goal.achievementScore ?? 0)
              return (
                <div
                  key={goal.id}
                  className="rounded-lg bg-white p-5 shadow-sm"
                >
                  {/* Card header */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-base font-semibold text-ctr-dark">
                          {goal.title}
                        </h3>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[goal.status] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {t(`goalStatusLabels.${goal.status}` as Parameters<typeof t>[0])}
                        </span>
                      </div>
                      {goal.description && (
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {goal.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-lg font-bold text-ctr-secondary">
                      {Number(goal.weight)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                      <span>{t('achievement')}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-ctr-secondary transition-all"
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
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        {t('editButton')}
                      </button>
                    )}
                    {goal.status === 'DRAFT' && (
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('deleteButton')}
                      </button>
                    )}
                    {goal.status === 'APPROVED' && (
                      <button
                        onClick={() =>
                          setProgressForm({
                            goalId: goal.id,
                            progressPct: pct,
                            note: '',
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-ctr-secondary px-3 py-1.5 text-xs font-medium text-ctr-secondary hover:bg-blue-50 transition-colors"
                      >
                        <TrendingUp className="h-3 w-3" />
                        {t('recordProgress')}
                      </button>
                    )}
                  </div>

                  {/* Inline progress form */}
                  {progressForm?.goalId === goal.id && (
                    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
                      <h4 className="mb-3 text-sm font-semibold text-gray-700">
                        {t('recordProgressTitle')}
                      </h4>
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">
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
                          className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">
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
                          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleProgressSubmit}
                          disabled={submitting}
                          className="rounded-md bg-ctr-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-ctr-secondary disabled:opacity-50 transition-colors"
                        >
                          {submitting ? t('saving') : tc('save')}
                        </button>
                        <button
                          onClick={() => setProgressForm(null)}
                          className="rounded-md border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
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
          <div className="mt-6 flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
            <div className="text-sm">
              <span className="text-gray-600">{t('weightSum')}</span>
              <span
                className={`font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}
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
              className="rounded-lg bg-ctr-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {submitting ? t('submittingAll') : t('submitAll')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
