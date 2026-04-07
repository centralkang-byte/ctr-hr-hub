'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Admin Home (Stage 5-A Rebuild)
// HR 관리자 / 슈퍼관리자 대시보드
// NudgeCards + UnifiedTaskHub + KPI 그리드
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Users,
  AlertTriangle,
  UserMinus,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ClipboardCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { TaskSummaryCard } from './TaskSummaryCard'
import { NudgeCards } from './NudgeCards'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TYPOGRAPHY, CARD_STYLES } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Props ────────────────────────────────────────────────

interface HrAdminHomeProps {
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

export function HrAdminHome({ user }: HrAdminHomeProps) {
  const t = useTranslations('home')
  const [summary, setSummary] = useState<HrAdminSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<HrAdminSummary>('/api/v1/home/summary')
      .then((res) => setSummary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8">
      {/* ── Greeting ── */}
      <div>
        <h1 className={TYPOGRAPHY.pageTitle}>
          {t('employee.greetingName', { name: user.name })}
        </h1>
        <p className={`mt-1 ${TYPOGRAPHY.caption}`}>{t('hrAdmin.greetingDesc')}</p>
      </div>

      {/* ── AI Nudge Cards ── */}
      <NudgeCards user={user} />

      {/* ── KPI Row ── */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <WidgetSkeleton key={i} height="h-28" lines={2} />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* 전사 인원 */}
          <div className={CARD_STYLES.kpi}>
            <div className="flex items-center justify-between">
              <div>
                <p className={TYPOGRAPHY.label}>{t('hrAdmin.totalEmployees')}</p>
                <p className={`mt-1 ${TYPOGRAPHY.stat}`}>
                  <AnimatedNumber value={summary?.totalEmployees ?? 0} />
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">{t('hrAdmin.thisMonth', { count: summary?.newHires ?? 0 })}</span>
            </div>
          </div>

          {/* 신규 입사 */}
          <div className={CARD_STYLES.kpi}>
            <div className="flex items-center justify-between">
              <div>
                <p className={TYPOGRAPHY.label}>{t('hrAdmin.newHires')}</p>
                <p className={`mt-1 text-3xl font-bold tabular-nums text-emerald-600`}>
                  <AnimatedNumber value={summary?.newHires ?? 0} />
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <p className={`mt-3 ${TYPOGRAPHY.caption}`}>{t('hrAdmin.last30Days')}</p>
          </div>

          {/* 퇴사자 */}
          <div className={CARD_STYLES.kpi}>
            <div className="flex items-center justify-between">
              <div>
                <p className={TYPOGRAPHY.label}>{t('hrAdmin.terminations')}</p>
                <p className={`mt-1 text-3xl font-bold tabular-nums text-red-500`}>
                  <AnimatedNumber value={summary?.terminations ?? 0} />
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/5">
                <TrendingDown className="h-5 w-5 text-red-400" />
              </div>
            </div>
            <p className={`mt-3 ${TYPOGRAPHY.caption}`}>{t('hrAdmin.last30Days')}</p>
          </div>

          {/* 이직률 */}
          <div className={CARD_STYLES.kpi}>
            <div className="flex items-center justify-between">
              <div>
                <p className={TYPOGRAPHY.label}>{t('hrAdmin.turnoverRate')}</p>
                <p className={`mt-1 ${TYPOGRAPHY.stat}`}>
                  <AnimatedNumber
                    value={summary?.turnoverRate ?? 0}
                    formatter={(n) => `${n.toFixed(1)}%`}
                  />
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <p className={`mt-3 ${TYPOGRAPHY.caption}`}>
              {t('hrAdmin.pendingLeaveCount', { count: summary?.pendingLeaves ?? 0 })}
            </p>
          </div>
        </div>
      )}

      {/* ── Main layout: TaskHub left, Compact sidebar right ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* UnifiedTaskHub */}
        <TaskSummaryCard user={user} />

        {/* Right sidebar — compact above-fold cards only */}
        <div className="space-y-4">
          {/* 분기 리뷰 현황 */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {t('hrAdmin.quarterlyReviewStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {(() => {
                const stats = summary?.quarterlyReviewStats
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

          {/* 승인 대기 현황 */}
          <Card className="bg-primary/5">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckSquare className="h-4 w-4 text-primary" />
                {t('hrAdmin.approvalQueue')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('hrAdmin.leaveRequest')}</span>
                <StatusBadge variant="info">{t('nudge.countBadge', { count: summary?.pendingLeaves ?? 0 })}</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('hrAdmin.profileChange')}</span>
                <StatusBadge variant="info">{t('nudge.countBadge', { count: 5 })}</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('hrAdmin.salaryAdjustment')}</span>
                <StatusBadge variant="info">{t('nudge.countBadge', { count: 3 })}</StatusBadge>
              </div>
              <Link
                href="/my/tasks?tab=approvals"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                {t('hrAdmin.goToApprovals')}
              </Link>
            </CardContent>
          </Card>

          {/* 퇴직 진행 현황 */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserMinus className="h-4 w-4 text-amber-500" />
                {t('hrAdmin.offboardingStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('hrAdmin.upcomingTermination')}</span>
                <StatusBadge variant="warning">{t('nudge.countBadge', { count: summary?.terminations ?? 0 })}</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('hrAdmin.handoverInProgress')}</span>
                <StatusBadge variant="warning">{t('nudge.countBadge', { count: 1 })}</StatusBadge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('hrAdmin.thisMonthTermination')}</span>
                <StatusBadge variant="danger">{t('nudge.countBadge', { count: summary?.terminations ?? 0 })}</StatusBadge>
              </div>
              <Link
                href="/offboarding"
                className="block pt-1 text-center text-xs font-medium text-primary hover:underline"
              >
                {t('hrAdmin.offboardingLink')}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
