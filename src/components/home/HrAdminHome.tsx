'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — HR Admin Home (V3 2-Zone)
// Phase 4 Batch 7: Action Zone + Monitor Zone 전면 재구축.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  UserPlus,
  DollarSign,
  BarChart3,
  Calendar,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiStrip } from './KpiStrip'
import { DashboardTaskList } from './DashboardTaskList'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { OnboardingTracker } from './OnboardingTracker'
import { OffboardingTracker } from './OffboardingTracker'
import { PlaceholderCard } from './PlaceholderCard'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { TYPOGRAPHY } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { SessionUser, HrAdminSummary } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

// ─── Helpers ──────────────────────────────────────────────

function ActionKpiCard({
  label,
  value,
  color = 'primary',
}: {
  label: string
  value: string | number
  color?: 'primary' | 'error' | 'alert' | 'warning-bright' | 'success'
}) {
  // D17/D18: text는 WCAG AA-safe, bg tint로 시각 강조 (bright tokens는 bg/icon 전용)
  const textMap: Record<string, string> = {
    primary: 'text-primary',
    error: 'text-error',              // #e11d48 — 정적 count, 결재 대기
    alert: 'text-error',              // alert도 text는 accessible한 #e11d48 사용
    'warning-bright': 'text-[#B45309]', // bright KPI도 text는 WCAG AA
    success: 'text-tertiary',         // #16a34a
  }
  const bgMap: Record<string, string> = {
    primary: 'bg-muted/50',
    error: 'bg-muted/50',
    alert: 'bg-alert-red/10',         // bg tint로 시각 강조
    'warning-bright': 'bg-warning-bright/15', // bg tint로 시각 강조
    success: 'bg-muted/50',
  }
  return (
    <div
      aria-label={`${label}: ${value}`}
      className={cn('rounded-lg p-4 text-center', bgMap[color])}
    >
      <p
        className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
        aria-hidden="true"
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-display text-2xl font-extrabold tabular-nums',
          textMap[color],
        )}
        aria-hidden="true"
      >
        {value}
      </p>
    </div>
  )
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

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <header>
        <h1 id="dashboard-title" className={TYPOGRAPHY.pageTitle}>
          {t('hrAdmin.actionTitle', { name: user.name })}
        </h1>
        <p className={`mt-1 ${TYPOGRAPHY.caption}`}>{t('hrAdmin.greetingDesc')}</p>
      </header>

      {/* ── ACTION ZONE ── */}
      <section
        aria-label={t('actionZone')}
        className="rounded-2xl bg-card p-8 shadow-sm"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
            aria-hidden="true"
          >
            {t('actionZone')}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link
                href="/employees/new"
                aria-label={t('hrAdmin.quickAction.registerEmployee')}
              >
                <UserPlus className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                {t('hrAdmin.quickAction.registerEmployee')}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link
                href="/payroll"
                aria-label={t('hrAdmin.quickAction.runPayroll')}
              >
                <DollarSign className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                {t('hrAdmin.quickAction.runPayroll')}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link
                href="/analytics"
                aria-label={t('hrAdmin.quickAction.reports')}
              >
                <BarChart3 className="h-4 w-4 stroke-[1.5]" aria-hidden="true" />
                {t('hrAdmin.quickAction.reports')}
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <DashboardTaskList user={user} />
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-start"
            role="group"
            aria-label={t('hrAdmin.actionKpiGroup')}
          >
            <ActionKpiCard
              label={t('hrAdmin.actionKpi.pendingApprovals')}
              value={summary?.pendingLeaves ?? '-'}
              color="error"
            />
            <ActionKpiCard
              label={t('hrAdmin.actionKpi.urgent')}
              value={summary?.urgentCount ?? '-'}
              color="alert"
            />
            <ActionKpiCard
              label={t('hrAdmin.actionKpi.weekDeadline')}
              value={summary?.weekDeadlineCount ?? '-'}
              color="warning-bright"
            />
            <ActionKpiCard
              label={t('hrAdmin.actionKpi.onboardingWaiting')}
              value={summary?.onboardingCount ?? '-'}
              color="primary"
            />
          </div>
        </div>
      </section>

      {/* ── MONITOR ZONE ── */}
      <section aria-label={t('monitorZone')} className="space-y-6">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          aria-hidden="true"
        >
          {t('monitorZone')}
        </div>

        {/* Row 1: KPI Strip */}
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
              {
                label: t('hrAdmin.quarterlyReviewShort'),
                value: summary?.quarterlyReviewStats?.completionRate != null
                  ? `${summary.quarterlyReviewStats.completionRate}%`
                  : '-',
              },
            ]}
          />
        )}

        {/* Row 2: 4-col widgets (xl+), 2-col (md+), 1-col mobile */}
        {/* error 상태에서는 트래커가 misleading empty state를 보여주므로 미렌더 */}
        {!error && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <OnboardingTracker
              variant="admin"
              items={summary?.activeOnboarding}
              loading={loading}
            />
            <OffboardingTracker
              variant="admin"
              items={summary?.activeOffboarding}
              loading={loading}
            />
            <PlaceholderCard
              title={t('hrAdmin.thisWeekSchedule')}
              icon={Calendar}
            />
            <PlaceholderCard
              title={t('hrAdmin.aiInsights')}
              icon={Lightbulb}
            />
          </div>
        )}
      </section>
    </div>
  )
}
