'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Manager Home (Phase 3 Redesign)
// 매니저 전용 홈. KpiStrip + DashboardTaskList + TeamPresence.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NudgeCards } from './NudgeCards'
import { KpiStrip } from './KpiStrip'
import { DashboardTaskList } from './DashboardTaskList'
import { TeamPresence } from './TeamPresence'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

interface ManagerSummary {
  role: string
  teamCount: number
  newHires?: number
  pendingLeaves?: number
  overdueLeaves?: number
  scheduledOneOnOnes?: number
  quarterlyReviewStats?: { total: number; completed: number; pending: number }
}

// ─── Component ────────────────────────────────────────────

export function ManagerHome({ user }: Props) {
  const t = useTranslations('home')
  const [summary, setSummary] = useState<ManagerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<ManagerSummary>('/api/v1/home/summary')
      setSummary(res.data)
    } catch {
      setError(true)
      toast({ title: '로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  const stats = summary?.quarterlyReviewStats

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('employee.greetingName', { name: user.name })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('manager.greetingDesc')}</p>
      </div>

      {/* ── Nudge Cards ── */}
      <NudgeCards user={user} />

      {/* ── KPI Strip ── */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(3)].map((_, i) => (
            <WidgetSkeleton key={i} height="h-24" lines={2} />
          ))}
        </div>
      ) : error ? (
        <DashboardErrorBanner
          message={t('loadError')}
          onRetry={() => void fetchSummary()}
        />
      ) : (
        <KpiStrip
          hero={{
            label: t('manager.total'),
            value: summary?.teamCount ?? '-',
            delta: t('manager.totalMembers', { count: summary?.teamCount ?? 0 }),
            deltaVariant: 'muted',
          }}
          items={[
            {
              label: t('manager.pendingLeave'),
              value: summary?.pendingLeaves ?? 0,
              variant: (summary?.pendingLeaves ?? 0) > 3 ? 'warn' : 'default',
            },
            {
              label: t('manager.overdueLeaves'),
              value: summary?.overdueLeaves ?? 0,
              variant: (summary?.overdueLeaves ?? 0) > 0 ? 'alert' : 'default',
            },
            {
              label: t('manager.scheduled1on1'),
              value: summary?.scheduledOneOnOnes ?? 0,
            },
          ]}
        />
      )}

      {/* ── Main layout: TaskList left, Sidebar right ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <DashboardTaskList user={user} />

        <div className="space-y-4">
          {/* 팀 출근 현황 + 인라인 승인 */}
          <TeamPresence user={user} />

          {/* 분기 리뷰 현황 */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {t('manager.quarterlyReview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {(() => {
                if (!stats || stats.total === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      {t('manager.noReviewYet')}
                    </p>
                  )
                }
                const pct = Math.round((stats.completed / stats.total) * 100)
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('manager.completed')}</span>
                      <span className="text-sm font-bold text-foreground">
                        {stats.completed}/{stats.total}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {stats.pending > 0 && (
                      <p className="text-xs text-amber-600">
                        {t('manager.incomplete', { count: stats.pending })}
                      </p>
                    )}
                  </>
                )
              })()}
              <Link
                href="/performance/quarterly-reviews"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                {t('manager.manageQuarterlyReview')}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
