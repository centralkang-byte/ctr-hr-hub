'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Self-View Client
// 내 온보딩: 환영 배너, 버디 정보, 진행률, 태스크 목록
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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

const CATEGORY_LABELS: Record<string, string> = {
  DOCUMENT: '서류',
  TRAINING: '교육',
  SETUP: '장비',
  INTRODUCTION: '소개',
  OTHER: '기타',
}

const ASSIGNEE_LABELS: Record<string, string> = {
  EMPLOYEE: '본인',
  MANAGER: '매니저',
  HR: 'HR',
  BUDDY: '버디',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const ASSIGNEE_VARIANTS: Record<string, BadgeVariant> = {
  EMPLOYEE: 'default',
  MANAGER: 'secondary',
  HR: 'destructive',
  BUDDY: 'outline',
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
  const [data, setData] = useState<MyOnboarding | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

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
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  // ─── Empty state ───
  if (!data) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader
          title="내 온보딩"
          description="현재 진행 중인 온보딩이 없습니다."
        />
        <div className="rounded-md border p-8">
          <EmptyState
            title="온보딩 데이터가 없습니다"
            description="아직 배정된 온보딩 프로그램이 없습니다. HR 담당자에게 문의해주세요."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* ─── Welcome Banner ─── */}
      <div className="rounded-lg bg-ctr-primary p-6 text-white">
        <h1 className="text-2xl font-bold">
          {user.name}님, CTR HR Hub에 오신 것을 환영합니다!
        </h1>
        <p className="mt-1 text-sm text-white/80">
          아래 온보딩 체크리스트를 완료하며 새로운 시작을 준비하세요.
        </p>
      </div>

      {/* ─── Buddy + Progress Row ─── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Buddy Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">온보딩 버디</CardTitle>
          </CardHeader>
          <CardContent>
            {data.buddy ? (
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ctr-light text-ctr-primary">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">{data.buddy.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {data.buddy.jobCategory?.name ?? ''}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">배정된 버디가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">전체 진행률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.completed} / {progress.total} 완료
                </span>
                <span className="font-semibold text-ctr-primary">{progress.pct}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-ctr-primary transition-all duration-500"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              {data.status === 'COMPLETED' && (
                <div className="flex items-center gap-1 text-sm text-ctr-success">
                  <CheckCircle2 className="h-4 w-4" />
                  온보딩이 완료되었습니다!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Task Groups ─── */}
      <div className="space-y-4">
        {categoryOrder
          .filter((cat) => grouped[cat] && grouped[cat].length > 0)
          .map((cat) => (
            <Card key={cat}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span>{CATEGORY_ICONS[cat]}</span>
                  {CATEGORY_LABELS[cat]}
                  <Badge variant="outline" className="ml-auto text-xs font-normal">
                    {grouped[cat].filter((t) => t.status === 'DONE').length} /{' '}
                    {grouped[cat].length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {grouped[cat].map((row) => {
                  const isDone = row.status === 'DONE'
                  const isSkipped = row.status === 'SKIPPED'
                  const isCompleting = completing === row.id

                  return (
                    <div
                      key={row.id}
                      className={`flex items-center gap-3 rounded-md border px-4 py-3 transition-colors ${
                        isDone ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isDone || isSkipped}
                        disabled={isDone || isSkipped || isCompleting}
                        onChange={() => handleComplete(row.id)}
                        className="h-5 w-5 rounded border-gray-300 text-ctr-primary accent-ctr-primary cursor-pointer disabled:cursor-default"
                      />

                      {/* Task info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              isDone ? 'line-through text-muted-foreground' : ''
                            }`}
                          >
                            {row.task.title}
                          </span>
                          {!row.task.isRequired && (
                            <span className="text-xs text-muted-foreground">(선택)</span>
                          )}
                        </div>
                        {row.task.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">
                            {row.task.description}
                          </p>
                        )}
                      </div>

                      {/* Assignee badge */}
                      <Badge
                        variant={ASSIGNEE_VARIANTS[row.task.assigneeType] ?? 'outline'}
                        className="shrink-0 text-xs"
                      >
                        {ASSIGNEE_LABELS[row.task.assigneeType] ?? row.task.assigneeType}
                      </Badge>

                      {/* Due date */}
                      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {addDays(data.startedAt, row.task.dueDaysAfter)}
                      </div>

                      {/* Status */}
                      {isDone && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-ctr-success" />
                      )}
                      {isCompleting && (
                        <span className="text-xs text-muted-foreground shrink-0">처리 중...</span>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  )
}
