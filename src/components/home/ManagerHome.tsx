'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Manager Home (V3 2-Zone)
// Phase 4 Batch 7: Action Zone + Monitor Zone 전면 재구축.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { TrendingUp, Clock } from 'lucide-react'
import { DashboardTaskList } from './DashboardTaskList'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { TeamPresence } from './TeamPresence'
import { OnboardingTracker } from './OnboardingTracker'
import { OffboardingTracker } from './OffboardingTracker'
import { PlaceholderCard } from './PlaceholderCard'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { TYPOGRAPHY } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { SessionUser, ManagerSummary } from '@/types'

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
  color?: 'primary' | 'error' | 'warning' | 'success'
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary',
    error: 'text-error',
    warning: 'text-[#B45309]',
    success: 'text-tertiary',
  }
  return (
    <div
      aria-label={`${label}: ${value}`}
      className="rounded-lg bg-muted/50 p-4 text-center"
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
          colorMap[color],
        )}
        aria-hidden="true"
      >
        {value}
      </p>
    </div>
  )
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

  const qrStats = summary?.quarterlyReviewStats
  const reviewPending =
    qrStats && qrStats.total > 0 ? qrStats.total - qrStats.completed : 0
  const reviewRate =
    qrStats && qrStats.total > 0
      ? Math.round((qrStats.completed / qrStats.total) * 100)
      : null

  const hasOnboarding = (summary?.teamOnboarding?.length ?? 0) > 0
  const hasOffboarding = (summary?.teamOffboarding?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      {/* ── Greeting ── */}
      <header>
        <h1 id="dashboard-title" className={TYPOGRAPHY.pageTitle}>
          {t('manager.actionTitle', { name: user.name })}
        </h1>
        <p className={`mt-1 ${TYPOGRAPHY.caption}`}>{t('manager.greetingDesc')}</p>
      </header>

      {/* ── ACTION ZONE ── */}
      <section
        aria-label={t('actionZone')}
        className="rounded-2xl bg-card p-8 shadow-sm"
      >
        <div
          className="mb-4 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
          aria-hidden="true"
        >
          {t('actionZone')}
        </div>

        {error && (
          <DashboardErrorBanner
            message={t('loadError')}
            onRetry={() => void fetchSummary()}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <DashboardTaskList user={user} />
          <div
            className="grid grid-cols-2 gap-3 content-start"
            role="group"
            aria-label={t('manager.actionKpiGroup')}
          >
            <ActionKpiCard
              label={t('manager.actionKpi.teamPending')}
              value={summary?.pendingLeaves ?? '-'}
              color="error"
            />
            <ActionKpiCard
              label={t('manager.actionKpi.reviewPending')}
              value={reviewPending}
              color="warning"
            />
            <ActionKpiCard
              label={t('manager.actionKpi.oneOnOne')}
              value={summary?.scheduledOneOnOnes ?? '-'}
              color="primary"
            />
            <ActionKpiCard
              label={t('manager.actionKpi.reviewRate')}
              value={reviewRate != null ? `${reviewRate}%` : '-'}
              color="success"
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Slot A: Team Presence */}
          <TeamPresence user={user} />

          {/* Slot B: Offboarding 우선 (퇴사가 더 시급), 없으면 Onboarding, 둘 다 없으면 성과 placeholder */}
          {loading ? (
            <WidgetSkeleton height="h-40" lines={3} />
          ) : hasOffboarding ? (
            <OffboardingTracker
              variant="team"
              items={summary?.teamOffboarding}
            />
          ) : hasOnboarding ? (
            <OnboardingTracker
              variant="team"
              items={summary?.teamOnboarding}
            />
          ) : (
            <PlaceholderCard
              title={t('manager.teamPerformance')}
              icon={TrendingUp}
            />
          )}

          {/* Slot C: 두 트랜지션 모두 있으면 Onboarding을 여기 추가, 아니면 Team Attendance placeholder */}
          {loading ? (
            <WidgetSkeleton height="h-40" lines={3} />
          ) : hasOffboarding && hasOnboarding ? (
            <OnboardingTracker
              variant="team"
              items={summary?.teamOnboarding}
            />
          ) : (
            <PlaceholderCard
              title={t('manager.teamAttendance')}
              icon={Clock}
            />
          )}
        </div>
      </section>
    </div>
  )
}
