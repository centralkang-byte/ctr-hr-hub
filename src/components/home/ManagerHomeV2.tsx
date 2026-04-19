'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Manager Home V2 (R2 Dashboard Pilot)
// R1 primitive 기반 재구성: Hero + 4 StatCard + 2 ListCard (+ 조건부 Insight).
// V1(ManagerHome.tsx)과 공존 — /home-preview/manager에서만 렌더 (env + role gated).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Pencil,
  FileText,
  Target,
  CalendarDays,
  UserPlus,
  CheckCircle2,
  Coffee,
  Sparkles,
} from 'lucide-react'
import { DashboardHomeShell, HomeGrid, HomeSection, HomeStack } from './shell/DashboardHomeShell'
import { HeroCard } from './primitives/HeroCard'
import { StatCard } from './primitives/StatCard'
import { ListCard } from './primitives/ListCard'
import { EmptyState } from './primitives/EmptyState'
import { InsightStrip } from './primitives/InsightStrip'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser, ManagerSummary, OnboardingItem } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

type HeroFocusKind = 'overdue' | 'pending' | 'review' | 'celebration'

// ─── Helpers ────────────────────────────────────────────────

/**
 * Codex Gate 1 MEDIUM fix: normalized severity scoring instead of first-match chain.
 * overdue와 review의 count 체급이 달라 단순 우선순위가 왜곡되는 edge case 방지.
 */
function pickHeroFocus(summary: ManagerSummary | null): HeroFocusKind {
  if (!summary) return 'celebration'
  const overdue = summary.overdueLeaves ?? 0
  const pending = summary.pendingLeaves ?? 0
  const reviewPending = summary.quarterlyReviewStats
    ? summary.quarterlyReviewStats.total - summary.quarterlyReviewStats.completed
    : 0
  const teamCount = summary.teamCount || 1

  // Severity = count × weight
  const scores = {
    overdue: overdue * 3, // 1건당 3점 — 가장 시급
    pending: pending * 1,
    review: (reviewPending / teamCount) * 5, // 팀 절반 미완료 = 2.5점
  }
  const max = Math.max(scores.overdue, scores.pending, scores.review)
  if (max <= 0) return 'celebration'
  if (scores.overdue === max) return 'overdue'
  if (scores.review === max) return 'review'
  return 'pending'
}

function listItemStatusForOnboarding(progress: number): 'success' | 'warning' | 'error' {
  if (progress >= 70) return 'success'
  if (progress >= 40) return 'warning'
  return 'error'
}

function listItemStatusForOffboarding(daysUntilStart: number | null | undefined): 'success' | 'warning' | 'error' {
  if (daysUntilStart == null) return 'warning'
  if (daysUntilStart < 0) return 'error' // overdue
  if (daysUntilStart <= 7) return 'warning'
  return 'success'
}

function timeOfDayIllustration(): 'sunrise' | 'focus' {
  const h = new Date().getHours()
  return h < 12 ? 'sunrise' : 'focus'
}

// ─── Component ──────────────────────────────────────────────

export function ManagerHomeV2({ user }: Props) {
  const t = useTranslations('home.manager.v2')
  const [summary, setSummary] = useState<ManagerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<ManagerSummary>('/api/v1/home/summary')
      setSummary(res.data)
    } catch (err) {
      setError(true)
      toast({
        title: '로드 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  // ── Derived ────────────────────────────────────────────
  const teamCount = summary?.teamCount ?? 0
  const pendingLeaves = summary?.pendingLeaves ?? 0
  const overdueLeaves = summary?.overdueLeaves ?? 0
  const scheduledOneOnOnes = summary?.scheduledOneOnOnes ?? 0
  const qr = summary?.quarterlyReviewStats
  const reviewPending = qr && qr.total > 0 ? qr.total - qr.completed : 0
  const reviewRate = qr && qr.total > 0 ? Math.round((qr.completed / qr.total) * 100) : null

  const focusKind = pickHeroFocus(summary)
  const pendingSpark = (summary?.pendingLeavesTrend ?? []).map((p) => p.value)
  const oneOnOneSpark = (summary?.oneOnOneTrend ?? []).map((p) => p.value)

  const teamOnboarding: OnboardingItem[] = summary?.teamOnboarding ?? []
  const teamOffboarding: OnboardingItem[] = summary?.teamOffboarding ?? []

  // Hero focus resolution
  const heroFocus = (() => {
    switch (focusKind) {
      case 'overdue':
        return {
          title: t('hero.focusOverdue', { count: overdueLeaves }),
          description: t('hero.focusOverdueDesc'),
          cta: { label: t('hero.cta.open'), href: '/approvals/inbox' },
          illustration: 'focus' as const,
        }
      case 'pending':
        return {
          title: t('hero.focusPending', { count: pendingLeaves }),
          description: t('hero.focusPendingDesc'),
          cta: { label: t('hero.cta.open'), href: '/approvals/inbox' },
          illustration: timeOfDayIllustration(),
        }
      case 'review':
        return {
          title: t('hero.focusReview', { count: reviewPending }),
          description: t('hero.focusReviewDesc'),
          cta: { label: t('hero.cta.open'), href: '/performance/manager-eval' },
          illustration: 'focus' as const,
        }
      default:
        return {
          title: t('hero.focusCelebration'),
          description: t('hero.focusCelebrationDesc'),
          cta: { label: t('hero.cta.view'), href: '/attendance/team' },
          illustration: 'celebration' as const,
        }
    }
  })()

  const greetingKey = new Date().getHours() < 12 ? 'hero.greetingAm' : 'hero.greetingPm'

  // ── Error state ───────────────────────────────────────
  if (error && !summary) {
    return (
      <DashboardHomeShell>
        <DashboardErrorBanner
          message={t('loadError')}
          onRetry={() => void fetchSummary()}
        />
      </DashboardHomeShell>
    )
  }

  // ── Render ────────────────────────────────────────────
  return (
    <DashboardHomeShell>
      {/* Hero */}
      <HomeSection title={t('section.hero')} srOnly>
        <HeroCard
          greeting={t(greetingKey, { name: user.name ?? '' })}
          focus={{
            title: heroFocus.title,
            description: heroFocus.description,
            cta: heroFocus.cta,
          }}
          secondary={[
            { label: t('hero.secondary.oneOnOne'), href: '/performance/one-on-one', icon: CalendarDays },
            { label: t('hero.secondary.team'), href: '/attendance/team', icon: Coffee },
          ]}
          illustration={heroFocus.illustration}
        />
      </HomeSection>

      {/* KPI StatCards */}
      <HomeSection title={t('section.stat')} srOnly>
        <HomeGrid cols={4}>
          <StatCard
            label={t('stat.teamCount')}
            value={loading ? '—' : teamCount}
            loading={loading}
            tone="info"
            action={{ label: t('stat.viewTeam'), href: '/attendance/team' }}
          />
          <StatCard
            label={t('stat.approvals')}
            value={loading ? '—' : pendingLeaves}
            loading={loading}
            tone={overdueLeaves > 0 ? 'error' : pendingLeaves > 0 ? 'warning' : 'default'}
            sparkline={pendingSpark.length > 0 ? pendingSpark : undefined}
            trend={
              pendingSpark.length > 0
                ? {
                    direction:
                      pendingSpark[pendingSpark.length - 1] > pendingSpark[0]
                        ? 'up'
                        : pendingSpark[pendingSpark.length - 1] < pendingSpark[0]
                          ? 'down'
                          : 'flat',
                    delta: t('stat.approvalsDelta', { count: pendingLeaves }),
                    sr: t('stat.approvalsSr', { count: pendingLeaves }),
                  }
                : undefined
            }
            action={{ label: t('stat.viewApprovals'), href: '/approvals/inbox' }}
          />
          <StatCard
            label={t('stat.review')}
            value={loading ? '—' : reviewRate != null ? `${reviewRate}%` : '—'}
            loading={loading}
            tone={reviewRate != null && reviewRate < 50 ? 'warning' : 'info'}
            action={{ label: t('stat.viewReview'), href: '/performance/manager-eval' }}
          />
          <StatCard
            label={t('stat.oneOnOne')}
            value={loading ? '—' : scheduledOneOnOnes}
            loading={loading}
            tone="info"
            sparkline={oneOnOneSpark.length > 0 ? oneOnOneSpark : undefined}
            trend={
              oneOnOneSpark.length > 0
                ? {
                    direction:
                      oneOnOneSpark[oneOnOneSpark.length - 1] > oneOnOneSpark[0]
                        ? 'up'
                        : oneOnOneSpark[oneOnOneSpark.length - 1] < oneOnOneSpark[0]
                          ? 'down'
                          : 'flat',
                    delta: t('stat.oneOnOneDelta', { count: scheduledOneOnOnes }),
                    sr: t('stat.oneOnOneSr', { count: scheduledOneOnOnes }),
                  }
                : undefined
            }
            action={{ label: t('stat.viewOneOnOne'), href: '/performance/one-on-one' }}
          />
        </HomeGrid>
      </HomeSection>

      {/* Lists */}
      <HomeSection title={t('section.list')} srOnly>
        <HomeGrid cols={2}>
          <ListCard
            title={t('list.onboarding')}
            items={teamOnboarding}
            maxRows={3}
            // viewAllHref omitted: /onboarding is HR_UP only (manager would 403).
            // Future: team-scoped onboarding view.
            viewAllLabel={t('list.viewAll')}
            renderItem={(item) => ({
              id: item.employeeId,
              primary: item.department ? `${item.name} — ${item.department}` : item.name,
              secondary: t('list.onboardingRow', {
                progress: item.progress,
                days: item.daysUntilStart ?? 0,
              }),
              statusDot: listItemStatusForOnboarding(item.progress),
              statusLabel: t(`list.onboardingStatus.${listItemStatusForOnboarding(item.progress)}`),
              // TODO: href requires onboardingId from API (employeeId won't work). Non-clickable for now.
            })}
            actions={() => [
              { icon: Pencil, label: t('list.action.edit'), onClick: () => undefined },
              { icon: FileText, label: t('list.action.doc'), onClick: () => undefined },
            ]}
            emptyState={
              <EmptyState
                icon={UserPlus}
                title={t('empty.onboarding.title')}
                description={t('empty.onboarding.desc')}
              />
            }
          />
          <ListCard
            title={t('list.offboarding')}
            items={teamOffboarding}
            maxRows={3}
            viewAllHref="/offboarding"
            viewAllLabel={t('list.viewAll')}
            renderItem={(item) => ({
              id: item.employeeId,
              primary: item.name,
              secondary: t('list.offboardingRow', {
                progress: item.progress,
                days: item.daysUntilStart ?? 0,
              }),
              statusDot: listItemStatusForOffboarding(item.daysUntilStart),
              statusLabel: t(`list.offboardingStatus.${listItemStatusForOffboarding(item.daysUntilStart)}`),
              // TODO: href requires offboardingId from API (employeeId won't work). Non-clickable for now.
            })}
            emptyState={
              <EmptyState
                icon={CheckCircle2}
                title={t('empty.offboarding.title')}
                description={t('empty.offboarding.desc')}
                tone="success"
              />
            }
          />
        </HomeGrid>
      </HomeSection>

      {/* Conditional insight */}
      {overdueLeaves > 0 || (reviewPending > 0 && teamCount > 0 && reviewPending * 2 > teamCount) ? (
        <HomeSection title={t('section.insight')} srOnly>
          <HomeStack gap="sm">
            {overdueLeaves > 0 ? (
              <InsightStrip
                kind="ai-suggestion"
                icon={Sparkles}
                message={t('insight.overdueMsg', { count: overdueLeaves })}
                action={{ label: t('insight.overdueCta'), href: '/approvals/inbox' }}
              />
            ) : null}
            {reviewPending > 0 && teamCount > 0 && reviewPending * 2 > teamCount ? (
              <InsightStrip
                kind="system"
                icon={Target}
                message={t('insight.reviewMsg', { count: reviewPending })}
                action={{ label: t('insight.reviewCta'), href: '/performance/manager-eval' }}
              />
            ) : null}
          </HomeStack>
        </HomeSection>
      ) : null}

      {/* Partial error during refresh (stale data still shown) */}
      {error && summary ? (
        <DashboardErrorBanner
          message={t('loadError')}
          onRetry={() => void fetchSummary()}
        />
      ) : null}
    </DashboardHomeShell>
  )
}
