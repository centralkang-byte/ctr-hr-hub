'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, TrendingUp } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser, MboGoal } from '@/types'

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

interface ProgressForm {
  goalId: string
  progressPct: number
  note: string
}

// ─── Component ────────────────────────────────────────────

export default function GoalsClient({ user }: { user: SessionUser }) {
  const router = useRouter()

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
        console.error('사이클 목록 로드 실패')
      }
    }
    fetchCycles()
  }, [])

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
      console.error('목표 목록 로드 실패')
    } finally {
      setLoading(false)
    }
  }, [selectedCycleId])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  // ─── Derived state ────────────────────────────────────

  const totalWeight = goals.reduce((sum, g) => sum + Number(g.weight), 0)
  const hasDraftGoals = goals.some((g) => g.status === 'DRAFT')
  const canSubmit = totalWeight === 100 && hasDraftGoals

  // ─── Handlers ─────────────────────────────────────────

  async function handleDelete(goalId: string) {
    if (!confirm('이 목표를 삭제하시겠습니까?')) return
    try {
      await apiClient.delete(`/api/v1/performance/goals/${goalId}`)
      await fetchGoals()
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  async function handleSubmitAll() {
    if (!canSubmit) return
    const firstDraft = goals.find((g) => g.status === 'DRAFT')
    if (!firstDraft) return
    if (!confirm('모든 목표를 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.')) return

    setSubmitting(true)
    try {
      await apiClient.put(`/api/v1/performance/goals/${firstDraft.id}/submit`)
      await fetchGoals()
    } catch {
      alert('제출에 실패했습니다.')
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
      alert('진행 기록에 실패했습니다.')
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
          <h1 className="text-2xl font-bold text-ctr-dark">MBO 목표 관리</h1>
          <button
            onClick={() => router.push('/performance/goals/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-ctr-primary px-4 py-2 text-sm font-medium text-white hover:bg-ctr-secondary transition-colors"
          >
            <Plus className="h-4 w-4" />
            목표 추가
          </button>
        </div>

        {/* Cycle selector */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            평가 사이클
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
          <div className="py-20 text-center text-gray-500">로딩 중...</div>
        ) : goals.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-sm">
            <p className="text-gray-500">등록된 목표가 없습니다.</p>
            <button
              onClick={() => router.push('/performance/goals/new')}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ctr-secondary hover:underline"
            >
              <Plus className="h-4 w-4" />
              첫 번째 목표 추가하기
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
                          {STATUS_LABELS[goal.status] ?? goal.status}
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
                      <span>달성도</span>
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
                        수정
                      </button>
                    )}
                    {goal.status === 'DRAFT' && (
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        삭제
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
                        진행 기록
                      </button>
                    )}
                  </div>

                  {/* Inline progress form */}
                  {progressForm?.goalId === goal.id && (
                    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
                      <h4 className="mb-3 text-sm font-semibold text-gray-700">
                        진행 상황 기록
                      </h4>
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          달성률 (%)
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
                          메모
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
                          placeholder="진행 상황에 대한 메모를 입력하세요"
                          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleProgressSubmit}
                          disabled={submitting}
                          className="rounded-md bg-ctr-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-ctr-secondary disabled:opacity-50 transition-colors"
                        >
                          {submitting ? '저장 중...' : '저장'}
                        </button>
                        <button
                          onClick={() => setProgressForm(null)}
                          className="rounded-md border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          취소
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
              <span className="text-gray-600">가중치 합계: </span>
              <span
                className={`font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}
              >
                {totalWeight}%
              </span>
              {totalWeight !== 100 && (
                <span className="ml-2 text-xs text-red-500">
                  (가중치 합계는 100%여야 합니다)
                </span>
              )}
            </div>
            <button
              onClick={handleSubmitAll}
              disabled={!canSubmit || submitting}
              className="rounded-lg bg-ctr-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {submitting ? '제출 중...' : '전체 제출'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
