'use client'

import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Self-View Client
// 내 온보딩: 환영 배너, 버디 정보, 진행률, 태스크 목록
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Clock, User } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface OnboardingTaskDef {
  id: string
  title: string
  description: string | null
  assigneeType: string
  dueDaysAfter: number
  isRequired: boolean
  category: string
  sortOrder: number
}

interface OnboardingTaskRow {
  id: string
  status: string
  completedAt: string | null
  task: OnboardingTaskDef
}

interface MyOnboarding {
  id: string
  status: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  buddy: { id: string; name: string; jobCategory: { name: string } | null } | null
  template: { id: string; name: string }
  tasks: OnboardingTaskRow[]
}

interface OnboardingMeClientProps {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  DOCUMENT: '📄',
  TRAINING: '🎓',
  SETUP: '💻',
  INTRODUCTION: '👋',
  OTHER: '📌',
}

const ASSIGNEE_BADGE_STYLES: Record<string, string> = {
  EMPLOYEE: 'bg-[#DCFCE7] text-[#16A34A]',
  MANAGER: 'bg-[#E3F2FD] text-[#2196F3]',
  HR: 'bg-[#FEF2F2] text-[#EF4444]',
  BUDDY: 'bg-[#F3E5F5] text-[#9C27B0]',
}

// ─── Helpers ──────────────────────────────────────────────────

function addDays(dateStr: string | null, days: number): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('ko-KR')
}

function groupByCategory(tasks: OnboardingTaskRow[]): Record<string, OnboardingTaskRow[]> {
  const groups: Record<string, OnboardingTaskRow[]> = {}
  for (const t of tasks) {
    const cat = t.task.category
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(t)
  }
  return groups
}

// ─── Component ──────────────────────────────────────────────

export function OnboardingMeClient({ user }: OnboardingMeClientProps) {
  const t = useTranslations('onboarding')

  const [data, setData] = useState<MyOnboarding | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  const CATEGORY_LABELS: Record<string, string> = {
    DOCUMENT: t('categoryDocument'),
    TRAINING: t('categoryTraining'),
    SETUP: t('categorySetup'),
    INTRODUCTION: t('categoryIntroduction'),
    OTHER: t('categoryOther'),
  }

  const ASSIGNEE_LABELS: Record<string, string> = {
    EMPLOYEE: t('assigneeEmployee'),
    MANAGER: t('assigneeManager'),
    HR: t('assigneeHr'),
    BUDDY: t('assigneeBuddy'),
  }

  // ─── Fetch ───
  const fetchData = useCallback(() => {
    setLoading(true)
    apiClient
      .get<MyOnboarding | null>('/api/v1/onboarding/me')
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Complete task handler ───
  const handleComplete = useCallback(
    async (taskId: string) => {
      setCompleting(taskId)
      try {
        await apiClient.put(`/api/v1/onboarding/tasks/${taskId}/complete`)
        fetchData()
      } catch {
        // Error handled by apiClient
      } finally {
        setCompleting(null)
      }
    },
    [fetchData],
  )

  // ─── Progress calculation ───
  const progress = useMemo(() => {
    if (!data) return { total: 0, completed: 0, pct: 0 }
    const total = data.tasks.length
    const completed = data.tasks.filter((t) => t.status === 'DONE').length
    return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [data])

  // ─── Grouped tasks ───
  const grouped = useMemo(() => {
    if (!data) return {}
    return groupByCategory(data.tasks)
  }, [data])

  const categoryOrder = ['DOCUMENT', 'TRAINING', 'SETUP', 'INTRODUCTION', 'OTHER']

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-10 w-64 bg-[#F5F5FA] rounded animate-pulse" />
        <div className="h-24 w-full bg-[#F5F5FA] rounded-xl animate-pulse" />
        <div className="h-40 w-full bg-[#F5F5FA] rounded-xl animate-pulse" />
        <div className="h-60 w-full bg-[#F5F5FA] rounded-xl animate-pulse" />
      </div>
    )
  }

  // ─── Empty state ───
  if (!data) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader
          title={t('myOnboarding')}
          description={t('myOnboardingNoActive')}
        />
        <div className="bg-white rounded-xl border border-[#F0F0F3] p-8">
          <EmptyState
            title={t('noOnboardingData')}
            description={t('noOnboardingAssigned')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* ─── Welcome Banner ─── */}
      <div className="rounded-xl bg-[#5E81F4] p-6 text-white">
        <h1 className="text-2xl font-bold">
          {t('welcomeMessage', { name: user.name })}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {t('welcomeSubMessage')}
        </p>
      </div>

      {/* ─── Buddy + Progress Row ─── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Buddy Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-bold text-[#1C1D21] tracking-[-0.02em] mb-4">{t('onboardingBuddy')}</h3>
          {data.buddy ? (
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DCFCE7] text-[#5E81F4]">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-[#1C1D21]">{data.buddy.name}</p>
                <p className="text-sm text-[#8181A5]">
                  {data.buddy.jobCategory?.name ?? ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#8181A5]">{t('noBuddyAssigned')}</p>
          )}
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-base font-bold text-[#1C1D21] tracking-[-0.02em] mb-4">{t('overallProgress')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#8181A5]">
                {t('completedCount', { completed: progress.completed, total: progress.total })}
              </span>
              <span className="font-semibold text-[#5E81F4]">{progress.pct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-[#F5F5FA]">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-[#5E81F4] to-[#4A6DE0] transition-all duration-500"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            {data.status === 'COMPLETED' && (
              <div className="flex items-center gap-1 text-sm text-[#16A34A]">
                <CheckCircle2 className="h-4 w-4" />
                {t('onboardingCompleted')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Task Groups ─── */}
      <div className="space-y-4">
        {categoryOrder
          .filter((cat) => grouped[cat] && grouped[cat].length > 0)
          .map((cat) => (
            <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span>{CATEGORY_ICONS[cat]}</span>
                <h3 className="text-base font-bold text-[#1C1D21] tracking-[-0.02em]">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold bg-[#F5F5FA] text-[#8181A5]">
                  {grouped[cat].filter((t) => t.status === 'DONE').length} /{' '}
                  {grouped[cat].length}
                </span>
              </div>
              <div className="space-y-2">
                {grouped[cat].map((row) => {
                  const isDone = row.status === 'DONE'
                  const isSkipped = row.status === 'SKIPPED'
                  const isCompleting = completing === row.id

                  return (
                    <div
                      key={row.id}
                      className={`flex items-center gap-3 rounded-lg border border-[#F0F0F3] px-4 py-3 transition-colors ${
                        isDone ? 'bg-[#FAFAFA] opacity-70' : 'hover:bg-[#FAFAFA]'
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isDone || isSkipped}
                        disabled={isDone || isSkipped || isCompleting}
                        onChange={() => handleComplete(row.id)}
                        className="h-5 w-5 rounded border-[#F0F0F3] text-[#5E81F4] accent-[#5E81F4] cursor-pointer disabled:cursor-default"
                      />

                      {/* Task info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              isDone ? 'line-through text-[#8181A5]' : 'text-[#1C1D21]'
                            }`}
                          >
                            {row.task.title}
                          </span>
                          {!row.task.isRequired && (
                            <span className="text-xs text-[#8181A5]">{t('optional')}</span>
                          )}
                        </div>
                        {row.task.description && (
                          <p className="mt-0.5 text-xs text-[#8181A5] truncate">
                            {row.task.description}
                          </p>
                        )}
                      </div>

                      {/* Assignee badge */}
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs font-semibold ${ASSIGNEE_BADGE_STYLES[row.task.assigneeType] ?? 'bg-[#F5F5FA] text-[#8181A5]'}`}
                      >
                        {ASSIGNEE_LABELS[row.task.assigneeType] ?? row.task.assigneeType}
                      </span>

                      {/* Due date */}
                      <div className="flex shrink-0 items-center gap-1 text-xs text-[#8181A5]">
                        <Clock className="h-3 w-3" />
                        {addDays(data.startedAt, row.task.dueDaysAfter)}
                      </div>

                      {/* Status */}
                      {isDone && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                      )}
                      {isCompleting && (
                        <span className="text-xs text-[#8181A5] shrink-0">{t('processing')}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
