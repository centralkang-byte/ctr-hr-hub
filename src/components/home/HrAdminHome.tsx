'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Admin Home (Phase 3 Redesign)
// HR 관리자 / 슈퍼관리자 대시보드
// KpiStrip + MonitorBanner + DashboardTaskList + 분기리뷰
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NudgeCards } from './NudgeCards'
import { KpiStrip } from './KpiStrip'
import { MonitorBanner } from './MonitorBanner'
import { DashboardTaskList } from './DashboardTaskList'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { TYPOGRAPHY } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

interface HrAdminSummary {
  role: string
  totalEmployees: number
  newHires: number
  terminations: number
  turnoverRate: number
  openPositions: number
  pendingLeaves: number
  quarterlyReviewStats?: { total: number; completed: number; pending: number; completionRate: number }
}

// ─── Component ────────────────────────────────────────────

export function HrAdminHome({ user }: Props) {
  const t = useTranslations('home')
  const [summary, setSummary] = useState<HrAdminSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<HrAdminSummary>('/api/v1/home/summary')
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
        <h1 className={TYPOGRAPHY.pageTitle}>
          {t('employee.greetingName', { name: user.name })}
        </h1>
        <p className={`mt-1 ${TYPOGRAPHY.caption}`}>{t('hrAdmin.greetingDesc')}</p>
      </div>

      {/* ── AI Nudge Cards ── */}
      <NudgeCards user={user} />

      {/* ── Monitor Banner — 승인 적체 ── */}
      <MonitorBanner
        label={t('hrAdmin.leaveRequest')}
        value={summary?.pendingLeaves ?? 0}
        description={t('hrAdmin.pendingLeaveCount', { count: summary?.pendingLeaves ?? 0 })}
        hidden={!summary || (summary.pendingLeaves ?? 0) <= 5}
      />

      {/* ── KPI Strip ── */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
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
            label: t('hrAdmin.totalEmployees'),
            value: summary?.totalEmployees?.toLocaleString() ?? '-',
            delta: t('hrAdmin.thisMonth', { count: summary?.newHires ?? 0 }),
            deltaVariant: 'good',
          }}
          items={[
            {
              label: t('hrAdmin.newHires'),
              value: summary?.newHires ?? 0,
              delta: t('hrAdmin.last30Days'),
              deltaVariant: 'muted',
              variant: 'accent',
            },
            {
              label: t('hrAdmin.terminations'),
              value: summary?.terminations ?? 0,
              delta: t('hrAdmin.last30Days'),
              deltaVariant: 'muted',
              variant: (summary?.terminations ?? 0) > 3 ? 'alert' : 'default',
            },
            {
              label: t('hrAdmin.turnoverRate'),
              value: `${(summary?.turnoverRate ?? 0).toFixed(1)}%`,
              variant: (summary?.turnoverRate ?? 0) > 5 ? 'warn' : 'default',
            },
            {
              label: t('hrAdmin.openPositions'),
              value: summary?.openPositions ?? 0,
            },
          ]}
        />
      )}

      {/* ── Main layout: TaskList left, Sidebar right ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <DashboardTaskList user={user} />

        {/* 분기 리뷰 현황 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {t('hrAdmin.quarterlyReviewStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {(() => {
                if (!stats || stats.total === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      {t('hrAdmin.noReviewYet')}
                    </p>
                  )
                }
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t('hrAdmin.completionRate')}</span>
                      <span className="text-sm font-bold text-foreground">
                        {stats.completionRate}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-1.5 rounded-full bg-primary transition-all"
                        style={{ width: `${stats.completionRate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t('hrAdmin.completedCount', { count: stats.completed })}</span>
                      <span>{t('hrAdmin.totalCount', { count: stats.total })}</span>
                    </div>
                  </>
                )
              })()}
              <Link
                href="/performance/quarterly-reviews"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                {t('hrAdmin.manageReviews')}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
